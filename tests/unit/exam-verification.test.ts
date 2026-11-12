import { describe, expect, it } from "vitest";
import {
  EXAM_INFO_FALLBACK_VERIFICATION,
  isExamInfoVerified,
  resolveExamVerification,
} from "../../src/lib/exam-verification";

describe("exam-info verification", () => {
  it("trusts a verified database row", () => {
    const result = resolveExamVerification(
      "marking-scheme",
      { value: "+5 / -1", last_verified: "2026-11-04" },
      true,
    );
    expect(result).toEqual({
      verified: true,
      lastVerified: "2026-11-04",
      degraded: false,
    });
  });

  it("keeps TODO_VERIFY rows noindex when the database answered", () => {
    const result = resolveExamVerification(
      "important-dates",
      { value: "TODO_VERIFY", last_verified: null },
      true,
    );
    expect(result.verified).toBe(false);
    expect(result.lastVerified).toBeNull();
  });

  it("treats a missing row as unverified when the database answered", () => {
    expect(resolveExamVerification("marking-scheme", undefined, true).verified).toBe(false);
  });

  it("keeps an indexable guide indexable during a database outage", () => {
    const result = resolveExamVerification("marking-scheme", undefined, false);
    expect(result).toEqual({
      verified: true,
      lastVerified: EXAM_INFO_FALLBACK_VERIFICATION["marking-scheme"],
      degraded: true,
    });
  });

  it("does not fabricate verification for important-dates during an outage", () => {
    const result = resolveExamVerification("important-dates", undefined, false);
    expect(result.verified).toBe(false);
    expect(result.lastVerified).toBeNull();
    expect(EXAM_INFO_FALLBACK_VERIFICATION["important-dates"]).toBeUndefined();
  });

  it("rejects empty values and empty verification dates", () => {
    expect(isExamInfoVerified({ value: "", last_verified: "2026-11-04" })).toBe(false);
    expect(isExamInfoVerified({ value: "+5 / -1", last_verified: null })).toBe(false);
    expect(isExamInfoVerified(null)).toBe(false);
  });
});
