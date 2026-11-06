import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  adsTxtRecord,
  adSlotAllowed,
  adsenseClient,
  adsenseSlot,
  analyticsToken,
  googleSiteVerification,
  shouldServeAds,
} from "../../src/lib/integrations";

const TOKEN = "0123456789abcdef0123456789abcdef";

describe("optional integration flags", () => {
  it("emits nothing for unset or placeholder values", () => {
    expect(analyticsToken({})).toBe("");
    expect(analyticsToken({ CF_ANALYTICS_TOKEN: "TODO_VERIFY" })).toBe("");
    expect(analyticsToken({ CF_ANALYTICS_TOKEN: "short" })).toBe("");
    expect(analyticsToken({ CF_ANALYTICS_TOKEN: "<script>alert(1)</script>" })).toBe("");

    expect(googleSiteVerification({})).toBe("");
    expect(googleSiteVerification({ GSC_VERIFICATION: "TODO_VERIFY" })).toBe("");

    expect(adsenseClient({})).toBe("");
    expect(adsenseClient({ ADSENSE_CLIENT: "pub-1234567890123456" })).toBe("");
    expect(adsenseClient({ ADSENSE_CLIENT: "ca-pub-123<script>" })).toBe("");

    expect(adsenseSlot({})).toBe("");
    expect(adsenseSlot({ ADSENSE_SLOT_ID: "123" })).toBe("");
    expect(adsenseSlot({ ADSENSE_SLOT_ID: "abc123456" })).toBe("");
  });

  it("activates analytics only for a plausible beacon token", () => {
    expect(analyticsToken({ CF_ANALYTICS_TOKEN: TOKEN })).toBe(TOKEN);
    expect(analyticsToken({ CF_ANALYTICS_TOKEN: `  ${TOKEN}  ` })).toBe(TOKEN);
  });

  it("accepts the three forms of Search Console verification input", () => {
    const token = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
    expect(googleSiteVerification({ GSC_VERIFICATION: token })).toBe(token);
    expect(googleSiteVerification({ GSC_VERIFICATION: `google-site-verification=${token}` })).toBe(token);
    expect(
      googleSiteVerification({
        GSC_VERIFICATION: `<meta name="google-site-verification" content="${token}" />`,
      }),
    ).toBe(token);
    expect(
      googleSiteVerification({
        GSC_VERIFICATION: `<meta name="google-site-verification" content="bad value" />`,
      }),
    ).toBe("");
  });

  it("validates the AdSense client and builds the ads.txt record", () => {
    const client = "ca-pub-1234567890123456";
    expect(adsenseClient({ ADSENSE_CLIENT: client })).toBe(client);
    expect(adsenseSlot({ ADSENSE_SLOT_ID: "1234567890" })).toBe("1234567890");
    expect(adsTxtRecord(client)).toBe(
      "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0",
    );
    expect(adsTxtRecord("ca-pub-not-a-number")).toBeNull();
  });

  it("turns ads on by default for indexable pages and off for noindex pages", () => {
    expect(shouldServeAds(undefined, "")).toBe(true);
    expect(shouldServeAds(undefined, "index, follow")).toBe(true);
    expect(shouldServeAds(undefined, "noindex, follow")).toBe(false);
    expect(shouldServeAds(undefined, "noindex, nofollow")).toBe(false);
    // An explicit page decision always wins over the robots default.
    expect(shouldServeAds(true, "noindex, nofollow")).toBe(true);
    expect(shouldServeAds(false, "index, follow")).toBe(false);
  });

  it("never allows ad units on admin, API, dashboard, auth or thin routes", () => {
    for (const path of [
      "/dashboard",
      "/dashboard/history",
      "/admin",
      "/admin/mocks",
      "/api/mocks",
      "/login",
      "/signup",
      "/forgot-password",
      "/reset-password/token",
      "/search?q=cuet",
      "/mock-tests/2022-english-1/take",
      "/u/student",
      "/dev/styleguide",
      "https://example.com/cuet-ug-mock-test",
    ]) {
      expect(adSlotAllowed(path), path).toBe(false);
    }
  });

  it("BaseLayout places the end-of-content slot on every ad-eligible page", () => {
    const layout = readFileSync(resolve(process.cwd(), "src/layouts/BaseLayout.astro"), "utf8");
    expect(layout).toContain("shouldServeAds(ads, robots)");
    expect(layout).toContain("adsCanRender && endAdSlot ? <AdSlot /> : null");
  });

  it("allows substantial public content routes", () => {
    for (const path of [
      "/",
      "/about",
      "/contact",
      "/privacy-policy",
      "/terms",
      "/disclaimer",
      "/blog",
      "/leaderboard",
      "/pyq/2024",
      "/mock-tests",
      "/mock-tests/",
      "/mock-tests?subject=physics",
      "/mock-tests/applied-mathematics-2025-06-02-shift-1",
      "/attempt/42",
      "/result/42",
      "/result/42/solutions",
      "/cuet-ug-syllabus",
      "/cuet-ug-marking-scheme",
      "/mock/starter-mock",
      "/blog/how-to-review-a-mock-test",
    ]) {
      expect(adSlotAllowed(path), path).toBe(true);
    }
  });
});
