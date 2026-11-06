/**
 * Optional public integrations.
 *
 * Every helper accepts a plain env-like object so the absent, malformed and
 * configured paths can be tested without a Workers runtime. Callers pass the
 * real `cloudflare:workers` env at the edge. Nothing here throws: an unset or
 * suspicious value simply yields an empty string, which means "emit nothing".
 */

export type IntegrationEnv = {
  CF_ANALYTICS_TOKEN?: string;
  GSC_VERIFICATION?: string;
  ADSENSE_CLIENT?: string;
  ADSENSE_SLOT_ID?: string;
};

const PUBLIC_TOKEN = /^[A-Za-z0-9_-]{16,128}$/;
const GSC_TOKEN = /^[A-Za-z0-9_-]{10,120}$/;
const ADSENSE_CLIENT = /^ca-pub-\d{10,20}$/;
const ADSENSE_SLOT = /^\d{6,20}$/;

/** Placeholder strings such as TODO_VERIFY must never activate a script. */
function clean(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  if (/TODO|VERIFY|PLACEHOLDER|CHANGEME|EXAMPLE/i.test(trimmed)) return "";
  return trimmed;
}

/** Cloudflare Web Analytics beacon token. */
export function analyticsToken(envLike: IntegrationEnv): string {
  const token = clean(envLike.CF_ANALYTICS_TOKEN);
  return PUBLIC_TOKEN.test(token) ? token : "";
}

/**
 * Google Search Console verification content.
 *
 * Accepts the bare token, `google-site-verification=<token>` or a full
 * `<meta name="google-site-verification" content="...">` tag so an operator can
 * paste whichever form the Search Console UI shows.
 */
export function googleSiteVerification(envLike: IntegrationEnv): string {
  const raw = clean(envLike.GSC_VERIFICATION);
  if (!raw) return "";

  const meta = raw.match(/content\s*=\s*["']([^"']+)["']/i);
  if (meta) {
    const value = meta[1].trim();
    return GSC_TOKEN.test(value) ? value : "";
  }

  const parameter = raw.match(/^(?:google-site-verification=)?([A-Za-z0-9_-]+)$/i);
  const value = parameter?.[1] ?? "";
  return GSC_TOKEN.test(value) ? value : "";
}

/** AdSense publisher client, e.g. `ca-pub-1234567890123456`. */
export function adsenseClient(envLike: IntegrationEnv): string {
  const client = clean(envLike.ADSENSE_CLIENT);
  return ADSENSE_CLIENT.test(client) ? client : "";
}

/** Numeric AdSense ad-unit slot. Manual slots stay off until this is set. */
export function adsenseSlot(envLike: IntegrationEnv): string {
  const slot = clean(envLike.ADSENSE_SLOT_ID);
  return ADSENSE_SLOT.test(slot) ? slot : "";
}

/** The one-line ads.txt record required for an AdSense publisher. */
export function adsTxtRecord(client: string): string | null {
  if (!ADSENSE_CLIENT.test(client)) return null;
  return `google.com, ${client.slice("ca-".length)}, DIRECT, f08c47fec0942fa0`;
}

/**
 * Ads are on by default for every indexable public page. Private or thin
 * pages opt out automatically through `noindex`, and an explicit `ads` prop
 * still wins when a page needs to override the default.
 */
export function shouldServeAds(explicit: boolean | undefined, robots: string): boolean {
  return explicit ?? !/noindex/i.test(robots);
}

/**
 * Routes that must never receive an ad unit.
 *
 * This is a second line of defence. Ads default on for public pages, so this
 * guard blocks private, attempt, result, dashboard, auth, search, styleguide
 * and user-profile routes even if a slot is placed too broadly. Practice paper
 * pages stay ad-free until their rights are cleared; the `/mock-tests` hub
 * itself carries no paper content and may show ads.
 */
const BLOCKED_AD_PATHS: RegExp[] = [
  /^\/admin(?:\/|$)/,
  /^\/api(?:\/|$)/,
  /^\/attempt(?:\/|$)/,
  /^\/result(?:\/|$)/,
  /^\/dashboard(?:\/|$)/,
  /^\/login(?:\/|$)/,
  /^\/signup(?:\/|$)/,
  /^\/forgot-password(?:\/|$)/,
  /^\/reset-password(?:\/|$)/,
  /^\/verify-email(?:\/|$)/,
  /^\/search(?:\/|$)/,
  /^\/mock-tests\/.+/,
  /^\/u(?:\/|$)/,
  /^\/dev(?:\/|$)/,
  /\/take(?:\/|$)/,
];

export function adSlotAllowed(pathname: string): boolean {
  const path = pathname.split(/[?#]/, 1)[0] ?? "";
  if (!path.startsWith("/")) return false;
  return !BLOCKED_AD_PATHS.some((pattern) => pattern.test(path));
}
