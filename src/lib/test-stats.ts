export interface TestStatsMarking {
  correct: number;
  wrong: number;
  skipped: number;
}

export interface TestStatsInput {
  /** Original question count, when it differs from the playable set. */
  totalQuestions?: number | null;
  recoveredQuestionCount?: number | null;
  sourceQuestionCount?: number | null;
  scoredQuestions?: number | null;
  scorableQuestionCount?: number | null;
  rankedQuestionCount?: number | null;
  durationMinutes?: number | null;
  rankedDurationMinutes?: number | null;
  markingScheme: TestStatsMarking;
}

export interface TestStats {
  totalQuestions: number;
  scoredQuestions: number;
  durationMinutes: number;
  marks: TestStatsMarking;
  maxMarks: number;
}

/**
 * One source of truth for the numbers printed on PYQ detail pages, mock
 * overviews and result pages. Papers, mocks and results all describe the same
 * 50-question set, so they must not disagree about its size or marking.
 */
export function getTestStats(input: TestStatsInput): TestStats {
  const total = Math.max(
    0,
    Number(input.totalQuestions ?? input.recoveredQuestionCount ?? input.sourceQuestionCount ?? 0) || 0,
  );
  const scoredCandidate = Math.max(
    0,
    Number(
      input.scoredQuestions ??
        input.rankedQuestionCount ??
        input.scorableQuestionCount ??
        total,
    ) || 0,
  );
  const scored = total > 0 ? Math.min(scoredCandidate, total) : scoredCandidate;
  const duration = Math.max(
    0,
    Number(input.rankedDurationMinutes ?? input.durationMinutes ?? 0) || 0,
  );
  const marks: TestStatsMarking = {
    correct: Number(input.markingScheme.correct) || 0,
    wrong: Number(input.markingScheme.wrong) || 0,
    skipped: Number(input.markingScheme.skipped) || 0,
  };

  return {
    totalQuestions: total,
    scoredQuestions: scored,
    durationMinutes: duration,
    marks,
    maxMarks: scored * marks.correct,
  };
}
