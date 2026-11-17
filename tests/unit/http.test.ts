import { describe, expect, it } from "vitest";
import { isSameOrigin } from "../../src/lib/http";

const WRITE_URL = "https://cuetfreemocktest.com/api/attempts/start";

function writeRequest(headers: Record<string, string>): Request {
  return new Request(WRITE_URL, { method: "POST", headers });
}

describe("isSameOrigin", () => {
  it("accepts a write whose Origin matches the request host", () => {
    expect(isSameOrigin(writeRequest({ origin: "https://cuetfreemocktest.com" }))).toBe(true);
  });

  it("rejects a write whose Origin is another host", () => {
    expect(isSameOrigin(writeRequest({ origin: "https://evil.example" }))).toBe(false);
  });

  it("rejects a malformed Origin", () => {
    expect(isSameOrigin(writeRequest({ origin: "not a url" }))).toBe(false);
  });

  it("rejects the opaque Origin: null", () => {
    // Sandboxed iframes and file:// pages send this literal value.
    expect(isSameOrigin(writeRequest({ origin: "null" }))).toBe(false);
  });

  it("rejects a write that carries neither Origin nor Sec-Fetch-Site", () => {
    expect(isSameOrigin(writeRequest({}))).toBe(false);
  });

  it("accepts Sec-Fetch-Site: same-origin when Origin is absent", () => {
    expect(isSameOrigin(writeRequest({ "sec-fetch-site": "same-origin" }))).toBe(true);
  });

  it("rejects Sec-Fetch-Site: cross-site when Origin is absent", () => {
    expect(isSameOrigin(writeRequest({ "sec-fetch-site": "cross-site" }))).toBe(false);
  });

  it("rejects Sec-Fetch-Site: same-site when Origin is absent", () => {
    // A sibling subdomain is a different origin even though it shares a site.
    expect(isSameOrigin(writeRequest({ "sec-fetch-site": "same-site" }))).toBe(false);
  });
});
