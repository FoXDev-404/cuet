import type { APIContext } from "astro";
import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { bootstrapSuperAdmin, getAdminByEmail, getAdminForUser } from "./lib/auth/admin";
import { accessModeEnabled, verifyAccessRequest } from "./lib/auth/access";
import { getSessionUser } from "./lib/auth/session";
import { ensurePracticeLibrary, setPracticeLibraryStore } from "./lib/practice-library";
import { practiceLibraryD1Store } from "./lib/practice-store-d1";
import { getSetting } from "./lib/settings";

setPracticeLibraryStore(practiceLibraryD1Store);

const NOINDEX_PREFIXES = [
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
  const { pathname } = context.url;

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

  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set("x-frame-options", "SAMEORIGIN");
  response.headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  if (isPrivatePath(pathname)) {
    response.headers.set("x-robots-tag", "noindex, nofollow");
  }

  return response;
});
