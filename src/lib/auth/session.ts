import type { AstroCookies } from "astro";
import { first, run } from "../db";

export const SESSION_COOKIE = "cuet_session";
export const GUEST_COOKIE = "cuet_guest";
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
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return { token, expiresAt };
}

export async function getSessionUser(cookies: AstroCookies): Promise<SessionUser | null> {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await first<SessionUser>(
      `SELECT u.id, u.username, u.email
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ? AND u.deleted_at IS NULL AND u.banned_at IS NULL`,
      await sha256Hex(token),
      new Date().toISOString(),
    );
  } catch {
    return null;
  }
}

export async function destroySession(cookies: AstroCookies): Promise<void> {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await run("DELETE FROM sessions WHERE id = ?", await sha256Hex(token));
    } catch {
      // A missing session row is already logged out.
    }
  }
  cookies.delete(SESSION_COOKIE, { path: "/" });
}

export function getGuestToken(cookies: AstroCookies): string | null {
  return cookies.get(GUEST_COOKIE)?.value ?? null;
}

export function ensureGuestToken(cookies: AstroCookies): string {
  const existing = getGuestToken(cookies);
  if (existing && /^[A-Za-z0-9_-]{20,80}$/.test(existing)) return existing;
  const token = randomToken();
  cookies.set(GUEST_COOKIE, token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return token;
}
