import type { AstroCookies } from "astro";
import { first, run } from "../db";
import {
  LEGACY_SESSION_COOKIE,
  SESSION_COOKIE,
  clearGuestCookies,
  clearSessionCookies,
  isGuestToken,
  promoteGuestCookie,
  promoteSessionCookie,
  readGuestToken,
  readSessionToken,
  writeGuestCookie,
  writeSessionCookie,
} from "./cookies";

export {
  GUEST_COOKIE,
  LEGACY_GUEST_COOKIE,
  LEGACY_SESSION_COOKIE,
  SESSION_COOKIE,
  clearGuestCookies,
  hasSessionCookie,
} from "./cookies";

const SESSION_DAYS = 30;

export type SessionUser = {
  id: number;
  username: string;
  email: string;
};

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function randomToken(byteLength = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createSession(
  cookies: AstroCookies,
  userId: number,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await run(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
    await sha256Hex(token),
    userId,
    expiresAt.toISOString(),
  );
  writeSessionCookie(cookies, token, expiresAt);
  return { token, expiresAt };
}

export async function getSessionUser(cookies: AstroCookies): Promise<SessionUser | null> {
  const current = readSessionToken(cookies);
  if (!current) return null;
  try {
    const row = await first<SessionUser & { expires_at: string }>(
      `SELECT u.id, u.username, u.email, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ? AND u.deleted_at IS NULL AND u.banned_at IS NULL`,
      await sha256Hex(current.token),
      new Date().toISOString(),
    );
    if (!row) return null;

    // Promote a legacy cookie without forcing the user to sign in again.
    if (current.legacy) {
      const expires = new Date(row.expires_at);
      promoteSessionCookie(
        cookies,
        current.token,
        Number.isNaN(expires.getTime()) ? undefined : expires,
      );
    }

    return { id: row.id, username: row.username, email: row.email };
  } catch {
    return null;
  }
}

export async function destroySession(cookies: AstroCookies): Promise<void> {
  const tokens = new Set(
    [cookies.get(SESSION_COOKIE)?.value, cookies.get(LEGACY_SESSION_COOKIE)?.value].filter(
      (token): token is string => Boolean(token),
    ),
  );
  for (const token of tokens) {
    try {
      await run("DELETE FROM sessions WHERE id = ?", await sha256Hex(token));
    } catch {
      // A missing session row is already logged out.
    }
  }
  clearSessionCookies(cookies);
}

export function getGuestToken(cookies: AstroCookies): string | null {
  const current = readGuestToken(cookies);
  if (!current || !isGuestToken(current.token)) return null;
  if (current.legacy) promoteGuestCookie(cookies, current.token);
  return current.token;
}

export function ensureGuestToken(cookies: AstroCookies): string {
  const existing = getGuestToken(cookies);
  if (existing) return existing;
  const token = randomToken();
  writeGuestCookie(cookies, token);
  return token;
}

export { clearGuestCookies as clearGuestToken };
