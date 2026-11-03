import { describe, expect, it } from "vitest";
import {
  compareRanking,
  firstAttemptFlag,
  percentileFor,
  type RankableAttempt,
} from "../../src/lib/ranking";

describe("leaderboard ranking", () => {
  it("orders by score, then time, then accuracy", () => {
    const rows: RankableAttempt[] = [
      { score: 90, time_taken_sec: 100, correct: 20, wrong: 10 },
      { score: 100, time_taken_sec: 600, correct: 25, wrong: 5 },
      { score: 100, time_taken_sec: 500, correct: 24, wrong: 6 },
      { score: 100, time_taken_sec: 500, correct: 25, wrong: 5 },
    ];

    const sorted = [...rows].sort(compareRanking);
    expect(sorted.map((row) => `${row.score}/${row.time_taken_sec}/${row.correct}`)).toEqual([
      "100/500/25",
      "100/500/24",
      "100/600/25",
      "90/100/20",
    ]);
  });

  it("uses accuracy rather than raw correct count as the final tie-breaker", () => {
    const fewerButAccurate: RankableAttempt = {
      score: 50,
      time_taken_sec: 300,
      correct: 10,
      wrong: 0,
    };
    const moreButWrong: RankableAttempt = {
      score: 50,
      time_taken_sec: 300,
      correct: 11,
      wrong: 5,
    };

    expect(compareRanking(moreButWrong, fewerButAccurate)).toBeGreaterThan(0);
    expect(compareRanking(fewerButAccurate, moreButWrong)).toBeLessThan(0);
  });

  it("treats two unanswered attempts as an exact tie", () => {
    const empty: RankableAttempt = { score: 0, time_taken_sec: 300, correct: 0, wrong: 0 };
    expect(compareRanking(empty, { ...empty })).toBe(0);
  });

  it("keeps exact ties equal so SQL RANK can share a position", () => {
    const row: RankableAttempt = { score: 80, time_taken_sec: 300, correct: 16, wrong: 4 };
    expect(compareRanking(row, { ...row })).toBe(0);
  });
});

describe("percentileFor", () => {
  it("computes the displayed percentile", () => {
    expect(percentileFor(1, 10)).toBe(100);
    expect(percentileFor(10, 10)).toBe(10);
    expect(percentileFor(3, 7)).toBe(71.4);
    expect(percentileFor(1, 1)).toBe(100);
  });

  it("returns null for impossible inputs", () => {
    expect(percentileFor(0, 10)).toBeNull();
    expect(percentileFor(2, 0)).toBeNull();
    expect(percentileFor(Number.NaN, 10)).toBeNull();
  });
});

describe("firstAttemptFlag", () => {
  it("ranks only a registered user's first submitted attempt", () => {
    expect(firstAttemptFlag(7, "submitted", 0)).toBe(1);
    expect(firstAttemptFlag(7, "submitted", 1)).toBe(0);
    expect(firstAttemptFlag(7, "expired", 0)).toBe(0);
    expect(firstAttemptFlag(null, "submitted", 0)).toBe(0);
  });
});
