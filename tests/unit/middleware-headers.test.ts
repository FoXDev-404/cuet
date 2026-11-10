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
    expect(source).toContain("if (cache && secured.status === 200 && !degraded)");
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
