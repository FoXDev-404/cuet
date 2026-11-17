/**
 * Content Security Policy built from the integrations that are actually
 * configured.
 *
 * Ads and analytics are optional and off by default. Their hosts must not sit
 * in the allow-list when the integration is dormant: an allow-list entry is an
 * invitation, and every extra host is another origin that could execute code
 * if a page is ever compromised. Keeping the builder pure makes the exact
 * policy testable without a Workers runtime.
 *
 * `'unsafe-inline'` for scripts and styles is still required. Astro emits
 * inline bootstrap scripts, several components use `is:inline` feature
 * detectors (theme, consent, share), and dynamic `style=` attributes cannot be
 * nonced. Moving to nonces/hashes is a separate, larger migration tracked in
 * AUDIT.md; dropping the directive now would break auth and consent.
 */
import {
  adsenseClient,
  adsenseCmpActive,
  adsenseSlot,
  ga4MeasurementId,
  gtmContainerId,
  type IntegrationEnv,
} from "./integrations";

export type CspIntegrations = {
  /** AdSense client, slot and CMP attestation are all valid. */
  ads: boolean;
  /** GTM or GA4 is configured; the consent gate still decides per visitor. */
  analytics: boolean;
};

/**
 * Allows Google OAuth popups to keep an opener while isolating cross-origin
 * windows. `same-origin` would break popup-based sign-in.
 */
export const CROSS_ORIGIN_OPENER_POLICY = "same-origin-allow-popups";

/**
 * Stops other origins from embedding Worker-rendered responses such as media
 * uploads as subresources. Navigations and server-side social crawlers are
 * unaffected.
 */
export const CROSS_ORIGIN_RESOURCE_POLICY = "same-origin";

const BASE_SCRIPT_SRC = [
  "'self'",
  // Astro's inline bootstrap and the app's inline feature detectors.
  "'unsafe-inline'",
  "https://accounts.google.com",
  "https://apis.google.com",
  "https://www.google.com",
  // Cloudflare Web Analytics is unconditional, cookieless and first-party
  // configured, so it stays allowed on every page.
  "https://static.cloudflareinsights.com",
];

const BASE_CONNECT_SRC = [
  "'self'",
  "https://*.googleapis.com",
  "https://*.firebaseio.com",
  "https://identitytoolkit.googleapis.com",
  "https://securetoken.googleapis.com",
  "https://www.google.com",
  "https://cloudflareinsights.com",
  "https://*.cloudflareinsights.com",
];

const BASE_FRAME_SRC = [
  "'self'",
  "https://accounts.google.com",
  "https://www.google.com",
  "https://*.firebaseapp.com",
];

const ANALYTICS_SCRIPT_SRC = ["https://www.googletagmanager.com"];

const ANALYTICS_CONNECT_SRC = [
  "https://www.google-analytics.com",
  "https://*.google-analytics.com",
  "https://analytics.google.com",
];

const ANALYTICS_FRAME_SRC = ["https://www.googletagmanager.com"];

const ADS_SCRIPT_SRC = [
  "https://pagead2.googlesyndication.com",
  "https://*.googlesyndication.com",
  "https://*.googleadservices.com",
  "https://*.doubleclick.net",
  "https://adservice.google.com",
  "https://fundingchoicesmessages.google.com",
];

const ADS_CONNECT_SRC = [
  "https://pagead2.googlesyndication.com",
  "https://*.googlesyndication.com",
  "https://*.googleadservices.com",
  "https://*.doubleclick.net",
  "https://adservice.google.com",
  "https://fundingchoicesmessages.google.com",
];

const ADS_FRAME_SRC = [
  "https://googleads.g.doubleclick.net",
  "https://tpc.googlesyndication.com",
  "https://*.googlesyndication.com",
  "https://*.doubleclick.net",
  "https://fundingchoicesmessages.google.com",
];

/** Resolve the live integration state from an env-like object. */
export function cspIntegrations(envLike: IntegrationEnv): CspIntegrations {
  return {
    ads:
      Boolean(adsenseClient(envLike)) &&
      Boolean(adsenseSlot(envLike)) &&
      adsenseCmpActive(envLike),
    analytics: Boolean(gtmContainerId(envLike) || ga4MeasurementId(envLike)),
  };
}

/** Build the one CSP string applied to every Worker response. */
export function contentSecurityPolicy(state: CspIntegrations): string {
  const scriptSrc = [
    ...BASE_SCRIPT_SRC,
    ...(state.analytics ? ANALYTICS_SCRIPT_SRC : []),
    ...(state.ads ? ADS_SCRIPT_SRC : []),
  ];
  const connectSrc = [
    ...BASE_CONNECT_SRC,
    ...(state.analytics ? ANALYTICS_CONNECT_SRC : []),
    ...(state.ads ? ADS_CONNECT_SRC : []),
  ];
  const frameSrc = [
    ...BASE_FRAME_SRC,
    ...(state.analytics ? ANALYTICS_FRAME_SRC : []),
    ...(state.ads ? ADS_FRAME_SRC : []),
  ];

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSrc.join(" ")}`,
    `connect-src ${connectSrc.join(" ")}`,
    `frame-src ${frameSrc.join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self'",
  ].join("; ");
}
