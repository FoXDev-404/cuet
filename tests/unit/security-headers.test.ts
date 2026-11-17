import { describe, expect, it } from "vitest";
import {
  CROSS_ORIGIN_OPENER_POLICY,
  CROSS_ORIGIN_RESOURCE_POLICY,
  contentSecurityPolicy,
  cspIntegrations,
} from "../../src/lib/security-headers";

const ADS_ENV = {
  ADSENSE_CLIENT: "ca-pub-1234567890123456",
  ADSENSE_SLOT_ID: "1234567890",
  ADSENSE_CMP_ACTIVE: "1",
};

const GA4_ENV = { GA4_MEASUREMENT_ID: "G-ABCDEF1234" };
const GTM_ENV = { GTM_CONTAINER_ID: "GTM-ABC123" };

describe("content security policy integrations", () => {
  it("treats every optional integration as off by default", () => {
    expect(cspIntegrations({})).toEqual({ ads: false, analytics: false });
    expect(
      cspIntegrations({
        ADSENSE_CLIENT: ADS_ENV.ADSENSE_CLIENT,
        ADSENSE_SLOT_ID: ADS_ENV.ADSENSE_SLOT_ID,
      }),
    ).toEqual({ ads: false, analytics: false });
    expect(
      cspIntegrations({ ...ADS_ENV, ADSENSE_CMP_ACTIVE: "0" }),
    ).toEqual({ ads: false, analytics: false });
  });

  it("enables ads only when the client, slot and CMP attestation are valid", () => {
    expect(cspIntegrations(ADS_ENV)).toEqual({ ads: true, analytics: false });
  });

  it("recognises GTM and GA4 as analytics", () => {
    expect(cspIntegrations(GA4_ENV)).toEqual({ ads: false, analytics: true });
    expect(cspIntegrations(GTM_ENV)).toEqual({ ads: false, analytics: true });
  });

  it("keeps the allow-list free of dormant ad and analytics hosts", () => {
    const policy = contentSecurityPolicy(cspIntegrations({}));

    // Always needed: the app, Google OAuth and cookieless Cloudflare analytics.
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("https://accounts.google.com");
    expect(policy).toContain("https://static.cloudflareinsights.com");
    expect(policy).toContain("https://cloudflareinsights.com");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'self'");

    // Dormant integrations must not widen the policy.
    expect(policy).not.toContain("googlesyndication");
    expect(policy).not.toContain("doubleclick");
    expect(policy).not.toContain("googleadservices");
    expect(policy).not.toContain("googletagmanager");
    expect(policy).not.toContain("google-analytics");
  });

  it("adds ad hosts only when ads are configured", () => {
    const policy = contentSecurityPolicy(cspIntegrations(ADS_ENV));

    expect(policy).toContain("https://pagead2.googlesyndication.com");
    expect(policy).toContain("https://*.doubleclick.net");
    expect(policy).toContain("https://fundingchoicesmessages.google.com");
    // Analytics stays narrow unless it is configured too.
    expect(policy).not.toContain("googletagmanager");
    expect(policy).not.toContain("google-analytics");
  });

  it("adds analytics hosts only when GTM or GA4 is configured", () => {
    for (const envLike of [GA4_ENV, GTM_ENV]) {
      const policy = contentSecurityPolicy(cspIntegrations(envLike));
      expect(policy).toContain("https://www.googletagmanager.com");
      expect(policy).toContain("https://*.google-analytics.com");
      expect(policy).toContain("https://analytics.google.com");
      expect(policy).not.toContain("googlesyndication");
      expect(policy).not.toContain("doubleclick");
    }
  });

  it("combines both integrations without dropping the base allow-list", () => {
    const policy = contentSecurityPolicy(
      cspIntegrations({ ...ADS_ENV, ...GTM_ENV }),
    );
    expect(policy).toContain("https://accounts.google.com");
    expect(policy).toContain("https://pagead2.googlesyndication.com");
    expect(policy).toContain("https://www.googletagmanager.com");
  });

  it("keeps inline scripts working until the nonce migration lands", () => {
    // Astro's bootstrap and the consent/theme snippets are inline. Dropping
    // this without moving them to hashes would break sign-in and consent, so
    // the tradeoff is explicit and tracked in AUDIT.md.
    expect(contentSecurityPolicy(cspIntegrations({}))).toContain(
      "script-src 'self' 'unsafe-inline'",
    );
  });
});

describe("cross-origin isolation headers", () => {
  it("allows OAuth popups while isolating the opener", () => {
    expect(CROSS_ORIGIN_OPENER_POLICY).toBe("same-origin-allow-popups");
  });

  it("blocks cross-origin subresource embedding", () => {
    expect(CROSS_ORIGIN_RESOURCE_POLICY).toBe("same-origin");
  });
});
