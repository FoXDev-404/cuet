/**
 * Edge caching for anonymous public pages.
 *
 * On production, GET requests without a session cookie are served from and
 * stored into the Cloudflare edge cache (Cache API) with a short TTL. This
 * cuts the TTFB of content pages from ~700-1200ms (SSR + D1) to ~50ms and
 * removes the corresponding D1 reads from the daily quota.
 *
 * Rules:
 *  - Production only. Local dev, preview and E2E runs skip caching entirely,
 *    so test assertions always see freshly rendered pages.
 *  - Signed-in users skip caching (their header navigation is personalized).
 *  - URLs with query strings skip caching (filters change the result).
 *  - Only content prefixes are cached; attempts, APIs, dashboards, auth pages
 *    and user profiles are never stored at the edge.
 *  - TTL is 5 minutes, bounded staleness for admin edits without purge logic.
 */

export const EDGE_CACHE_TTL_SECONDS = 300;

const EDGE_CACHEABLE_PREFIXES = [
  "/mock-tests",
  "/blog",
  "/cuet-ug-previous-year-papers",
  "/cuet-ug-syllabus",
  "/cuet-ug-exam-pattern",
  "/cuet-ug-marking-scheme",
  "/cuet-ug-important-dates",
  "/cuet-ug-mock-test",
  "/cuet-mock-test",
  "/leaderboard",
  "/pyq",
  "/about",
  "/contact",
  "/privacy-policy",
  "/terms",
  "/disclaimer",
];

export function isEdgeCacheablePath(pathname: string): boolean {
  if (pathname === "/") return true;
  return EDGE_CACHEABLE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function shouldAttemptEdgeCache(options: {
  method: string;
  pathname: string;
  search: string;
  hasSessionCookie: boolean;
  isProduction: boolean;
}): boolean {
  const { method, pathname, search, hasSessionCookie, isProduction } = options;
  if (!isProduction) return false;
  if (method !== "GET" && method !== "HEAD") return false;
  if (hasSessionCookie) return false;
  if (search) return false;
  return isEdgeCacheablePath(pathname);
}

export const EDGE_CACHE_CONTROL = `public, max-age=${EDGE_CACHE_TTL_SECONDS}`;
