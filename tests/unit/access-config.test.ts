import { describe, expect, it } from "vitest";
import {
  accessModeEnabledFor,
  normalizeAccessTeamDomain,
  readAccessConfig,
} from "../../src/lib/auth/access-config";

describe("Cloudflare Access configuration", () => {
  it("prefers the documented CF_ACCESS names", () => {
    expect(
      readAccessConfig({
        CF_ACCESS_TEAM_DOMAIN: "https://new-team.cloudflareaccess.com/",
        CF_ACCESS_AUD: "new-aud",
        ACCESS_TEAM_DOMAIN: "old-team.cloudflareaccess.com",
        ACCESS_AUD: "old-aud",
      }),
    ).toEqual({
      teamDomain: "new-team.cloudflareaccess.com",
      audience: "new-aud",
    });
  });

  it("falls back to the legacy names during the rename", () => {
    expect(
      readAccessConfig({
        CF_ACCESS_TEAM_DOMAIN: "   ",
        CF_ACCESS_AUD: " ",
        ACCESS_TEAM_DOMAIN: "https://legacy-team.cloudflareaccess.com/",
        ACCESS_AUD: " legacy-aud ",
      }),
    ).toEqual({
      teamDomain: "legacy-team.cloudflareaccess.com",
      audience: "legacy-aud",
    });
  });

  it("is unconfigured unless both a domain and audience exist", () => {
    expect(readAccessConfig({})).toBeNull();
    expect(readAccessConfig({ CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com" })).toBeNull();
    expect(readAccessConfig({ CF_ACCESS_AUD: "aud" })).toBeNull();
    expect(
      readAccessConfig({
        CF_ACCESS_TEAM_DOMAIN: "   ",
        CF_ACCESS_AUD: "aud",
      }),
    ).toBeNull();
  });

  it("normalises the team domain", () => {
    expect(normalizeAccessTeamDomain("https://Team.CloudflareAccess.com/")).toBe(
      "team.cloudflareaccess.com",
    );
    expect(normalizeAccessTeamDomain("http://team.cloudflareaccess.com///")).toBe(
      "team.cloudflareaccess.com",
    );
    expect(normalizeAccessTeamDomain(undefined)).toBe("");
  });

  it("enables Access mode only for the exact value", () => {
    expect(accessModeEnabledFor("access")).toBe(true);
    expect(accessModeEnabledFor(" ACCESS ")).toBe(true);
    expect(accessModeEnabledFor("session")).toBe(false);
    expect(accessModeEnabledFor("")).toBe(false);
    expect(accessModeEnabledFor(undefined)).toBe(false);
  });
});
