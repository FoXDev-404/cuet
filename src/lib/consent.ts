/**
 * Optional analytics consent.
 *
 * The choice lives in `localStorage` so the HTML stays anonymous and
 * edge-cacheable: no cookie, no server round-trip, no per-visitor variant.
 * Missing, malformed and future-version values all mean "no decision" and
 * therefore no analytics. Nothing here throws.
 */
import { ga4MeasurementId, gtmContainerId, type IntegrationEnv } from "./integrations";
import { isPrivatePath } from "./private-paths";

export const CONSENT_STORAGE_KEY = "cuet_consent_v1";
export const CONSENT_GRANTED = "v1:analytics=1";
export const CONSENT_DENIED = "v1:analytics=0";

export type ConsentChoice = "granted" | "denied" | null;

export function parseConsent(raw: string | null | undefined): ConsentChoice {
  if (raw === CONSENT_GRANTED) return "granted";
  if (raw === CONSENT_DENIED) return "denied";
  return null;
}

export function serializeConsent(granted: boolean): string {
  return granted ? CONSENT_GRANTED : CONSENT_DENIED;
}

/** True only when a valid GA4 or GTM id is configured on this deployment. */
export function consentRequired(envLike: IntegrationEnv): boolean {
  return Boolean(ga4MeasurementId(envLike) || gtmContainerId(envLike));
}

/**
 * The consent UI is page-only: no API route and no private route may render
 * it. Accepts a pathname or a path with a query/hash and normalises both.
 */
export function consentUiAllowed(pathname: string): boolean {
  const path = pathname.split(/[?#]/, 1)[0] || "/";
  if (path === "/api" || path.startsWith("/api/")) return false;
  return !isPrivatePath(path);
}
