export type MarkingScheme = {
  correct: number;
  wrong: number;
  skipped: number;
  sections?: Record<string, { correct: number; wrong: number; skipped: number }>;
};

export type RankableAttempt = {
  score: number;
  time_taken_sec: number;
  correct: number;
  wrong: number;
};

/**
 * Leaderboard order: score descending, time taken ascending, accuracy
 * descending. Accuracy follows the dashboard definition (correct / attempted,
 * where attempted = correct + wrong). The SQL queries mirror this rule; keep
 * them in sync.
 */
export function compareRanking(a: RankableAttempt, b: RankableAttempt): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.time_taken_sec !== b.time_taken_sec) return a.time_taken_sec - b.time_taken_sec;

  const aAttempted = a.correct + a.wrong;
  const bAttempted = b.correct + b.wrong;
  if (aAttempted === 0 && bAttempted === 0) return 0;
  if (aAttempted === 0) return 1;
  if (bAttempted === 0) return -1;

  // Cross-multiply to compare ratios without floating-point rounding.
  return b.correct * aAttempted - a.correct * bAttempted;
}

export function percentileFor(rank: number, eligible: number): number | null {
  if (!Number.isFinite(rank) || !Number.isFinite(eligible) || rank <= 0 || eligible <= 0) {
    return null;
  }
  return Math.round(((eligible - rank + 1) / eligible) * 1000) / 10;
}

/**
 * Only a registered user's first submitted attempt is ranked. Expired
 * attempts are scored but never enter the leaderboard.
 */
export function firstAttemptFlag(
  userId: number | null,
  mode: "submitted" | "expired",
  earlierFinishedAttempts: number,
): 0 | 1 {
  return userId !== null && mode === "submitted" && earlierFinishedAttempts === 0 ? 1 : 0;
}
