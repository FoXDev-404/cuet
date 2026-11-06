/**
 * Canonical-host redirects.
 *
 * The Worker is reachable on its `*.workers.dev` preview host and, once the
 * custom domain is attached, on `www.`. Search engines must only see the
 * configured `SITE_URL` origin, so those alternates permanently redirect to it.
 *
 * Returns null when the request already targets the canonical host, when
 * SITE_URL is missing/invalid, or when the host is unrelated (for example a
 * local dev host or a staging domain).
 */
export function canonicalHostRedirect(
  requestUrl: URL,
  configuredSiteUrl: string | null | undefined,
): URL | null {
  const configured = (configuredSiteUrl ?? "").trim();
  if (!configured) return null;

  let canonical: URL;
  try {
    canonical = new URL(configured);
  } catch {
    return null;
  }
  if (canonical.protocol !== "https:" && canonical.protocol !== "http:") return null;

  const host = requestUrl.hostname.toLowerCase();
  const canonicalHost = canonical.hostname.toLowerCase();
  if (!host || !canonicalHost || host === canonicalHost) return null;

  const isWorkerHost = host.endsWith(".workers.dev");
  const isWwwAlias = host === `www.${canonicalHost}`;
  if (!isWorkerHost && !isWwwAlias) return null;

  const target = new URL(requestUrl.toString());
  target.protocol = canonical.protocol;
  target.hostname = canonical.hostname;
  target.port = canonical.port;
  target.hash = "";
  // Canonical URLs never carry a trailing slash (except the root).
  if (target.pathname !== "/" && target.pathname.endsWith("/")) {
    target.pathname = target.pathname.replace(/\/+$/, "");
  }
  return target;
}

/**
 * Normalise GET/HEAD requests that end in a slash to the canonical no-slash
 * form. API, asset and well-known paths are left alone, and mutations are never
 * redirected.
 */
export function trailingSlashRedirect(requestUrl: URL, method: string): URL | null {
  if (method !== "GET" && method !== "HEAD") return null;

  const { pathname } = requestUrl;
  if (pathname === "/" || !pathname.endsWith("/")) return null;
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_astro/") ||
    pathname.startsWith("/cdn-cgi/") ||
    pathname.startsWith("/.well-known/")
  ) {
    return null;
  }

  const lastSegment = pathname.slice(0, -1).split("/").pop() ?? "";
  if (lastSegment.includes(".")) return null;

  const target = new URL(requestUrl.toString());
  target.pathname = pathname.replace(/\/+$/, "") || "/";
  target.hash = "";
  return target;
}
