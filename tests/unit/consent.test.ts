import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONSENT_DENIED,
  CONSENT_GRANTED,
  CONSENT_STORAGE_KEY,
  consentRequired,
  consentUiAllowed,
  parseConsent,
  serializeConsent,
} from "../../src/lib/consent";

describe("consent decisions", () => {
  it("uses a versioned storage key and exact values", () => {
    expect(CONSENT_STORAGE_KEY).toBe("cuet_consent_v1");
    expect(CONSENT_GRANTED).toBe("v1:analytics=1");
    expect(CONSENT_DENIED).toBe("v1:analytics=0");
  });

  it("treats missing, malformed and future values as no decision", () => {
    for (const raw of [null, undefined, "", "1", "true", "v1:analytics=", "v2:analytics=1", " v1:analytics=1 "]) {
      expect(parseConsent(raw), String(raw)).toBeNull();
    }
    expect(parseConsent("v1:analytics=1")).toBe("granted");
    expect(parseConsent("v1:analytics=0")).toBe("denied");
  });

  it("serialises the two choices", () => {
    expect(serializeConsent(true)).toBe(CONSENT_GRANTED);
    expect(serializeConsent(false)).toBe(CONSENT_DENIED);
  });

  it("requires consent only for a valid GA4 or GTM id", () => {
    expect(consentRequired({ GA4_MEASUREMENT_ID: "G-Y1JPT7SNQJ" })).toBe(true);
    expect(consentRequired({ GTM_CONTAINER_ID: "GTM-P7XXQ9TF" })).toBe(true);
    expect(consentRequired({})).toBe(false);
    expect(consentRequired({ GA4_MEASUREMENT_ID: "TODO_VERIFY" })).toBe(false);
    expect(consentRequired({ ADSENSE_CLIENT: "ca-pub-1234567890123456" })).toBe(false);
  });

  it("allows the UI only on public routes", () => {
    for (const path of ["/", "/mock-tests", "/blog/a-guide", "/q/abc123", "/privacy-policy"]) {
      expect(consentUiAllowed(path), path).toBe(true);
    }
    for (const path of ["/attempt/1", "/result/1", "/dashboard", "/admin/x", "/login", "/api/x", "/dev/styleguide", "/search?q=x"]) {
      expect(consentUiAllowed(path), path).toBe(false);
    }
  });
});

describe("consent wiring", () => {
  it("keeps the loaders out of BaseLayout and behind the consent component", () => {
    const layout = readFileSync(resolve(process.cwd(), "src/layouts/BaseLayout.astro"), "utf8");
    expect(layout).toContain("<ConsentGate");
    expect(layout).not.toContain('gtag("config"');
    expect(layout).not.toContain("googletagmanager.com/gtm.js");
    const gate = readFileSync(resolve(process.cwd(), "src/components/ConsentGate.astro"), "utf8");
    expect(gate).toContain("localStorage.getItem");
    expect(gate).toContain("googletagmanager.com/gtag/js");
    expect(gate).toContain("location.reload()");
    expect(gate).toContain("data-open-consent");
  });
});
