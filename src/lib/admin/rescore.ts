import { all, first, run } from "../db";
import { parseMarkingScheme } from "../content";
import { scoreAttempt, type ScoreSummary, type ScoringAnswer, type ScoringQuestion } from "../scoring";

export type RescoreScope = {
  attemptIds?: number[];
  mockId?: number;
  questionId?: number;
  reason?: string;
};

export type RescoreAttempt = {
  id: number;
  user_id: number | null;
  mock_id: number;
  version_id: number;
  score: number | null;
  correct: number | null;
  wrong: number | null;
  skipped: number | null;
  status: string;
  voided_at: string | null;
};

type RescoreQuestion = ScoringQuestion & { options: string };

type OldAnswer = {
  question_id: number;
  selected: number | null;
  time_spent_sec: number;
  is_correct: number | null;
};

function uniqueIds(ids: number[]): number[] {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].slice(0, 5000);
}

export async function resolveScope(scope: RescoreScope): Promise<number[]> {
  if (Array.isArray(scope.attemptIds) && scope.attemptIds.length > 0) {
    return uniqueIds(scope.attemptIds);
  }
  if (scope.mockId) {
    const rows = await all<{ id: number }>(
      `SELECT id FROM attempts
       WHERE mock_id = ? AND status = 'submitted'
       ORDER BY id`,
      scope.mockId,
    );
    return rows.map((row) => row.id);
  }
  if (scope.questionId) {
    const rows = await all<{ id: number }>(
      `SELECT DISTINCT a.id FROM attempts a
       JOIN attempt_answers aa ON aa.attempt_id = a.id
       WHERE aa.question_id = ? AND a.status = 'submitted'
       ORDER BY a.id`,
      scope.questionId,
    );
    return rows.map((row) => row.id);
  }
  return [];
}

async function loadAttempt(id: number): Promise<RescoreAttempt | null> {
  return first<RescoreAttempt>(
    `SELECT id, user_id, mock_id, version_id, score, correct, wrong, skipped, status, voided_at
     FROM attempts WHERE id = ?`,
    id,
  );
}

async function loadMarking(attempt: RescoreAttempt): Promise<{ correct: number; wrong: number; skipped: number } | null> {
  const version = await first<{ marking_scheme: string }>(
    `SELECT marking_scheme FROM mock_test_versions WHERE id = ? AND mock_id = ?`,
    attempt.version_id,
    attempt.mock_id,
  );
  if (!version) return null;
  return parseMarkingScheme(version.marking_scheme);
}

async function loadQuestions(attempt: RescoreAttempt): Promise<RescoreQuestion[]> {
  return all<RescoreQuestion>(
    `SELECT q.id, q.subject_id, q.topic_id, q.correct_option, q.options
     FROM mock_questions mq JOIN questions q ON q.id = mq.question_id
     WHERE mq.version_id = ? ORDER BY mq.position`,
    attempt.version_id,
  );
}

async function loadAnswers(attemptId: number): Promise<OldAnswer[]> {
  return all<OldAnswer>(
    `SELECT question_id, selected, time_spent_sec, is_correct
     FROM attempt_answers WHERE attempt_id = ?`,
    attemptId,
  );
}

async function computeAttempt(
  attempt: RescoreAttempt,
): Promise<{ summary: ScoreSummary; marking: { correct: number; wrong: number; skipped: number } } | null> {
  const marking = await loadMarking(attempt);
  if (!marking) return null;
  const [questions, answers] = await Promise.all([loadQuestions(attempt), loadAnswers(attempt.id)]);
  const scoringAnswers: ScoringAnswer[] = answers.map((answer) => ({
    question_id: answer.question_id,
    selected: answer.selected,
    time_spent_sec: answer.time_spent_sec,
  }));
  return { summary: scoreAttempt(questions, scoringAnswers, marking), marking };
}

export type RescorePreview = {
  total: number;
  changed: number;
  samples: Array<{
    attemptId: number;
    oldScore: number | null;
    newScore: number;
    oldCorrect: number | null;
    newCorrect: number;
  }>;
  truncated: boolean;
};

export async function previewRescore(scope: RescoreScope, sampleLimit = 20): Promise<RescorePreview> {
  const ids = await resolveScope(scope);
  const sampleIds = ids.slice(0, 200);
  const samples: RescorePreview["samples"] = [];
  let changed = 0;

  for (const id of sampleIds) {
    const attempt = await loadAttempt(id);
    if (!attempt || attempt.status !== "submitted") continue;
    const computed = await computeAttempt(attempt);
    if (!computed) continue;
    const summary = computed.summary;
    const differs =
      Number(attempt.score ?? 0) !== summary.score ||
      Number(attempt.correct ?? 0) !== summary.correct ||
      Number(attempt.wrong ?? 0) !== summary.wrong ||
      Number(attempt.skipped ?? 0) !== summary.skipped;
    if (differs) {
      changed += 1;
      if (samples.length < sampleLimit) {
        samples.push({
          attemptId: attempt.id,
          oldScore: attempt.score,
          newScore: summary.score,
          oldCorrect: attempt.correct,
          newCorrect: summary.correct,
        });
      }
    }
  }

  return {
    total: ids.length,
    changed,
    samples,
    truncated: ids.length > sampleIds.length,
  };
}

export async function createRescoreJob(scope: RescoreScope, adminId: number): Promise<number> {
  const ids = await resolveScope(scope);
  const storedScope: RescoreScope = {
    attemptIds: ids,
    reason: scope.reason?.slice(0, 1000),
    questionId: scope.questionId,
    mockId: scope.mockId,
  };
  const result = await run(
    `INSERT INTO rescore_jobs (scope_json, status, total, processed, started_by, started_at)
     VALUES (?, 'pending', ?, 0, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
    JSON.stringify(storedScope),
    ids.length,
    adminId,
  );
  return Number(result.meta.last_row_id);
}

type UserStatDelta = { subjectId: number; topicId: number; correct: number };

function deltas(
  questions: RescoreQuestion[],
  oldAnswers: OldAnswer[],
  summary: ScoreSummary,
): UserStatDelta[] {
  const oldMap = new Map(oldAnswers.map((answer) => [answer.question_id, answer.is_correct === 1]));
  const map = new Map<string, UserStatDelta>();
  for (const question of questions) {
    const wasCorrect = oldMap.get(question.id) === true;
    const isCorrect = summary.correctness.get(question.id) === 1;
    const delta = (isCorrect ? 1 : 0) - (wasCorrect ? 1 : 0);
    if (delta === 0) continue;
    const rollups = question.topic_id ? [0, question.topic_id] : [0];
    for (const topicId of rollups) {
      const key = `${question.subject_id}:${topicId}`;
      const entry = map.get(key) ?? { subjectId: question.subject_id, topicId, correct: 0 };
      entry.correct += delta;
      map.set(key, entry);
    }
  }
  return [...map.values()].filter((entry) => entry.correct !== 0);
}

async function applyStatDelta(userId: number, entries: UserStatDelta[]): Promise<void> {
  for (const entry of entries) {
    await run(
      `UPDATE user_stats SET correct = MAX(0, correct + ?)
       WHERE user_id = ? AND subject_id = ? AND topic_id = ?`,
      entry.correct,
      userId,
      entry.subjectId,
      entry.topicId,
    );
  }
}

export async function runRescoreJob(
  jobId: number,
  _adminId: number,
  batchSize = 8,
): Promise<{
  status: string;
  processed: number;
  total: number;
  done: boolean;
  changed: number;
}> {
  const job = await first<{
    id: number;
    scope_json: string;
    status: string;
    total: number;
    processed: number;
  }>("SELECT id, scope_json, status, total, processed FROM rescore_jobs WHERE id = ?", jobId);
  if (!job) throw new Error("Rescore job not found.");
  if (job.status === "complete" || job.status === "failed" || job.status === "cancelled") {
    return { status: job.status, processed: job.processed, total: job.total, done: true, changed: 0 };
  }

  let scope: RescoreScope;
  try {
    scope = JSON.parse(job.scope_json) as RescoreScope;
  } catch {
    await run("UPDATE rescore_jobs SET status = 'failed', error = ? WHERE id = ?", "Invalid scope JSON", jobId);
    throw new Error("Invalid rescore scope.");
  }

  const ids = scope.attemptIds ?? [];
  const batch = ids.slice(job.processed, job.processed + Math.min(Math.max(batchSize, 1), 20));

  await run("UPDATE rescore_jobs SET status = 'running' WHERE id = ?", jobId);

  let changed = 0;
  let processed = job.processed;
  for (const id of batch) {
    const attempt = await loadAttempt(id);
    processed += 1;
    if (!attempt || attempt.status !== "submitted") continue;

    const marking = await loadMarking(attempt);
    if (!marking) continue;
    const [questions, oldAnswers] = await Promise.all([loadQuestions(attempt), loadAnswers(attempt.id)]);
    const summary = scoreAttempt(
      questions,
      oldAnswers.map((answer) => ({
        question_id: answer.question_id,
        selected: answer.selected,
        time_spent_sec: answer.time_spent_sec,
      })),
      marking,
    );

    const differs =
      Number(attempt.score ?? 0) !== summary.score ||
      Number(attempt.correct ?? 0) !== summary.correct ||
      Number(attempt.wrong ?? 0) !== summary.wrong ||
      Number(attempt.skipped ?? 0) !== summary.skipped;

    if (!differs) continue;
    changed += 1;

    await run(
      `UPDATE attempts SET score = ?, correct = ?, wrong = ?, skipped = ? WHERE id = ?`,
      summary.score,
      summary.correct,
      summary.wrong,
      summary.skipped,
      attempt.id,
    );

    const correctness = questions.map((question) => ({
      id: question.id,
      value: summary.correctness.get(question.id) ?? null,
    }));
    for (let offset = 0; offset < correctness.length; offset += 400) {
      const chunk = correctness.slice(offset, offset + 400);
      if (chunk.length === 0) continue;
      const cases = chunk
        .map((item) => `WHEN ${item.id} THEN ${item.value === null ? "NULL" : item.value}`)
        .join(" ");
      await run(
        `UPDATE attempt_answers SET is_correct = CASE question_id ${cases} ELSE is_correct END
         WHERE attempt_id = ?`,
        attempt.id,
      );
    }

    if (attempt.user_id) {
      await applyStatDelta(attempt.user_id, deltas(questions, oldAnswers, summary));
    }
  }

  const done = processed >= job.total;
  await run(
    `UPDATE rescore_jobs SET processed = ?, status = ?, finished_at = ?
     WHERE id = ?`,
    processed,
    done ? "complete" : "running",
    done ? new Date().toISOString() : null,
    jobId,
  );

  return {
    status: done ? "complete" : "running",
    processed,
    total: job.total,
    done,
    changed,
  };
}

/** Void or restore an attempt and keep user_stats consistent. */
export async function setAttemptVoided(
  attemptId: number,
  voided: boolean,
  reason: string,
  adminId: number,
): Promise<{ ok: true; changed: boolean } | { error: string }> {
  const attempt = await loadAttempt(attemptId);
  if (!attempt) return { error: "Attempt not found." };
  if (attempt.status !== "submitted") return { error: "Only submitted attempts can be voided." };

  const currentlyVoided = Boolean(attempt.voided_at);
  if (currentlyVoided === voided) return { ok: true, changed: false };
  if (voided && !reason.trim()) return { error: "A reason is required to void an attempt." };

  const [questions, answers] = await Promise.all([loadQuestions(attempt), loadAnswers(attemptId)]);
  const stats = new Map<string, { subjectId: number; topicId: number; attempted: number; correct: number; time: number }>();
  for (const question of questions) {
    const answer = answers.find((item) => item.question_id === question.id);
    const time = answer?.time_spent_sec ?? 0;
    const isCorrect = answer?.is_correct === 1 ? 1 : 0;
    const rollups = question.topic_id ? [0, question.topic_id] : [0];
    for (const topicId of rollups) {
      const key = `${question.subject_id}:${topicId}`;
      const entry = stats.get(key) ?? {
        subjectId: question.subject_id,
        topicId,
        attempted: 0,
        correct: 0,
        time: 0,
      };
      entry.attempted += 1;
      entry.correct += isCorrect;
      entry.time += time;
      stats.set(key, entry);
    }
  }

  if (attempt.user_id) {
    for (const entry of stats.values()) {
      if (voided) {
        await run(
          `UPDATE user_stats SET
             avg_time_sec = CASE WHEN attempted - ? > 0 THEN MAX(0, (avg_time_sec * attempted - ?) / (attempted - ?)) ELSE 0 END,
             attempted = MAX(0, attempted - ?),
             correct = MAX(0, correct - ?)
           WHERE user_id = ? AND subject_id = ? AND topic_id = ?`,
          entry.attempted,
          entry.time,
          entry.attempted,
          entry.attempted,
          entry.correct,
          attempt.user_id,
          entry.subjectId,
          entry.topicId,
        );
      } else {
        await run(
          `UPDATE user_stats SET
             avg_time_sec = CASE WHEN attempted + ? > 0 THEN (avg_time_sec * attempted + ?) / (attempted + ?) ELSE 0 END,
             attempted = attempted + ?,
             correct = correct + ?
           WHERE user_id = ? AND subject_id = ? AND topic_id = ?`,
          entry.attempted,
          entry.time,
          entry.attempted,
          entry.attempted,
          entry.correct,
          attempt.user_id,
          entry.subjectId,
          entry.topicId,
        );
      }
    }
  }

  await run(
    `UPDATE attempts SET voided_at = ?, void_reason = ?, voided_by = ? WHERE id = ?`,
    voided ? new Date().toISOString() : null,
    voided ? reason.trim().slice(0, 500) : null,
    voided ? adminId : null,
    attemptId,
  );

  return { ok: true, changed: true };
}
