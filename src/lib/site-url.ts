import { env } from "cloudflare:workers";

/**
 * Resolve the canonical origin for the current request.
 *
 * Deployed environments must set the runtime `SITE_URL` binding. Local dev falls
 * back to the request origin so canonicals never point at a deployed host.
 */
export function siteUrl(requestUrl: URL | string): URL {
  if (!import.meta.env.DEV) {
    const configured = (env.SITE_URL ?? "").trim();
    if (!configured) {
      throw new Error(
        "SITE_URL is not configured. Set it in wrangler.jsonc or the Worker environment before deploying.",
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(configured);
    } catch {
      throw new Error(`SITE_URL must be an absolute URL; received "${configured}".`);
    }
    const protocol = parsed.protocol;
    if (protocol !== "https:" && protocol !== "http:") {
      throw new Error(`SITE_URL must use http or https; received "${configured}".`);
    }
    return parsed;
  }
  return new URL(new URL(requestUrl).origin);
}
