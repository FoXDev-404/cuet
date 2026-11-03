import { describe, expect, it } from "vitest";
import { googleConfigured } from "../../src/lib/auth/oauth-config";

describe("Google OAuth configuration", () => {
  it("requires both a client id and secret", () => {
    expect(googleConfigured({})).toBe(false);
    expect(googleConfigured({ GOOGLE_CLIENT_ID: "client" })).toBe(false);
    expect(googleConfigured({ GOOGLE_CLIENT_SECRET: "secret" })).toBe(false);
    expect(googleConfigured({ GOOGLE_CLIENT_ID: "  ", GOOGLE_CLIENT_SECRET: "secret" })).toBe(
      false,
    );
    expect(
      googleConfigured({ GOOGLE_CLIENT_ID: "client", GOOGLE_CLIENT_SECRET: "secret" }),
    ).toBe(true);
  });
});
