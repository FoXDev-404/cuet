import { getDb } from "./db";
import { parseOptions } from "./content";
import type { AttemptQuestion } from "./attempts";

export type IncomingAnswer = {
  question_id: number;
  selected: number | null;
  time_spent_sec: number;
  marked_for_review: number;
  client_seq?: number;
};

export type QuestionMetaMap = Map<number, { id: number; optionCount: number }>;

export function normalizeIncomingAnswers(
  input: unknown,
  questions: AttemptQuestion[] | QuestionMetaMap,
  clientSeq: number = 0,
): { answers: IncomingAnswer[] } | { error: string } {
  if (!Array.isArray(input)) return { error: "answers must be an array." };
  if (input.length > 500) return { error: "Too many answers in one request." };

  const byId: Map<number, { optionCount: number }> =
    questions instanceof Map
      ? questions
      : new Map(
          questions.map((q) => [
            q.id,
            { optionCount: parseOptions(q.options).length },
          ]),
        );

  const answers: IncomingAnswer[] = [];
  for (const raw of input) {
    const item = (raw ?? {}) as Record<string, unknown>;
    const questionId = Number(item.question_id);
    const meta = byId.get(questionId);
    if (!Number.isInteger(questionId) || !meta) {
      return { error: "An answer references a question outside this mock." };
    }
    const selectedRaw = item.selected;
    const selected =
      selectedRaw === null || selectedRaw === undefined || selectedRaw === ""
        ? null
        : Number(selectedRaw);
    const optionCount = meta.optionCount;
    if (selected !== null && (!Number.isInteger(selected) || selected < 0 || selected >= optionCount)) {
      return { error: "An answer selects an option that does not exist." };
    }
    const time = Number(item.time_spent_sec ?? 0);
    const marked = Number(item.marked_for_review ?? 0);
    const seq = typeof item.client_seq === "number" ? Math.floor(item.client_seq) : clientSeq;
    answers.push({
      question_id: questionId,
      selected,
      time_spent_sec: Number.isFinite(time) ? Math.max(0, Math.min(86_400, Math.trunc(time))) : 0,
      marked_for_review: marked ? 1 : 0,
      client_seq: Math.max(0, seq),
    });
  }
  return { answers };
}

export async function saveAttemptAnswers(
  attemptId: number,
  answers: IncomingAnswer[],
  defaultSeq: number = 0,
): Promise<void> {
  if (answers.length === 0) return;
  const db = getDb();
  const now = new Date().toISOString();
  const statements = answers.map((answer) => {
    const seq = answer.client_seq ?? defaultSeq;
    return db
      .prepare(
        `INSERT INTO attempt_answers
          (attempt_id, question_id, selected, time_spent_sec, marked_for_review, client_seq, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(attempt_id, question_id) DO UPDATE SET
           selected = CASE WHEN excluded.client_seq >= COALESCE(attempt_answers.client_seq, 0) THEN excluded.selected ELSE attempt_answers.selected END,
           time_spent_sec = CASE WHEN excluded.client_seq >= COALESCE(attempt_answers.client_seq, 0) THEN excluded.time_spent_sec ELSE attempt_answers.time_spent_sec END,
           marked_for_review = CASE WHEN excluded.client_seq >= COALESCE(attempt_answers.client_seq, 0) THEN excluded.marked_for_review ELSE attempt_answers.marked_for_review END,
           client_seq = CASE WHEN excluded.client_seq >= COALESCE(attempt_answers.client_seq, 0) THEN excluded.client_seq ELSE attempt_answers.client_seq END,
           updated_at = CASE WHEN excluded.client_seq >= COALESCE(attempt_answers.client_seq, 0) THEN excluded.updated_at ELSE attempt_answers.updated_at END`,
      )
      .bind(
        attemptId,
        answer.question_id,
        answer.selected,
        answer.time_spent_sec,
        answer.marked_for_review,
        seq,
        now,
      );
  });
  await db.batch(statements);
}
