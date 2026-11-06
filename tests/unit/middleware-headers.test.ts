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
    expect(source).toContain('secured.headers.set("x-d1-rows-read"');
    expect(source).toContain("return secured;");
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
