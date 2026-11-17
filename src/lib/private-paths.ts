/**
 * Routes that must never be indexed and that opt out of non-essential
 * analytics. The middleware and the consent gate share this list so the two
 * can never disagree about what counts as private.
 */
export const NOINDEX_PREFIXES = [
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
] as const;

export function isPrivatePath(pathname: string): boolean {
  return NOINDEX_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
