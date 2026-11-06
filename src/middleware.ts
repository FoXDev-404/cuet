import type { APIContext } from "astro";
import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { bootstrapSuperAdmin, getAdminByEmail, getAdminForUser } from "./lib/auth/admin";
import { accessModeEnabled, verifyAccessRequest } from "./lib/auth/access";
import { getSessionUser } from "./lib/auth/session";
import { ensurePracticeLibrary, setPracticeLibraryStore } from "./lib/practice-library";
import { practiceLibraryD1Store } from "./lib/practice-store-d1";
import { getSetting } from "./lib/settings";
import { trackD1Metrics } from "./lib/db";
import { canonicalHostRedirect, trailingSlashRedirect } from "./lib/canonical-host";

setPracticeLibraryStore(practiceLibraryD1Store);

const NOINDEX_PREFIXES = [
  "/dev",
  "/admin",
  "/api/admin",
  "/api/attempts",
  "/api/results",
  "/api/auth",
  "/attempt",
  "/result",
  "/dashboard",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/search",
  "/api/bookmarks",
  "/api/account",
  "/api/me",
  "/api/discussions",
  "/api/leaderboards",
];

function isPrivatePath(pathname: string): boolean {
  return NOINDEX_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isAdminApi(pathname: string): boolean {
  return pathname.startsWith("/api/admin/");
}

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com https://www.google.com https://www.googletagmanager.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.googleadservices.com https://*.doubleclick.net https://adservice.google.com https://fundingchoicesmessages.google.com",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.google-analytics.com https://region1.google-analytics.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.googleadservices.com https://*.doubleclick.net https://adservice.google.com https://fundingchoicesmessages.google.com",
  "frame-src 'self' https://accounts.google.com https://www.google.com https://*.firebaseapp.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://*.googlesyndication.com https://*.doubleclick.net https://fundingchoicesmessages.google.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self'",
].join("; ");

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
  headers.set("content-security-policy", CONTENT_SECURITY_POLICY);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-frame-options", "SAMEORIGIN");
  headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  if (isPrivatePath(pathname)) {
    headers.set("x-robots-tag", "noindex, nofollow");
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

  const { result: response, metrics } = await trackD1Metrics(async () => {
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

    // Only anonymous HTML may enter the PWA page cache. Personalized responses
    // (logged-in navigation, attempts, results, dashboards) are never marked.
    const contentType = response.headers.get("content-type") ?? "";
    if (
      context.request.method === "GET" &&
      response.status === 200 &&
      !context.locals.user &&
      !isPrivatePath(pathname) &&
      contentType.includes("text/html")
    ) {
      response.headers.set("x-pwa-cacheable", "1");
    }

    return response;
  }, context.url.pathname);

  // applySecurityHeaders rebuilds the response, so keep the returned copy and
  // add the D1 instrumentation headers to it rather than the original.
  const secured = applySecurityHeaders(response, requestedPath);

  // Attach D1 instrumentation headers for measurement and observability
  secured.headers.set("x-d1-rows-read", String(metrics.rowsRead));
  secured.headers.set("x-d1-rows-written", String(metrics.rowsWritten));
  secured.headers.set("x-d1-queries", String(metrics.queryCount));

  if (
    metrics.queryCount > 0 &&
    (import.meta.env.DEV || (typeof env !== "undefined" && (env as unknown as Record<string, unknown>).ENV !== "production"))
  ) {
    console.log(
      `[D1] ${context.request.method} ${context.url.pathname} -> read=${metrics.rowsRead} written=${metrics.rowsWritten} queries=${metrics.queryCount}`,
    );
  }

  return secured;
});
