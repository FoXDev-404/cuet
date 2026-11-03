import { getDb } from "./db";
import { parseOptions } from "./content";
import type { AttemptQuestion } from "./attempts";

export type IncomingAnswer = {
  question_id: number;
  selected: number | null;
  time_spent_sec: number;
  marked_for_review: number;
};

export function normalizeIncomingAnswers(
  input: unknown,
  questions: AttemptQuestion[],
): { answers: IncomingAnswer[] } | { error: string } {
  if (!Array.isArray(input)) return { error: "answers must be an array." };
  if (input.length > 500) return { error: "Too many answers in one request." };

  const byId = new Map(questions.map((question) => [question.id, question]));
  const answers: IncomingAnswer[] = [];
  for (const raw of input) {
    const item = (raw ?? {}) as Record<string, unknown>;
    const questionId = Number(item.question_id);
    const question = byId.get(questionId);
    if (!Number.isInteger(questionId) || !question) {
      return { error: "An answer references a question outside this mock." };
    }
    const selectedRaw = item.selected;
    const selected =
      selectedRaw === null || selectedRaw === undefined || selectedRaw === ""
        ? null
        : Number(selectedRaw);
    const optionCount = parseOptions(question.options).length;
    if (selected !== null && (!Number.isInteger(selected) || selected < 0 || selected >= optionCount)) {
      return { error: "An answer selects an option that does not exist." };
    }
    const time = Number(item.time_spent_sec ?? 0);
    const marked = Number(item.marked_for_review ?? 0);
    answers.push({
      question_id: questionId,
      selected,
      time_spent_sec: Number.isFinite(time) ? Math.max(0, Math.min(86_400, Math.trunc(time))) : 0,
      marked_for_review: marked ? 1 : 0,
    });
  }
  return { answers };
}

export async function saveAttemptAnswers(
  attemptId: number,
  answers: IncomingAnswer[],
): Promise<void> {
  if (answers.length === 0) return;
  const db = getDb();
  const statements = answers.map((answer) =>
    db
      .prepare(
        `INSERT INTO attempt_answers
          (attempt_id, question_id, selected, time_spent_sec, marked_for_review)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(attempt_id, question_id) DO UPDATE SET
           selected = excluded.selected,
           time_spent_sec = excluded.time_spent_sec,
           marked_for_review = excluded.marked_for_review`,
      )
      .bind(
        attemptId,
        answer.question_id,
        answer.selected,
        answer.time_spent_sec,
        answer.marked_for_review,
      ),
  );
  await db.batch(statements);
}
