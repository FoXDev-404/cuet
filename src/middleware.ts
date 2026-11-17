import type { APIContext } from "astro";
import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { bootstrapSuperAdmin, getAdminByEmail, getAdminForUser } from "./lib/auth/admin";
import { accessModeEnabled, verifyAccessRequest } from "./lib/auth/access";
import { getSessionUser } from "./lib/auth/session";
import { ensurePracticeLibrary, setPracticeLibraryStore } from "./lib/practice-library";
import { practiceLibraryD1Store } from "./lib/practice-store-d1";
import { getSetting } from "./lib/settings";
import { trackDbMetrics } from "./lib/db";
import { DB_DEGRADED_HEADER } from "./lib/db-resilient";
import { canonicalHostRedirect, trailingSlashRedirect } from "./lib/canonical-host";
import { edgeCacheKeyRequest, edgeCacheTtlForPath, isEdgeCacheableContentType, shouldAttemptEdgeCache } from "./lib/edge-cache";
import { isPrivatePath } from "./lib/private-paths";
import {
  CROSS_ORIGIN_OPENER_POLICY,
  CROSS_ORIGIN_RESOURCE_POLICY,
  contentSecurityPolicy,
  cspIntegrations,
} from "./lib/security-headers";

/**
 * The Workers runtime exposes `caches.default` (the per-colo edge cache),
 * which the DOM CacheStorage typing used by `astro check` does not know.
 */
function edgeCache(): { match: Cache["match"]; put: Cache["put"] } | null {
  const runtimeCaches = (globalThis as unknown as { caches?: { default?: Cache } }).caches;
  const cache = runtimeCaches?.default;
  return cache ? { match: cache.match.bind(cache), put: cache.put.bind(cache) } : null;
}

setPracticeLibraryStore(practiceLibraryD1Store);

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isAdminApi(pathname: string): boolean {
  return pathname.startsWith("/api/admin/");
}

/**
 * Applies the security baseline to every response, including middleware
 * early-returns (auth failures, maintenance, redirects) that never reach the
 * page renderer. Headers are idempotent, so asset and API responses share it.
 */
function applySecurityHeaders(response: Response, pathname: string): Response {
  // Response.redirect() (and some runtime-generated responses) expose immutable
  // headers. Copy them into a mutable set before adding the security policy.
  const headers = new Headers(response.headers);
  headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  // A route may ship a stricter policy (media responses use
  // `default-src 'none'; sandbox`). Never widen it with the site-wide policy.
  if (!headers.has("content-security-policy")) {
    headers.set(
      "content-security-policy",
      contentSecurityPolicy(cspIntegrations(env)),
    );
  }
  headers.set("cross-origin-opener-policy", CROSS_ORIGIN_OPENER_POLICY);
  headers.set("cross-origin-resource-policy", CROSS_ORIGIN_RESOURCE_POLICY);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-frame-options", "SAMEORIGIN");
  headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  if (isPrivatePath(pathname)) {
    headers.set("x-robots-tag", "noindex, nofollow");
    // Private HTML (attempts, results, dashboards, auth) and authenticated
    // APIs must never be stored by a browser, shared proxy or the edge cache.
    // Public pages keep whatever cache policy the route or _headers assigned.
    headers.set("cache-control", "no-store");
    headers.set("pragma", "no-cache");
  }
  const body = response.status === 204 || response.status === 304 ? null : response.body;
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function maintenanceEnabled(): Promise<boolean> {
  return (await getSetting("maintenance_mode", "false")) === "true";
}

async function resolveAdmin(context: APIContext) {
  const bootstrapEmail = String(
    (env as unknown as Record<string, unknown>).BOOTSTRAP_SUPER_ADMIN_EMAIL ?? "",
  )
    .trim()
    .toLowerCase();

  const maybeBootstrap = async (email: string) => {
    if (!bootstrapEmail || email.toLowerCase() !== bootstrapEmail) return null;
    return bootstrapSuperAdmin(email);
  };

  const hasAccessJwt = Boolean(context.request.headers.get("cf-access-jwt-assertion"));
  if (accessModeEnabled() || hasAccessJwt) {
    const identity = await verifyAccessRequest(context.request);
    if (!identity) return null;
    return (await getAdminByEmail(identity.email)) ?? (await maybeBootstrap(identity.email));
  }

  if (!context.locals.user) return null;
  const admin = await getAdminForUser(context.locals.user);
  return admin ?? (await maybeBootstrap(context.locals.user.email));
}

export const onRequest = defineMiddleware(async (context, next) => {
  const requestedPath = context.url.pathname;

  // Workers routes are reachable over plain HTTP; browsers and crawlers must not
  // see a second origin. Local development is exempt.
  const hostname = context.url.hostname;
  const localHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";

  // Alternate hosts (the workers.dev preview URL and www) permanently redirect
  // to the configured SITE_URL origin. Running before the HTTPS upgrade keeps
  // plain-HTTP preview requests to a single hop. Only reads are redirected so a
  // form POST to a preview host is never converted into a GET.
  const isReadRequest = context.request.method === "GET" || context.request.method === "HEAD";
  if (!localHost && isReadRequest) {
    const canonicalTarget = canonicalHostRedirect(context.url, env.SITE_URL);
    if (canonicalTarget) {
      return applySecurityHeaders(Response.redirect(canonicalTarget.toString(), 301), requestedPath);
    }
  }

  if (context.url.protocol === "http:" && !localHost) {
    const httpsUrl = new URL(context.url.toString());
    httpsUrl.protocol = "https:";
    return applySecurityHeaders(Response.redirect(httpsUrl.toString(), 301), requestedPath);
  }

  // Duplicate content: /path/ and /path both returned a self-canonical 200.
  // Send the slashed variant to the canonical no-slash URL instead.
  if (!localHost && isReadRequest) {
    const slashTarget = trailingSlashRedirect(context.url, context.request.method);
    if (slashTarget) {
      return applySecurityHeaders(Response.redirect(slashTarget.toString(), 301), requestedPath);
    }
  }

  // The library moved from /practice to /mock-tests. Keep old links and
  // short-form /mock-test URLs working with a permanent redirect.
  for (const legacyPrefix of ["/practice", "/mock-test"]) {
    if (requestedPath === legacyPrefix || requestedPath.startsWith(`${legacyPrefix}/`)) {
      const target = `/mock-tests${requestedPath.slice(legacyPrefix.length)}${context.url.search}`;
      return applySecurityHeaders(context.redirect(target, 301), requestedPath);
    }
  }

  // Edge cache: anonymous GETs on production content pages are served from
  // the Cloudflare edge cache when a recent copy exists (5-minute TTL, 6-hour
  // for the sitemap), and fresh 200 HTML/XML responses are stored for the next
  // visitor. Cuts the TTFB of content pages from ~700-1200ms to ~50ms and
  // keeps those D1 reads out of the daily quota. Dev, preview and E2E
  // environments skip this entirely.
  const currentEnvironment = String(
    (env as unknown as Record<string, unknown>).ENV ?? "",
  ).trim().toLowerCase();
  const edgeCacheable =
    shouldAttemptEdgeCache({
      method: context.request.method,
      pathname: requestedPath,
      search: context.url.search,
      hasSessionCookie: Boolean(context.cookies.get("cuet_session")?.value),
      isProduction: currentEnvironment === "production",
    });

  const cache = edgeCacheable ? edgeCache() : null;
  const cacheKey = cache ? edgeCacheKeyRequest(context.request) : null;
  if (cache && cacheKey) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) {
        const hit = applySecurityHeaders(cached, requestedPath);
        hit.headers.set("x-edge-cache", "HIT");
        return hit;
      }
    } catch (error) {
      console.error("Edge cache lookup failed; serving normally.", error);
    }
  }

  const { result: response, metrics } = await trackDbMetrics(async () => {
    const { pathname } = context.url;

  const envRecord = (env as unknown as Record<string, unknown>) || {};
  const currentEnv = String(envRecord.ENV ?? process.env.ENV ?? "").trim().toLowerCase();

  // Production Guard 1: /dev/* routes must 404 in production
  if (pathname === "/dev" || pathname.startsWith("/dev/")) {
    if (currentEnv === "production") {
      return new Response("Not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
  }

  // Production Guard 2: Admin routes require Cloudflare Access in production unless overridden
  if (isAdminPath(pathname) || isAdminApi(pathname)) {
    const adminAuthMode = String(envRecord.ADMIN_AUTH_MODE ?? process.env.ADMIN_AUTH_MODE ?? "session").trim().toLowerCase();
    const allowSessionInProd = String(envRecord.ADMIN_ALLOW_SESSION_IN_PROD ?? process.env.ADMIN_ALLOW_SESSION_IN_PROD ?? "").trim() === "1";

    if (currentEnv === "production" && adminAuthMode === "session" && !allowSessionInProd) {
      const errorMsg = "Admin access via session cookie is disabled in production. Cloudflare Access (JWT) authentication is required. (Set ADMIN_ALLOW_SESSION_IN_PROD=1 to override).";
      if (isAdminApi(pathname)) {
        return new Response(JSON.stringify({ error: errorMsg }), {
          status: 503,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      }
      return new Response(errorMsg, {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
  }

  try {
    await ensurePracticeLibrary();
  } catch (error) {
    console.error("Practice library warm-up failed.", error);
  }

  context.locals.user = await getSessionUser(context.cookies);
  context.locals.admin = await resolveAdmin(context);

  if (isAdminPath(pathname) || isAdminApi(pathname)) {
    const accessOnly = accessModeEnabled();
    if (!context.locals.admin) {
      if (isAdminApi(pathname)) {
        return new Response(
          JSON.stringify({
            error: accessOnly
              ? "Cloudflare Access authentication is required."
              : context.locals.user
                ? "This account is not an admin."
                : "Login required.",
          }),
          {
            status: accessOnly || context.locals.user ? 403 : 401,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          },
        );
      }
      if (accessOnly) {
        return new Response("Cloudflare Access authentication is required.", {
          status: 403,
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
        });
      }
      if (!context.locals.user) {
        const nextPath = `${pathname}${context.url.search}`;
        return context.redirect(`/login?next=${encodeURIComponent(nextPath)}`, 303);
      }
      return context.redirect("/forbidden", 303);
    }
  }

  if (
    !isAdminApi(pathname) &&
    !isAdminPath(pathname) &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/attempt/") &&
    (await maintenanceEnabled())
  ) {
    if (pathname !== "/maintenance") {
      return context.rewrite("/maintenance");
    }
  }

    const response = await next();
    const degraded = response.headers.get(DB_DEGRADED_HEADER) === "1";

    // Only anonymous HTML may enter the PWA page cache. Personalized responses
    // (logged-in navigation, attempts, results, dashboards) are never marked.
    const contentType = response.headers.get("content-type") ?? "";
    if (
      context.request.method === "GET" &&
      response.status === 200 &&
      !degraded &&
      !context.locals.user &&
      !isPrivatePath(pathname) &&
      contentType.includes("text/html")
    ) {
      response.headers.set("x-pwa-cacheable", "1");
    }

    return response;
  }, context.url.pathname);

  // applySecurityHeaders rebuilds the response, so keep the returned copy and
  // add the database instrumentation headers to it rather than the original.
  const secured = applySecurityHeaders(response, requestedPath);

  // A page that rendered a bundled fallback is still a 200, but its content is
  // stale by definition. Never let it enter the edge cache or a browser cache.
  const degraded = secured.headers.get(DB_DEGRADED_HEADER) === "1";
  if (degraded) {
    secured.headers.set("cache-control", "no-store");
    secured.headers.delete("x-pwa-cacheable");
  }

  // Attach database instrumentation headers for measurement and observability
  secured.headers.set("x-db-rows-read", String(metrics.rowsRead));
  secured.headers.set("x-db-rows-written", String(metrics.rowsWritten));
  secured.headers.set("x-db-queries", String(metrics.queryCount));

  if (
    metrics.queryCount > 0 &&
    (import.meta.env.DEV || (typeof env !== "undefined" && (env as unknown as Record<string, unknown>).ENV !== "production"))
  ) {
    console.log(
      `[DB] ${context.request.method} ${context.url.pathname} -> read=${metrics.rowsRead} written=${metrics.rowsWritten} queries=${metrics.queryCount}`,
    );
  }

  // Store fresh anonymous 200 responses in the edge cache: HTML pages for 5
  // minutes, the sitemap for 6 hours. Strip Set-Cookie so one visitor's
  // cookies are never served to another.
  if (cache && cacheKey && secured.status === 200 && !degraded) {
    const contentType = secured.headers.get("content-type") ?? "";
    const cacheableType = isEdgeCacheableContentType(contentType);
    if (cacheableType && !secured.headers.has("set-cookie")) {
      const cacheTtl = edgeCacheTtlForPath(requestedPath);
      // The first anonymous visitor after a cache miss gets the same bounded
      // browser TTL as the stored copy. Without this, Cloudflare's zone-level
      // Browser Cache TTL decides how long that visitor keeps stale HTML.
      secured.headers.set("cache-control", `public, max-age=${cacheTtl}`);
      try {
        const headers = new Headers(secured.headers);
        headers.delete("set-cookie");
        headers.set("cache-control", `public, max-age=${cacheTtl}`);
        await cache.put(
          cacheKey,
          new Response(secured.clone().body, {
            status: secured.status,
            headers,
          }),
        );
        secured.headers.set("x-edge-cache", "STORED");
      } catch (error) {
        console.error("Edge cache store failed; serving normally.", error);
      }
    }
  }

  return secured;
});
