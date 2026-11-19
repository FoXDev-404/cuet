import { describe, expect, it } from "vitest";
import { getTestStats } from "../../src/lib/test-stats";

const scheme = { correct: 5, wrong: 1, skipped: 0 };

describe("getTestStats", () => {
  it("prefers explicit scored count and ranked duration", () => {
    const stats = getTestStats({
      totalQuestions: 50,
      recoveredQuestionCount: 38,
      sourceQuestionCount: 100,
      scoredQuestions: 48,
      scorableQuestionCount: 40,
      rankedQuestionCount: 50,
      durationMinutes: 75,
      rankedDurationMinutes: 60,
      markingScheme: scheme,
    });

    expect(stats.totalQuestions).toBe(50);
    expect(stats.scoredQuestions).toBe(48);
    expect(stats.durationMinutes).toBe(60);
    expect(stats.maxMarks).toBe(240);
    expect(stats.marks).toEqual(scheme);
  });

  it("falls back to scorable and ranked question counts", () => {
    const fromRanked = getTestStats({
      sourceQuestionCount: 50,
      rankedQuestionCount: 50,
      durationMinutes: 60,
      markingScheme: scheme,
    });
    expect(fromRanked.scoredQuestions).toBe(50);

    const fromScorable = getTestStats({
      totalQuestions: 50,
      scorableQuestionCount: 42,
      durationMinutes: 60,
      markingScheme: scheme,
    });
    expect(fromScorable.scoredQuestions).toBe(42);

    const fallbackTotal = getTestStats({
      totalQuestions: 50,
      durationMinutes: 60,
      markingScheme: scheme,
    });
    expect(fallbackTotal.scoredQuestions).toBe(50);
  });

  it("caps scored questions at the total and never goes negative", () => {
    const capped = getTestStats({
      totalQuestions: 50,
      scoredQuestions: 60,
      durationMinutes: 60,
      markingScheme: scheme,
    });
    expect(capped.scoredQuestions).toBe(50);

    const negative = getTestStats({
      totalQuestions: -5,
      scoredQuestions: -10,
      durationMinutes: -1,
      markingScheme: scheme,
    });
    expect(negative.totalQuestions).toBe(0);
    expect(negative.scoredQuestions).toBe(0);
    expect(negative.durationMinutes).toBe(0);
    expect(negative.maxMarks).toBe(0);
  });

  it("handles missing and NaN marking values safely", () => {
    const stats = getTestStats({
      totalQuestions: 10,
      scoredQuestions: Number.NaN,
      rankedQuestionCount: 10,
      durationMinutes: 30,
      markingScheme: { correct: Number.NaN, wrong: undefined as unknown as number, skipped: 0 },
    });
    expect(stats.maxMarks).toBe(0);
    expect(stats.marks.correct).toBe(0);
    expect(stats.marks.skipped).toBe(0);
  });

  it("returns zeros for an empty paper", () => {
    const stats = getTestStats({ markingScheme: scheme });
    expect(stats).toEqual({
      totalQuestions: 0,
      scoredQuestions: 0,
      durationMinutes: 0,
      marks: scheme,
      maxMarks: 0,
    });
  });
});
