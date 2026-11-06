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
  return target;
}
