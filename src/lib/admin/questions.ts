import { all, first, getDb, run } from "../db";
import { questionSignature } from "./question-import";
import {
  generatePublicId,
  isPublicIdCollision,
} from "../share/public-id";
import {
  normalizeOptions,
  type QuestionPayload,
  validateQuestionContent,
} from "../content";

export type QuestionRow = {
  id: number;
  subject_id: number;
  topic_id: number | null;
  passage_id: number | null;
  text: string;
  text_hi: string | null;
  options: string;
  options_hi: string | null;
  correct_option: number;
  explanation: string | null;
  explanation_hi: string | null;
  difficulty: string | null;
  year: number | null;
  image_url: string | null;
  image_alt: string | null;
  explanation_image_url: string | null;
  explanation_image_alt: string | null;
  status: "draft" | "in_review" | "published";
  supersedes_id: number | null;
  created_by: number | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};

export type QuestionDbInput = {
  subject_id: number;
  topic_id: number | null;
  passage_id: number | null;
  text: string;
  text_hi: string | null;
  options: string;
  options_hi: string | null;
  correct_option: number;
  explanation: string | null;
  explanation_hi: string | null;
  difficulty: string | null;
  year: number | null;
  image_url: string | null;
  image_alt: string | null;
  explanation_image_url: string | null;
  explanation_image_alt: string | null;
  status: "draft" | "in_review" | "published";
};

export async function findQuestion(id: number): Promise<QuestionRow | null> {
  return first<QuestionRow>(
    `SELECT id, subject_id, topic_id, passage_id, text, text_hi, options, options_hi,
            correct_option, explanation, explanation_hi, difficulty, year, image_url,
            image_alt, explanation_image_url, explanation_image_alt, status,
            supersedes_id, created_by, created_at, updated_at, deleted_at
     FROM questions WHERE id = ?`,
    id,
  );
}

export type DuplicateQuestionCandidate = {
  id: number;
  subject_id: number;
  text: string;
  status: string;
};

/**
 * Current (not superseded) questions used for duplicate detection. Old
 * question versions stay in D1 for attempt history but must not make a
 * corrected republish look like a duplicate.
 */
export async function listDuplicateCandidates(
  subjectIds?: number[],
): Promise<DuplicateQuestionCandidate[]> {
  const ids = subjectIds ? [...new Set(subjectIds.filter((id) => Number.isInteger(id) && id > 0))] : [];
  if (subjectIds && ids.length === 0) return [];

  const subjectFilter = ids.length > 0 ? `AND q.subject_id IN (${ids.map(() => "?").join(", ")})` : "";
  return all<DuplicateQuestionCandidate>(
    `SELECT q.id, q.subject_id, q.text, q.status
     FROM questions q
     WHERE q.deleted_at IS NULL
       ${subjectFilter}
       AND NOT EXISTS (
         SELECT 1 FROM questions newer
         WHERE newer.supersedes_id = q.id AND newer.deleted_at IS NULL
       )`,
    ...ids,
  );
}

export async function findDuplicateQuestion(
  subjectId: number,
  text: string,
  excludeId: number | null = null,
): Promise<DuplicateQuestionCandidate | null> {
  const signature = questionSignature(text);
  if (!signature) return null;
  const candidates = await listDuplicateCandidates([subjectId]);
  return (
    candidates.find(
      (candidate) =>
        candidate.id !== excludeId && questionSignature(candidate.text) === signature,
    ) ?? null
  );
}

export function toDbInput(payload: QuestionPayload): QuestionDbInput {
  const options = normalizeOptions(payload.options);
  const hiOptions = normalizeOptions(payload.options_hi ?? []);
  const hasHiOptions = hiOptions.some((option) => option.text || option.image_url);
  return {
    subject_id: payload.subject_id,
    topic_id: payload.topic_id ?? null,
    passage_id: payload.passage_id ?? null,
    text: payload.text.trim(),
    text_hi: payload.text_hi ?? null,
    options: JSON.stringify(options),
    options_hi: hasHiOptions ? JSON.stringify(hiOptions) : null,
    correct_option: payload.correct_option,
    explanation: payload.explanation ?? null,
    explanation_hi: payload.explanation_hi ?? null,
    difficulty: payload.difficulty ?? null,
    year: payload.year ?? null,
    image_url: payload.image_url ?? null,
    image_alt: payload.image_alt ?? null,
    explanation_image_url: payload.explanation_image_url ?? null,
    explanation_image_alt: payload.explanation_image_alt ?? null,
    status: payload.status,
  };
}

export async function prepareQuestion(
  payload: QuestionPayload,
): Promise<{ input: QuestionDbInput } | { error: string }> {
  const errors = validateQuestionContent(payload);
  if (errors.length > 0) return { error: errors.join(" ") };

  const subject = await first<{ id: number }>(
    "SELECT id FROM subjects WHERE id = ? AND is_active = 1",
    payload.subject_id,
  );
  if (!subject) return { error: "Choose an active subject." };

  if (payload.topic_id) {
    const topic = await first<{ id: number }>(
      "SELECT id FROM topics WHERE id = ? AND subject_id = ?",
      payload.topic_id,
      payload.subject_id,
    );
    if (!topic) return { error: "The selected topic does not belong to that subject." };
  }

  return { input: toDbInput(payload) };
}

const INSERT_QUESTION_SQL = `INSERT INTO questions
  (subject_id, topic_id, passage_id, text, text_hi, options, options_hi, correct_option,
   explanation, explanation_hi, difficulty, year, image_url, image_alt,
   explanation_image_url, explanation_image_alt, status, supersedes_id, created_by)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

/**
 * Create the lineage mapping immediately after the question insert. Using
 * last_insert_rowid() keeps both statements in the same D1 batch transaction.
 * For a superseding revision the AFTER INSERT trigger has already moved the
 * existing mapping, so NOT EXISTS makes this a no-op instead of a duplicate.
 */
const INSERT_QUESTION_SHARE_SQL = `INSERT INTO question_public_ids
  (public_id, current_question_id, share_enabled, reveal_policy, seo_indexable, rights_ok)
 SELECT ?, id, ?, 'attempted_only', 0, 0
 FROM questions
 WHERE id = last_insert_rowid()
   AND NOT EXISTS (
     SELECT 1 FROM question_public_ids WHERE current_question_id = last_insert_rowid()
   )`;

function defaultShareEnabled(input: QuestionDbInput): number {
  // PYQ rows stay off until an editor confirms rights. Originals default on.
  return input.year === null ? 1 : 0;
}

function isShareInsertUniqueError(error: unknown): boolean {
  return (
    isPublicIdCollision(error) ||
    /UNIQUE constraint failed: question_public_ids\.current_question_id/i.test(
      error instanceof Error ? error.message : String(error),
    )
  );
}

export async function insertQuestion(
  input: QuestionDbInput,
  adminId: number,
  supersedesId: number | null = null,
): Promise<number> {
  const db = getDb();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const publicId = generatePublicId();
    try {
      const results = await db.batch([
        db
          .prepare(INSERT_QUESTION_SQL)
          .bind(
            input.subject_id,
            input.topic_id,
            input.passage_id,
            input.text,
            input.text_hi,
            input.options,
            input.options_hi,
            input.correct_option,
            input.explanation,
            input.explanation_hi,
            input.difficulty,
            input.year,
            input.image_url,
            input.image_alt,
            input.explanation_image_url,
            input.explanation_image_alt,
            input.status,
            supersedesId,
            adminId,
          ),
        db
          .prepare(INSERT_QUESTION_SHARE_SQL)
          .bind(publicId, defaultShareEnabled(input)),
      ]);
      return Number(results[0]!.meta.last_row_id);
    } catch (error) {
      if (isShareInsertUniqueError(error) && attempt < 7) continue;
      throw error;
    }
  }
  throw new Error("Could not allocate a unique public question id.");
}

/** Insert a validated import in one D1 batch so a failed row rolls back the set. */
export async function insertQuestionBatch(
  inputs: QuestionDbInput[],
  adminId: number,
): Promise<number[]> {
  if (inputs.length === 0) return [];
  const db = getDb();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const statements: D1PreparedStatement[] = [];
    for (const input of inputs) {
      const publicId = generatePublicId();
      statements.push(
        db
          .prepare(INSERT_QUESTION_SQL)
          .bind(
            input.subject_id,
            input.topic_id,
            input.passage_id,
            input.text,
            input.text_hi,
            input.options,
            input.options_hi,
            input.correct_option,
            input.explanation,
            input.explanation_hi,
            input.difficulty,
            input.year,
            input.image_url,
            input.image_alt,
            input.explanation_image_url,
            input.explanation_image_alt,
            input.status,
            null,
            adminId,
          ),
        db
          .prepare(INSERT_QUESTION_SHARE_SQL)
          .bind(publicId, defaultShareEnabled(input)),
      );
    }
    try {
      const results = await db.batch(statements);
      return results
        .filter((_, index) => index % 2 === 0)
        .map((result) => Number(result.meta.last_row_id));
    } catch (error) {
      if (isShareInsertUniqueError(error) && attempt < 7) continue;
      throw error;
    }
  }
  throw new Error("Could not allocate unique public question ids.");
}

export async function updateQuestionRow(id: number, input: QuestionDbInput): Promise<void> {
  await run(
    `UPDATE questions SET
      subject_id = ?, topic_id = ?, passage_id = ?, text = ?, text_hi = ?, options = ?,
      options_hi = ?, correct_option = ?, explanation = ?, explanation_hi = ?, difficulty = ?,
      year = ?, image_url = ?, image_alt = ?, explanation_image_url = ?,
      explanation_image_alt = ?, status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
    input.subject_id,
    input.topic_id,
    input.passage_id,
    input.text,
    input.text_hi,
    input.options,
    input.options_hi,
    input.correct_option,
    input.explanation,
    input.explanation_hi,
    input.difficulty,
    input.year,
    input.image_url,
    input.image_alt,
    input.explanation_image_url,
    input.explanation_image_alt,
    input.status,
    id,
  );
}
