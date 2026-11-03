import { all, first, run } from "./db";
import { parseMarkingScheme, parseOptions, type QuestionOption } from "./content";
import { firstAttemptFlag, percentileFor } from "./ranking";
import { scoreAttempt } from "./scoring";
import { hasExpired, remainingSeconds, SUBMIT_GRACE_SECONDS } from "./attempt-time";
import { getMockVersionQuestions } from "./mock-cache";

export { hasExpired, remainingSeconds, SUBMIT_GRACE_SECONDS };

export type AttemptRow = {
  id: number;
  user_id: number | null;
  guest_token: string | null;
  mock_id: number;
  version_id: number;
  status: "in_progress" | "submitted" | "expired";
  score: number | null;
  correct: number | null;
  wrong: number | null;
  skipped: number | null;
  time_taken_sec: number | null;
  started_at: string;
  deadline_at: string;
  submitted_at: string | null;
  is_first_attempt: number;
  last_client_seq?: number;
  section_summary?: string | null;
};

export type AttemptQuestion = {
  id: number;
  section: string;
  position: number;
  subject_id: number;
  text: string;
  text_hi: string | null;
  options: string;
  options_hi: string | null;
  image_url: string | null;
  image_alt: string | null;
  assets_json: string;
  passage_id: number | null;
  passage_body: string | null;
  passage_body_hi: string | null;
  passage_image_url: string | null;
  passage_image_alt: string | null;
};

export type AttemptAnswer = {
  attempt_id: number;
  question_id: number;
  selected: number | null;
  time_spent_sec: number;
  marked_for_review: number;
  is_correct: number | null;
};

export type SolutionQuestion = AttemptQuestion & {
  correct_option: number;
  explanation: string | null;
  explanation_hi: string | null;
  explanation_image_url: string | null;
  explanation_image_alt: string | null;
  explanation_source?: "official" | "human" | "ai_draft" | "banner" | "none";
  explanation_status?: "unreviewed" | "reviewed" | "flagged";
  selected: number | null;
  time_spent_sec: number;
  marked_for_review: number;
  is_correct: number | null;
};

export async function findAttempt(id: number): Promise<AttemptRow | null> {
  return first<AttemptRow>(
    `SELECT id, user_id, guest_token, mock_id, version_id, status, score, correct, wrong, skipped,
            time_taken_sec, started_at, deadline_at, submitted_at, is_first_attempt,
            COALESCE(last_client_seq, 0) AS last_client_seq, section_summary
     FROM attempts WHERE id = ?`,
    id,
  );
}

export function canAccessAttempt(
  attempt: AttemptRow,
  user: { id: number } | null,
  guestToken: string | null,
): boolean {
  if (attempt.user_id && user?.id === attempt.user_id) return true;
  if (!attempt.user_id && attempt.guest_token && guestToken && attempt.guest_token === guestToken) {
    return true;
  }
  return false;
}

export async function attemptQuestions(versionId: number): Promise<AttemptQuestion[]> {
  return getMockVersionQuestions(versionId);
}

export async function attemptAnswers(attemptId: number): Promise<AttemptAnswer[]> {
  return all<AttemptAnswer>(
    `SELECT attempt_id, question_id, selected, time_spent_sec, marked_for_review, is_correct
     FROM attempt_answers WHERE attempt_id = ?`,
    attemptId,
  );
}

export async function findInProgressAttempt(
  mockId: number,
  userId: number | null,
  guestToken: string | null,
): Promise<AttemptRow | null> {
  if (userId) {
    return first<AttemptRow>(
      `SELECT id, user_id, guest_token, mock_id, version_id, status, score, correct, wrong, skipped,
              time_taken_sec, started_at, deadline_at, submitted_at, is_first_attempt,
              COALESCE(last_client_seq, 0) AS last_client_seq, section_summary
       FROM attempts WHERE user_id = ? AND mock_id = ? AND status = 'in_progress'
       ORDER BY id DESC LIMIT 1`,
      userId,
      mockId,
    );
  }
  if (guestToken) {
    return first<AttemptRow>(
      `SELECT id, user_id, guest_token, mock_id, version_id, status, score, correct, wrong, skipped,
              time_taken_sec, started_at, deadline_at, submitted_at, is_first_attempt,
              COALESCE(last_client_seq, 0) AS last_client_seq, section_summary
       FROM attempts WHERE guest_token = ? AND mock_id = ? AND status = 'in_progress'
       ORDER BY id DESC LIMIT 1`,
      guestToken,
      mockId,
    );
  }
  return null;
}

/** Formats a server-derived number for safe literal SQL. */
function sqlNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error("Non-finite number in scoring write.");
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

type UserStatEntry = {
  subjectId: number;
  topicId: number;
  attempted: number;
  correct: number;
  time: number;
};

/**
 * Merges every subject/topic stat in one multi-row upsert instead of one query
 * per subject and topic. A 200-question paper can touch dozens of topics, and
 * the free plan allows 50 queries per Worker invocation, so per-row writes are
 * not safe here. All values are computed from stored rows, never the request.
 */
async function mergeUserStats(userId: number, entries: UserStatEntry[]): Promise<void> {
  for (let offset = 0; offset < entries.length; offset += 100) {
    const chunk = entries.slice(offset, offset + 100);
    const values = chunk
      .map((entry) => {
        const avgTime = entry.attempted > 0 ? entry.time / entry.attempted : 0;
        return `(${sqlNumber(userId)}, ${sqlNumber(entry.subjectId)}, ${sqlNumber(entry.topicId)}, ${sqlNumber(entry.attempted)}, ${sqlNumber(entry.correct)}, ${sqlNumber(avgTime)})`;
      })
      .join(", ");
    await run(
      `INSERT INTO user_stats (user_id, subject_id, topic_id, attempted, correct, avg_time_sec)
       VALUES ${values}
       ON CONFLICT(user_id, subject_id, topic_id) DO UPDATE SET
         avg_time_sec = ((user_stats.avg_time_sec * user_stats.attempted) + (excluded.avg_time_sec * excluded.attempted))
           / NULLIF(user_stats.attempted + excluded.attempted, 0),
         attempted = user_stats.attempted + excluded.attempted,
         correct = user_stats.correct + excluded.correct`,
    );
  }
}

/** Score saved answers. The browser never supplies a score, rank or correctness flag. */
export async function finalizeAttempt(
  attempt: AttemptRow,
  mode: "submitted" | "expired",
): Promise<void> {
  if (attempt.status !== "in_progress") return;

  const version = await first<{
    marking_scheme: string;
    duration_min: number;
  }>(
    `SELECT marking_scheme, duration_min FROM mock_test_versions
     WHERE id = ? AND mock_id = ?`,
    attempt.version_id,
    attempt.mock_id,
  );
  if (!version) throw new Error("Mock test version not found while scoring attempt.");

  const marking = parseMarkingScheme(version.marking_scheme);
  const answers = await attemptAnswers(attempt.id);

  const questionRows = await all<{
    id: number;
    section: string;
    subject_id: number;
    topic_id: number | null;
    correct_option: number;
    options: string;
  }>(
    `SELECT q.id, mq.section, q.subject_id, q.topic_id, q.correct_option, q.options
     FROM mock_questions mq JOIN questions q ON q.id = mq.question_id
     WHERE mq.version_id = ? ORDER BY mq.position`,
    attempt.version_id,
  );

  const summary = scoreAttempt(questionRows, answers, marking);

  // Compute and serialize section summaries to persist with the attempt
  const answerMap = new Map(answers.map((a) => [a.question_id, a]));
  const sectionsMap = new Map<string, AttemptResult["sections"][number]>();
  for (const q of questionRows) {
    const sec = sectionsMap.get(q.section) ?? {
      section: q.section,
      total: 0,
      answered: 0,
      correct: 0,
      wrong: 0,
      skipped: 0,
      score: 0,
      time: 0,
    };
    sec.total += 1;
    const ans = answerMap.get(q.id);
    const isCorrect = summary.correctness.get(q.id);
    if (ans && ans.selected !== null) {
      sec.answered += 1;
      sec.time += ans.time_spent_sec ?? 0;
      if (isCorrect === 1) {
        sec.correct += 1;
        sec.score += marking.correct;
      } else {
        sec.wrong += 1;
        sec.score += marking.wrong;
      }
    } else {
      sec.skipped += 1;
      sec.score += marking.skipped;
    }
    sectionsMap.set(q.section, sec);
  }
  const sectionSummaryJson = JSON.stringify([...sectionsMap.values()]);

  // Make sure every question has an answer row (unattempted questions score
  // NULL). One insert replaces a query per question and keeps the submit path
  // inside the free plan's 50-queries-per-invocation limit.
  await run(
    `INSERT OR IGNORE INTO attempt_answers
       (attempt_id, question_id, selected, time_spent_sec, marked_for_review, is_correct)
     SELECT ?, mq.question_id, NULL, 0, 0, NULL
     FROM mock_questions mq
     WHERE mq.version_id = ?`,
    attempt.id,
    attempt.version_id,
  );

  // A single CASE update writes every correctness flag. Question ids and flags
  // are server-derived integers, so no request data reaches this SQL.
  const correctness = questionRows.map((question) => ({
    id: question.id,
    value: summary.correctness.get(question.id) ?? null,
  }));
  for (let offset = 0; offset < correctness.length; offset += 400) {
    const chunk = correctness.slice(offset, offset + 400);
    if (chunk.length === 0) continue;
    const cases = chunk
      .map((item) => `WHEN ${sqlNumber(item.id)} THEN ${item.value === null ? "NULL" : item.value}`)
      .join(" ");
    await run(
      `UPDATE attempt_answers SET is_correct = CASE question_id ${cases} ELSE is_correct END
       WHERE attempt_id = ?`,
      attempt.id,
    );
  }

  const { score, correct, wrong, skipped } = summary;

  const durationSec = version.duration_min * 60;
  const elapsed = Math.floor((Date.now() - Date.parse(attempt.started_at)) / 1000);
  const timeTaken = Math.max(0, Math.min(durationSec, elapsed));

  let earlierFinished = 0;
  if (attempt.user_id && mode === "submitted") {
    const earlier = await first<{ count: number }>(
      `SELECT COUNT(*) AS count FROM attempts
       WHERE user_id = ? AND mock_id = ? AND id != ? AND status IN ('submitted', 'expired')`,
      attempt.user_id,
      attempt.mock_id,
      attempt.id,
    );
    earlierFinished = earlier?.count ?? 0;
  }
  let isFirst = firstAttemptFlag(attempt.user_id, mode, earlierFinished);

  const submittedAt = new Date().toISOString();
  const updateSql = `UPDATE attempts SET status = ?, score = ?, correct = ?, wrong = ?, skipped = ?,
       time_taken_sec = ?, submitted_at = ?, is_first_attempt = ?, section_summary = ?
     WHERE id = ? AND status = 'in_progress'`;
  let claimed = false;
  try {
    const updated = await run(
      updateSql,
      mode,
      score,
      correct,
      wrong,
      skipped,
      timeTaken,
      submittedAt,
      isFirst,
      sectionSummaryJson,
      attempt.id,
    );
    claimed = (updated.meta.changes ?? 0) > 0;
  } catch (error) {
    // The partial unique index may reject a concurrent first-attempt race.
    if (!isFirst) throw error;
    isFirst = 0;
    const updated = await run(
      updateSql,
      mode,
      score,
      correct,
      wrong,
      skipped,
      timeTaken,
      submittedAt,
      isFirst,
      sectionSummaryJson,
      attempt.id,
    );
    claimed = (updated.meta.changes ?? 0) > 0;
  }

  // Another request already finalised this attempt. Its stats/badge work is
  // responsible for the single write; this request must not double-count.
  if (!claimed) return;

  if (attempt.user_id) {
    const entries: UserStatEntry[] = [
      ...[...summary.subjectStats.entries()].map(([subjectId, stat]) => ({
        subjectId,
        topicId: 0,
        attempted: stat.attempted,
        correct: stat.correct,
        time: stat.time,
      })),
      ...[...summary.topicStats.values()].map((stat) => ({
        subjectId: stat.subject_id,
        topicId: stat.topic_id,
        attempted: stat.attempted,
        correct: stat.correct,
        time: stat.time,
      })),
    ];
    await mergeUserStats(attempt.user_id, entries);

    const finished = await first<{ count: number }>(
      "SELECT COUNT(*) AS count FROM attempts WHERE user_id = ? AND status IN ('submitted','expired')",
      attempt.user_id,
    );
    if ((finished?.count ?? 0) >= 1) {
      await run(
        "INSERT OR IGNORE INTO user_badges (user_id, badge_id) SELECT ?, id FROM badges WHERE code = 'first_mock'",
        attempt.user_id,
      );
    }
  }
}

export async function settleAttempt(attempt: AttemptRow): Promise<AttemptRow> {
  if (attempt.status !== "in_progress") return attempt;
  if (!hasExpired(attempt)) return attempt;
  await finalizeAttempt(attempt, "expired");
  return (await findAttempt(attempt.id)) ?? attempt;
}

export type AttemptResult = {
  attempt: AttemptRow;
  mock: {
    id: number;
    title: string;
    slug: string;
    type: string;
    duration_min: number;
    total_marks: number;
    marking_scheme: string;
    practice_paper_slug: string | null;
  };
  rank: number | null;
  percentile: number | null;
  eligible: number;
  questions: SolutionQuestion[];
  sections: {
    section: string;
    total: number;
    answered: number;
    correct: number;
    wrong: number;
    skipped: number;
    score: number;
    time: number;
  }[];
};

export async function loadResult(
  attempt: AttemptRow,
  options?: { summaryOnly?: boolean },
): Promise<AttemptResult | null> {
  const mock = await first<{
    id: number;
    title: string;
    slug: string;
    type: string;
    duration_min: number;
    total_marks: number;
    marking_scheme: string;
    practice_paper_slug: string | null;
  }>(
    `SELECT m.id, m.title, m.slug, m.type, v.duration_min, v.total_marks, v.marking_scheme,
            m.practice_paper_slug
     FROM mock_tests m JOIN mock_test_versions v ON v.id = ?
     WHERE m.id = ?`,
    attempt.version_id,
    attempt.mock_id,
  );
  if (!mock) return null;

  let sections: AttemptResult["sections"] = [];
  let questions: SolutionQuestion[] = [];

  if (options?.summaryOnly && attempt.section_summary) {
    try {
      sections = JSON.parse(attempt.section_summary) as AttemptResult["sections"];
    } catch {
      // Fall through to query if invalid
    }
  }

  if (sections.length === 0) {
    const rows = await all<SolutionQuestion>(
      `SELECT q.id, mq.section, mq.position, q.subject_id, q.text, q.text_hi, q.options,
              q.options_hi, q.image_url, q.image_alt, q.assets_json, q.passage_id,
              p.body AS passage_body, p.body_hi AS passage_body_hi,
              p.image_url AS passage_image_url, p.image_alt AS passage_image_alt,
              q.correct_option, q.explanation, q.explanation_hi,
              q.explanation_image_url, q.explanation_image_alt,
              q.explanation_source, q.explanation_status,
              aa.selected, COALESCE(aa.time_spent_sec, 0) AS time_spent_sec,
              COALESCE(aa.marked_for_review, 0) AS marked_for_review, aa.is_correct
       FROM mock_questions mq
       JOIN questions q ON q.id = mq.question_id
       LEFT JOIN passages p ON p.id = q.passage_id
       LEFT JOIN attempt_answers aa ON aa.attempt_id = ? AND aa.question_id = q.id
       WHERE mq.version_id = ?
       ORDER BY mq.position`,
      attempt.id,
      attempt.version_id,
    );

    const marking = parseMarkingScheme(mock.marking_scheme);
    const sectionsMap = new Map<string, AttemptResult["sections"][number]>();
    for (const row of rows) {
      const section = sectionsMap.get(row.section) ?? {
        section: row.section,
        total: 0,
        answered: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        score: 0,
        time: 0,
      };
      section.total += 1;
      section.time += row.time_spent_sec;
      if (row.selected === null) section.skipped += 1;
      else {
        section.answered += 1;
        if (row.is_correct === 1) {
          section.correct += 1;
          section.score += marking.correct;
        } else {
          section.wrong += 1;
          section.score += marking.wrong;
        }
      }
      sectionsMap.set(row.section, section);
    }
    sections = [...sectionsMap.values()];
    questions = rows;
  }

  let rank: number | null = null;
  let percentile: number | null = null;
  let eligible = 0;
  if (attempt.status === "submitted" && attempt.is_first_attempt) {
    const stats = await first<{ total: number; better: number }>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN (a.score > ? OR (a.score = ? AND a.time_taken_sec < ?) OR (a.score = ? AND a.time_taken_sec = ? AND a.correct > ?)) THEN 1 ELSE 0 END) AS better
       FROM attempts a JOIN users u ON u.id = a.user_id
       WHERE a.version_id = ? AND a.status = 'submitted' AND a.is_first_attempt = 1
         AND a.user_id IS NOT NULL AND u.deleted_at IS NULL`,
      attempt.score,
      attempt.score,
      attempt.time_taken_sec,
      attempt.score,
      attempt.time_taken_sec,
      attempt.correct,
      attempt.version_id,
    );
    eligible = stats?.total ?? 0;
    if (eligible > 0) {
      rank = (stats?.better ?? 0) + 1;
      percentile = percentileFor(rank, eligible);
    }
  }

  return {
    attempt,
    mock,
    rank,
    percentile,
    eligible,
    questions,
    sections,
  };
}

export function optionsFor(question: AttemptQuestion, language: "en" | "hi"): QuestionOption[] {
  const raw = language === "hi" && question.options_hi ? question.options_hi : question.options;
  return parseOptions(raw);
}

export type QuestionAsset = {
  url: string;
  alt: string;
  kind: string;
};

/**
 * Extra printed crops attached to a question. `image_url` still holds the
 * primary figure, so the attempt screen only renders the remaining assets.
 */
export function parseQuestionAssets(raw: string | null | undefined): QuestionAsset[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const assets: QuestionAsset[] = [];
    for (const item of parsed) {
      const record = (item ?? {}) as Record<string, unknown>;
      const url = typeof record.url === "string" ? record.url.trim() : "";
      if (!url) continue;
      assets.push({
        url,
        alt: typeof record.alt === "string" ? record.alt : "",
        kind: typeof record.kind === "string" ? record.kind : "image",
      });
    }
    return assets;
  } catch {
    return [];
  }
}
