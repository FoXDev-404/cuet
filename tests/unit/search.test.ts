import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/db", () => ({
  all: vi.fn().mockRejectedValue(new Error("D1 quota exceeded")),
  allOr: vi.fn().mockResolvedValue([]),
  first: vi.fn().mockResolvedValue(null),
}));

import { searchSite } from "../../src/lib/search";

describe("site search", () => {
  it("returns repository guides when D1 is unavailable", async () => {
    const results = await searchSite("error log");
    expect(results.posts.length).toBeGreaterThan(0);
    expect(results.posts.map((post) => post.slug)).toContain("cuet-ug-error-log-guide");
  });

  it("ranks a matching title above body-only matches", async () => {
    const results = await searchSite("mock review");
    expect(results.posts[0]?.slug).toBe("cuet-ug-how-to-review-a-mock-test");
  });

  it("omits the database posts list when the query is too short", async () => {
    const results = await searchSite("a");
    expect(results.posts).toEqual([]);
  });
});
