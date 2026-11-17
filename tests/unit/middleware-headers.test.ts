import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("middleware security headers", () => {
  const source = readFileSync(join(process.cwd(), "src/middleware.ts"), "utf8");

  it("copies immutable response headers before adding the security policy", () => {
    // Response.redirect() throws "Can't modify immutable headers" when mutated
    // directly, which broke every 301 in production. Headers must be cloned and
    // the response rebuilt.
    expect(source).toContain("const headers = new Headers(response.headers);");
    expect(source).toContain("return new Response(body, {");
    expect(source).toContain('headers.set("strict-transport-security"');
  });

  it("does not attach a body to 204/304 responses", () => {
    expect(source).toContain(
      "response.status === 204 || response.status === 304 ? null : response.body",
    );
  });

  it("keeps instrumentation headers on the rebuilt response", () => {
    expect(source).toContain("const secured = applySecurityHeaders(response, requestedPath);");
    expect(source).toContain('secured.headers.set("x-db-rows-read"');
    expect(source).toContain("return secured;");
  });

  it("never caches a response that rendered a database fallback", () => {
    expect(source).toContain('response.headers.get(DB_DEGRADED_HEADER) === "1"');
    expect(source).toContain('secured.headers.get(DB_DEGRADED_HEADER) === "1"');
    expect(source).toContain('secured.headers.set("cache-control", "no-store")');
    expect(source).toContain("if (cache && cacheKey && secured.status === 200 && !degraded)");
  });

  it("never caches private HTML or authenticated API responses", () => {
    // Private paths carry a session-specific attempt, result or dashboard.
    // They must not be stored by a browser, proxy or the edge cache.
    expect(source).toContain('headers.set("cache-control", "no-store")');
    expect(source).toContain('headers.set("pragma", "no-cache")');
    // The no-store branch must be gated by isPrivatePath so public pages keep
    // their own cache policy.
    expect(source).toMatch(
      /if \(isPrivatePath\(pathname\)\) \{[\s\S]*?headers\.set\("cache-control", "no-store"\)[\s\S]*?headers\.set\("pragma", "no-cache"\)[\s\S]*?\}/,
    );
  });

  it("allows the configured analytics endpoints", () => {
    // Cloudflare injects its beacon on the deployed host and GA4 posts events to
    // analytics.google.com / www.google.com. A missing allowlist entry is silent
    // in the UI but drops all analytics, so pin both script and connect hosts.
    const securityHeaders = readFileSync(
      join(process.cwd(), "src/lib/security-headers.ts"),
      "utf8",
    );
    expect(securityHeaders).toContain("https://static.cloudflareinsights.com");
    expect(securityHeaders).toContain("https://cloudflareinsights.com");
    expect(securityHeaders).toContain("https://analytics.google.com");
    expect(securityHeaders).toContain("https://*.google-analytics.com");
  });

  it("adds COOP and CORP and preserves route-specific policies", () => {
    expect(source).toContain('headers.set("cross-origin-opener-policy"');
    expect(source).toContain('headers.set("cross-origin-resource-policy"');
    // Media responses ship `default-src 'none'; sandbox`; the global policy
    // must not replace it.
    expect(source).toContain('if (!headers.has("content-security-policy"))');
  });

  it("routes host and trailing-slash redirects through the header helper", () => {
    expect(source).toContain(
      "applySecurityHeaders(Response.redirect(canonicalTarget.toString(), 301), requestedPath)",
    );
    expect(source).toContain(
      "applySecurityHeaders(Response.redirect(slashTarget.toString(), 301), requestedPath)",
    );
  });
});
