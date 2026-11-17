import type { AstroCookieSetOptions, AstroCookies } from "astro";

/**
 * Session and guest cookies use the `__Host-` prefix so a browser rejects a
 * cookie whose Domain is set, whose Path is not `/`, or that is missing
 * `Secure`. The legacy unprefixed names stay readable for one rollout window:
 * a valid legacy token is promoted to the prefixed name on its next use, so
 * existing sessions are not signed out.
 */
export const SESSION_COOKIE = "__Host-cuet_session";
export const GUEST_COOKIE = "__Host-cuet_guest";
export const LEGACY_SESSION_COOKIE = "cuet_session";
export const LEGACY_GUEST_COOKIE = "cuet_guest";

const GUEST_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const HOST_COOKIE: AstroCookieSetOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
};

const HOST_COOKIE_DELETE = {
  path: "/",
  secure: true,
} as const;

export type SessionToken = {
  token: string;
  legacy: boolean;
};

export type GuestToken = {
  token: string;
  legacy: boolean;
};

export function hasSessionCookie(cookies: AstroCookies): boolean {
  return Boolean(
    cookies.get(SESSION_COOKIE)?.value ?? cookies.get(LEGACY_SESSION_COOKIE)?.value,
  );
}

export function readSessionToken(cookies: AstroCookies): SessionToken | null {
  const current = cookies.get(SESSION_COOKIE)?.value;
  if (current) return { token: current, legacy: false };

  const legacy = cookies.get(LEGACY_SESSION_COOKIE)?.value;
  if (legacy) return { token: legacy, legacy: true };

  return null;
}

export function writeSessionCookie(
  cookies: AstroCookies,
  token: string,
  expires?: Date,
): void {
  cookies.set(SESSION_COOKIE, token, expires ? { ...HOST_COOKIE, expires } : HOST_COOKIE);
}

/**
 * Moves a valid legacy token to the `__Host-` name. The old cookie is deleted
 * in the same response so a browser does not keep sending both.
 */
export function promoteSessionCookie(
  cookies: AstroCookies,
  token: string,
  expires?: Date,
): void {
  writeSessionCookie(cookies, token, expires);
  cookies.delete(LEGACY_SESSION_COOKIE, HOST_COOKIE_DELETE);
}

export function clearSessionCookies(cookies: AstroCookies): void {
  cookies.delete(SESSION_COOKIE, HOST_COOKIE_DELETE);
  cookies.delete(LEGACY_SESSION_COOKIE, HOST_COOKIE_DELETE);
}

export function isGuestToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{20,80}$/.test(value);
}

export function readGuestToken(cookies: AstroCookies): GuestToken | null {
  const current = cookies.get(GUEST_COOKIE)?.value;
  if (current) return { token: current, legacy: false };

  const legacy = cookies.get(LEGACY_GUEST_COOKIE)?.value;
  if (legacy) return { token: legacy, legacy: true };

  return null;
}

export function writeGuestCookie(cookies: AstroCookies, token: string): void {
  cookies.set(GUEST_COOKIE, token, {
    ...HOST_COOKIE,
    maxAge: GUEST_MAX_AGE_SECONDS,
  });
}

/** Same one-response promotion as the session cookie, for `cuet_guest`. */
export function promoteGuestCookie(cookies: AstroCookies, token: string): void {
  writeGuestCookie(cookies, token);
  cookies.delete(LEGACY_GUEST_COOKIE, HOST_COOKIE_DELETE);
}

export function clearGuestCookies(cookies: AstroCookies): void {
  cookies.delete(GUEST_COOKIE, HOST_COOKIE_DELETE);
  cookies.delete(LEGACY_GUEST_COOKIE, HOST_COOKIE_DELETE);
}
