import { beforeEach, describe, expect, it, vi } from "vitest";

const { allMock } = vi.hoisted(() => ({ allMock: vi.fn() }));

vi.mock("../../src/lib/db", () => ({
  all: allMock,
  first: vi.fn(),
}));

import { getExamInfoState } from "../../src/lib/seo";

describe("getExamInfoState", () => {
  beforeEach(() => {
    allMock.mockReset();
  });

  it("returns rows and marks the read as available", async () => {
    allMock.mockResolvedValue([
      { key: "marking-scheme", value: "+5 / -1", source_url: null, last_verified: "2026-11-04" },
    ]);
    const state = await getExamInfoState(["marking-scheme"]);
    expect(state.available).toBe(true);
    expect(state.rows["marking-scheme"]?.last_verified).toBe("2026-11-04");
  });

  it("reports the failure instead of returning a misleading empty result", async () => {
    allMock.mockRejectedValue(new Error("database unavailable"));
    const state = await getExamInfoState(["marking-scheme"]);
    expect(state.available).toBe(false);
    expect(state.rows).toEqual({});
  });

  it("skips the query entirely for an empty key list", async () => {
    const state = await getExamInfoState([]);
    expect(state).toEqual({ rows: {}, available: true });
    expect(allMock).not.toHaveBeenCalled();
  });
});
