import { describe, it, expect } from "vitest";
import type { AstroCookies } from "astro";
import {
  SESSION_COOKIE,
  LEGACY_SESSION_COOKIE,
  GUEST_COOKIE,
  LEGACY_GUEST_COOKIE,
  hasSessionCookie,
  readSessionToken,
  writeSessionCookie,
  clearSessionCookies,
  readGuestToken,
  writeGuestCookie,
  clearGuestCookies,
  promoteSessionCookie,
  promoteGuestCookie,
  isGuestToken,
} from "../../src/lib/auth/cookies";

type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  path?: string;
  maxAge?: number;
  expires?: Date;
};

class FakeCookies {
  store = new Map<string, string>();
  writes: Array<{ name: string; value: string; options?: CookieOptions }> = [];
  deletes: Array<{ name: string; options?: CookieOptions }> = [];

  get(name: string) {
    const value = this.store.get(name);
    return value === undefined ? undefined : { value };
  }

  set(name: string, value: string, options?: CookieOptions) {
    this.store.set(name, value);
    this.writes.push({ name, value, options });
  }

  delete(name: string, options?: CookieOptions) {
    this.store.delete(name);
    this.deletes.push({ name, options });
  }

  asCookies() {
    return this as unknown as AstroCookies;
  }
}

describe("prefixed auth cookies", () => {
  it("uses __Host- names and keeps the legacy names readable", () => {
    expect(SESSION_COOKIE).toBe("__Host-cuet_session");
    expect(GUEST_COOKIE).toBe("__Host-cuet_guest");
    expect(LEGACY_SESSION_COOKIE).toBe("cuet_session");
    expect(LEGACY_GUEST_COOKIE).toBe("cuet_guest");
  });

  it("detects either session cookie without reading the token", () => {
    const cookies = new FakeCookies();
    expect(hasSessionCookie(cookies.asCookies())).toBe(false);
    cookies.store.set(LEGACY_SESSION_COOKIE, "legacy-token");
    expect(hasSessionCookie(cookies.asCookies())).toBe(true);
    cookies.store.clear();
    cookies.store.set(SESSION_COOKIE, "new-token");
    expect(hasSessionCookie(cookies.asCookies())).toBe(true);
  });

  it("prefers the prefixed session token and marks legacy tokens for promotion", () => {
    const cookies = new FakeCookies();
    cookies.store.set(LEGACY_SESSION_COOKIE, "legacy-token");
    expect(readSessionToken(cookies.asCookies())).toEqual({
      token: "legacy-token",
      legacy: true,
    });

    cookies.store.set(SESSION_COOKIE, "new-token");
    expect(readSessionToken(cookies.asCookies())).toEqual({
      token: "new-token",
      legacy: false,
    });
  });

  it("writes the session cookie with __Host- compatible attributes", () => {
    const cookies = new FakeCookies();
    const expires = new Date("2026-12-17T00:00:00.000Z");
    writeSessionCookie(cookies.asCookies(), "token-value", expires);

    expect(cookies.writes).toHaveLength(1);
    expect(cookies.writes[0]).toMatchObject({
      name: SESSION_COOKIE,
      value: "token-value",
      options: {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        expires,
      },
    });
  });

  it("clears both the prefixed and legacy session cookies", () => {
    const cookies = new FakeCookies();
    clearSessionCookies(cookies.asCookies());

    expect(cookies.deletes.map((item) => item.name)).toEqual([
      SESSION_COOKIE,
      LEGACY_SESSION_COOKIE,
    ]);
    for (const item of cookies.deletes) {
      expect(item.options).toMatchObject({ path: "/", secure: true });
    }
  });

  it("promotes legacy cookies by writing the prefixed name and deleting the old one", () => {
    const sessions = new FakeCookies();
    const expires = new Date("2026-12-17T00:00:00.000Z");
    promoteSessionCookie(sessions.asCookies(), "legacy-token", expires);

    expect(sessions.writes).toMatchObject([
      { name: SESSION_COOKIE, value: "legacy-token", options: { expires } },
    ]);
    expect(sessions.deletes.map((item) => item.name)).toEqual([LEGACY_SESSION_COOKIE]);

    const guests = new FakeCookies();
    promoteGuestCookie(guests.asCookies(), "guest-token-1234567890");

    expect(guests.writes).toMatchObject([
      { name: GUEST_COOKIE, value: "guest-token-1234567890" },
    ]);
    expect(guests.deletes.map((item) => item.name)).toEqual([LEGACY_GUEST_COOKIE]);
  });

  it("migrates a valid legacy guest token and clears both guest cookies", () => {
    const cookies = new FakeCookies();
    cookies.store.set(LEGACY_GUEST_COOKIE, "guest-token-1234567890");

    expect(readGuestToken(cookies.asCookies())).toEqual({
      token: "guest-token-1234567890",
      legacy: true,
    });
    expect(isGuestToken("guest-token-1234567890")).toBe(true);
    expect(isGuestToken("short")).toBe(false);

    writeGuestCookie(cookies.asCookies(), "guest-token-1234567890");
    expect(cookies.writes[0]).toMatchObject({
      name: GUEST_COOKIE,
      options: { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 2592000 },
    });

    clearGuestCookies(cookies.asCookies());
    expect(cookies.deletes.map((item) => item.name)).toEqual([GUEST_COOKIE, LEGACY_GUEST_COOKIE]);
  });
});
