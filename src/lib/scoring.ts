import type { MarkingScheme } from "./ranking";

export type ScoringQuestion = {
  id: number;
  subject_id: number;
  topic_id?: number | null;
  section?: string;
  correct_option: number;
};

export type ScoringAnswer = {
  question_id: number;
  selected: number | null;
  time_spent_sec: number;
};

export type SubjectScoreStat = {
  attempted: number;
  correct: number;
  time: number;
  answered: number;
};

export type TopicScoreStat = SubjectScoreStat & {
  subject_id: number;
  topic_id: number;
};

export type ScoreSummary = {
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  /** 1 = correct, 0 = wrong, null = unanswered. Keyed by question id. */
  correctness: Map<number, 1 | 0 | null>;
  subjectStats: Map<number, SubjectScoreStat>;
  /** Keyed by `${subject_id}:${topic_id}`; topics are only real topic rows. */
  topicStats: Map<string, TopicScoreStat>;
};

/**
 * Pure scoring rule shared by submit, expiry and the unit tests. Only the
 * stored answer key is trusted; nothing here comes from the browser.
 */
export function scoreAttempt(
  questions: ScoringQuestion[],
  answers: ScoringAnswer[],
  marking: MarkingScheme,
): ScoreSummary {
  const answerMap = new Map(answers.map((answer) => [answer.question_id, answer]));
  const correctness = new Map<number, 1 | 0 | null>();
  const subjectStats = new Map<number, SubjectScoreStat>();
  const topicStats = new Map<string, TopicScoreStat>();
  let score = 0;
  let correct = 0;
  let wrong = 0;
  let skipped = 0;

  for (const question of questions) {
    const answer = answerMap.get(question.id);
    const selected = answer?.selected ?? null;
    const isCorrect = selected === null ? null : selected === question.correct_option;
    correctness.set(question.id, isCorrect === null ? null : isCorrect ? 1 : 0);

    // Dynamic marking scheme: resolves per-section rule if specified, or overall paper scheme
    const scheme = (question.section && marking.sections?.[question.section]) || marking;

    if (selected === null) {
      skipped += 1;
      score += scheme.skipped ?? 0;
    } else if (isCorrect) {
      correct += 1;
      score += scheme.correct;
    } else {
      wrong += 1;
      score += scheme.wrong;
    }

    const stat = subjectStats.get(question.subject_id) ?? {
      attempted: 0,
      correct: 0,
      time: 0,
      answered: 0,
    };
    stat.attempted += 1;
    if (isCorrect) stat.correct += 1;
    stat.time += answer?.time_spent_sec ?? 0;
    if (selected !== null) stat.answered += 1;
    subjectStats.set(question.subject_id, stat);

    const topicId = question.topic_id ?? 0;
    if (topicId > 0) {
      const key = `${question.subject_id}:${topicId}`;
      const topicStat = topicStats.get(key) ?? {
        subject_id: question.subject_id,
        topic_id: topicId,
        attempted: 0,
        correct: 0,
        time: 0,
        answered: 0,
      };
      topicStat.attempted += 1;
      if (isCorrect) topicStat.correct += 1;
      topicStat.time += answer?.time_spent_sec ?? 0;
      if (selected !== null) topicStat.answered += 1;
      topicStats.set(key, topicStat);
    }
  }

  return { score, correct, wrong, skipped, correctness, subjectStats, topicStats };
}
