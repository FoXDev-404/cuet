import { describe, expect, it } from "vitest";
import { isPrivatePath, NOINDEX_PREFIXES } from "../../src/lib/private-paths";

describe("private paths", () => {
  it("matches a prefix only at a segment boundary", () => {
    expect(isPrivatePath("/attempt/1")).toBe(true);
    expect(isPrivatePath("/attempt/1/")).toBe(true);
    expect(isPrivatePath("/attempting")).toBe(false);
    expect(isPrivatePath("/dashboard/history")).toBe(true);
    expect(isPrivatePath("/api/admin/users")).toBe(true);
  });

  it("keeps public content routes public", () => {
    for (const path of ["/", "/blog/a-guide", "/mock-tests", "/privacy-policy", "/q/abc123"]) {
      expect(isPrivatePath(path), path).toBe(false);
    }
  });

  it("keeps the noindex list available to the middleware", () => {
    expect(NOINDEX_PREFIXES).toContain("/attempt");
    expect(NOINDEX_PREFIXES).toContain("/api/attempts");
  });
});
