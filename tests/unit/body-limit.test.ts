import { describe, expect, it } from "vitest";
import { bodyLimitExceeds } from "../../src/lib/body-limit";

function requestWithContentLength(length: string | null): Request {
  const headers = new Headers();
  if (length !== null) headers.set("content-length", length);
  return new Request("http://localhost/api/test", { headers });
}

describe("bodyLimitExceeds", () => {
  it("rejects a body that declares a larger Content-Length than the cap", () => {
    expect(bodyLimitExceeds(requestWithContentLength("4097"), 4096)).toBe(true);
    expect(bodyLimitExceeds(requestWithContentLength("4mb"), 8192)).toBe(false);
  });

  it("allows a body exactly at the cap", () => {
    expect(bodyLimitExceeds(requestWithContentLength("8192"), 8192)).toBe(false);
    expect(bodyLimitExceeds(requestWithContentLength("8191"), 8192)).toBe(false);
  });

  it("allows missing or invalid Content-Length (chunked bodies)", () => {
    expect(bodyLimitExceeds(requestWithContentLength(null), 8192)).toBe(false);
    expect(bodyLimitExceeds(requestWithContentLength("abc"), 8192)).toBe(false);
  });
});
