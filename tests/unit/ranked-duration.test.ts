import { describe, expect, it } from "vitest";
import { rankedDurationMinutes } from "../../src/lib/ranked-duration";

describe("rankedDurationMinutes", () => {
  it("prefers the stored/locked duration even when the family rate disagrees", () => {
    // The rebuilt General Test sets advertise 60 minutes everywhere and lock
    // duration_min=60; question-count arithmetic (60s/q for the general family)
    // would otherwise produce 50 minutes.
    expect(rankedDurationMinutes(60, 50, "General Test")).toBe(60);
    expect(rankedDurationMinutes(60, 50, "Mathematics")).toBe(60);
    expect(rankedDurationMinutes(45, 50, "English")).toBe(45);
  });

  it("falls back to question-count timing when no stored duration exists", () => {
    expect(rankedDurationMinutes(null, 50, "General Test")).toBe(50);
    expect(rankedDurationMinutes(0, 50, "General Test")).toBe(50);
    expect(rankedDurationMinutes(Number.NaN, 50, "General Test")).toBe(50);
    expect(rankedDurationMinutes(undefined, 60, "General Test")).toBe(60);
    expect(rankedDurationMinutes(undefined, 50, "Mathematics")).toBe(60);
  });

  it("rejects nonsense stored values and prefers a sensible fallback", () => {
    expect(rankedDurationMinutes(-30, 50, "Physics")).toBe(60);
    expect(rankedDurationMinutes(Number.NaN, 50, "Physics")).toBe(60);
  });
});
