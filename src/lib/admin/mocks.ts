import { z } from "zod";
import { all, first, run } from "../db";
import { parseOptions, slugify } from "../content";
import { orderQuestionsBySections } from "./mock-order";
import { questionSignature } from "./question-import";
import { calculateMockDuration } from "../exam-timing";

function optionalInteger() {
  return z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .optional()
    .transform((value) => {
      if (value === null || value === undefined || value === "") return null;
      const number = Number(value);
      return Number.isFinite(number) ? Math.trunc(number) : Number.NaN;
    })
    .pipe(z.number().int().positive().nullable());
}

export const mockPayloadSchema = z.object({
  title: z.string().trim().min(4).max(180),
  slug: z.string().trim().max(120).optional().default(""),
  subject_id: optionalInteger(),
  type: z.enum(["full", "subject", "chapter", "pyq"]),
  duration_min: z.coerce.number().int().min(1).max(600),
  total_marks: z.coerce.number().min(1).max(10_000),
  marking: z.object({
    correct: z.coerce.number().min(0).max(100),
    wrong: z.coerce.number().max(0).min(-100),
    skipped: z.coerce.number().min(-100).max(100).optional().default(0),
  }),
  instructions: z.string().max(20_000).optional().default(""),
  intro_html: z.string().max(30_000).optional().default(""),
  pyq_year: optionalInteger(),
  pyq_shift: z.string().trim().max(60).optional().default(""),
  status: z.enum(["draft", "in_review", "published"]).default("draft"),
  section_order: z
    .array(z.string().trim().min(1).max(100))
    .max(50)
    .optional()
    .default([]),
  questions: z
    .array(
      z.object({
        question_id: z.coerce.number().int().positive(),
        section: z.string().trim().min(1).max(100),
      }),
    )
    .min(1)
    .max(500),
});

export type MockPayload = z.infer<typeof mockPayloadSchema>;

export type MockRow = {
  id: number;
  exam_id: number;
  subject_id: number | null;
  title: string;
  slug: string;
  type: string;
  duration_min: number;
  total_marks: number;
  marking_scheme: string;
  instructions: string | null;
  intro_html: string | null;
  pyq_paper_id: number | null;
  pyq_year: number | null;
  pyq_shift: string | null;
  status: "draft" | "in_review" | "published" | "archived";
  version: number;
  current_version_id: number | null;
  previous_version_id: number | null;
  published_at: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};

export type MockVersionRow = {
  id: number;
  mock_id: number;
  version_no: number;
  duration_min: number;
  total_marks: number;
  marking_scheme: string;
  instructions: string | null;
  status: "draft" | "in_review" | "published" | "superseded";
  published_at: string | null;
  created_by: number | null;
  created_at: string;
};

export type MockQuestionRow = {
  question_id: number;
  section: string;
  position: number;
};

export async function findMock(id: number): Promise<MockRow | null> {
  return first<MockRow>(
    `SELECT id, exam_id, subject_id, title, slug, type, duration_min, total_marks,
            marking_scheme, instructions, intro_html, pyq_paper_id, pyq_year, pyq_shift,
            status, version, current_version_id, previous_version_id, published_at,
            created_by, created_at, updated_at, deleted_at
     FROM mock_tests WHERE id = ?`,
    id,
  );
}

export async function listMockVersions(mockId: number): Promise<MockVersionRow[]> {
  return all<MockVersionRow>(
    `SELECT id, mock_id, version_no, duration_min, total_marks, marking_scheme,
            instructions, status, published_at, created_by, created_at
     FROM mock_test_versions WHERE mock_id = ? ORDER BY version_no DESC`,
    mockId,
  );
}

/** Latest version row. A draft row means the admin is preparing a correction. */
export async function latestVersion(mockId: number): Promise<MockVersionRow | null> {
  return first<MockVersionRow>(
    `SELECT id, mock_id, version_no, duration_min, total_marks, marking_scheme,
            instructions, status, published_at, created_by, created_at
     FROM mock_test_versions WHERE mock_id = ? ORDER BY version_no DESC LIMIT 1`,
    mockId,
  );
}

export async function findVersion(versionId: number): Promise<MockVersionRow | null> {
  return first<MockVersionRow>(
    `SELECT id, mock_id, version_no, duration_min, total_marks, marking_scheme,
            instructions, status, published_at, created_by, created_at
     FROM mock_test_versions WHERE id = ?`,
    versionId,
  );
}

export async function listVersionQuestions(versionId: number): Promise<MockQuestionRow[]> {
  return all<MockQuestionRow>(
    "SELECT question_id, section, position FROM mock_questions WHERE version_id = ? ORDER BY position",
    versionId,
  );
}

export function normalizeSlug(input: string, title: string): string {
  return slugify(input || title);
}

type QuestionValidationRow = {
  id: number;
  status: string;
  explanation: string | null;
  options: string;
  correct_option: number;
  text: string;
  image_url: string | null;
  image_alt: string | null;
  explanation_image_url: string | null;
  explanation_image_alt: string | null;
  passage_image_url: string | null;
  passage_image_alt: string | null;
};

export type MockQuestionIssue = {
  questionId: number;
  code: string;
  message: string;
};

/** Every blocking problem in one pass, used by the composer validation panel. */
export async function inspectQuestionsForPublish(
  questionIds: number[],
): Promise<MockQuestionIssue[]> {
  if (questionIds.length === 0) {
    return [{ questionId: 0, code: "empty", message: "Add at least one question before publishing." }];
  }
  const placeholders = questionIds.map(() => "?").join(",");
  const rows = await all<QuestionValidationRow>(
    `SELECT q.id, q.status, q.explanation, q.options, q.correct_option, q.text,
            q.image_url, q.image_alt, q.explanation_image_url, q.explanation_image_alt,
            p.image_url AS passage_image_url, p.image_alt AS passage_image_alt
     FROM questions q LEFT JOIN passages p ON p.id = q.passage_id
     WHERE q.deleted_at IS NULL AND q.id IN (${placeholders})`,
    ...questionIds,
  );
  const issues: MockQuestionIssue[] = [];
  if (rows.length !== questionIds.length) {
    issues.push({ questionId: 0, code: "missing", message: "One or more selected questions no longer exist." });
  }

  const seen = new Map<string, number>();
  for (const row of rows) {
    if (row.status !== "published") {
      issues.push({ questionId: row.id, code: "status", message: `Question #${row.id} is not published.` });
    }
    if (!row.explanation?.trim()) {
      issues.push({ questionId: row.id, code: "explanation", message: `Question #${row.id} needs a written explanation.` });
    }
    if (row.image_url && !row.image_alt?.trim()) {
      issues.push({ questionId: row.id, code: "alt", message: `Question #${row.id} has an image without alt text.` });
    }
    if (row.explanation_image_url && !row.explanation_image_alt?.trim()) {
      issues.push({ questionId: row.id, code: "alt", message: `Question #${row.id} has an explanation image without alt text.` });
    }
    if (row.passage_image_url && !row.passage_image_alt?.trim()) {
      issues.push({ questionId: row.id, code: "alt", message: `The passage for question #${row.id} has an image without alt text.` });
    }
    const options = parseOptions(row.options);
    if (options.length < 2) {
      issues.push({ questionId: row.id, code: "options", message: `Question #${row.id} needs at least two options.` });
    }
    if (!Number.isInteger(row.correct_option) || row.correct_option < 0 || row.correct_option >= options.length) {
      issues.push({ questionId: row.id, code: "answer", message: `Question #${row.id} has an answer index outside its options.` });
    }
    for (const [index, option] of options.entries()) {
      if (option.image_url && !option.alt?.trim()) {
        issues.push({ questionId: row.id, code: "alt", message: `Question #${row.id} option ${index + 1} has an image without alt text.` });
      }
    }
    const signature = questionSignature(row.text);
    if (signature) {
      const first = seen.get(signature);
      if (first !== undefined) {
        issues.push({ questionId: row.id, code: "duplicate", message: `Question #${row.id} duplicates question #${first}.` });
      } else {
        seen.set(signature, row.id);
      }
    }
  }
  return issues;
}

/** Blueprint v2 publish gate: explanations, alt text, option range and duplicates. */
export async function validateQuestionsForPublish(
  questionIds: number[],
): Promise<string | null> {
  const issues = await inspectQuestionsForPublish(questionIds);
  return issues[0]?.message ?? null;
}

export async function prepareMock(
  payload: MockPayload,
  examId: number,
): Promise<{ input: MockPayload; slug: string } | { error: string }> {
  const slug = normalizeSlug(payload.slug, payload.title);
  if (slug.length < 3) return { error: "Add a longer title or slug." };
  let subjectName: string | null = null;
  if (payload.subject_id) {
    const subject = await first<{ id: number; name: string }>(
      "SELECT id, name FROM subjects WHERE id = ? AND exam_id = ? AND is_active = 1",
      payload.subject_id,
      examId,
    );
    if (!subject) return { error: "Choose an active subject for this exam." };
    subjectName = subject.name;
  }

  // Ensure duration aligns with questions if not specified
  if (!payload.duration_min || payload.duration_min <= 0) {
    payload.duration_min = calculateMockDuration(payload.questions.length, subjectName).durationMinutes;
  }

  const ids = payload.questions.map((question) => question.question_id);
  if (new Set(ids).size !== ids.length) return { error: "A question can only appear once in a mock." };

  const placeholders = ids.map(() => "?").join(",");
  const rows = await all<{ id: number }>(
    `SELECT id FROM questions WHERE deleted_at IS NULL AND id IN (${placeholders})`,
    ...ids,
  );
  if (rows.length !== ids.length) return { error: "One or more selected questions no longer exist." };

  if (payload.status === "published") {
    const problem = await validateQuestionsForPublish(ids);
    if (problem) return { error: problem };
  }

  return { input: payload, slug };
}

/**
 * Section order is authoritative; questions within a section keep the order
 * they were submitted in. Unknown sections follow the named sections in their
 * original relative order.
 */
export function orderVersionQuestions(
  questions: MockPayload["questions"],
  sectionOrder: string[],
): MockPayload["questions"] {
  return orderQuestionsBySections(questions, sectionOrder);
}

export async function replaceVersionQuestions(versionId: number, payload: MockPayload): Promise<void> {
  await run("DELETE FROM mock_questions WHERE version_id = ?", versionId);
  const ordered = orderVersionQuestions(payload.questions, payload.section_order);
  for (const [index, item] of ordered.entries()) {
    await run(
      "INSERT INTO mock_questions (version_id, question_id, section, position) VALUES (?, ?, ?, ?)",
      versionId,
      item.question_id,
      item.section,
      index + 1,
    );
  }
}

function projection(input: MockPayload, publishedAt: string | null) {
  return {
    duration_min: input.duration_min,
    total_marks: input.total_marks,
    marking_scheme: JSON.stringify(input.marking),
    instructions: input.instructions || null,
    published_at: publishedAt,
  };
}

export async function insertMock(
  input: MockPayload,
  slug: string,
  examId: number,
  adminId: number,
): Promise<number> {
  // A new paper is always created as draft content while its question
  // membership is written. Publishing happens afterwards through the same
  // validated publish path used by corrections, so the immutability triggers
  // never see an insert into an already-frozen version.
  const initialStatus = input.status === "published" ? "draft" : input.status;
  const cached = projection(input, null);
  const result = await run(
    `INSERT INTO mock_tests
      (exam_id, subject_id, title, slug, type, duration_min, total_marks, marking_scheme,
       instructions, intro_html, pyq_year, pyq_shift, status, published_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    examId,
    input.subject_id ?? null,
    input.title,
    slug,
    input.type,
    cached.duration_min,
    cached.total_marks,
    cached.marking_scheme,
    cached.instructions,
    input.intro_html || null,
    input.pyq_year ?? null,
    input.pyq_shift || null,
    initialStatus,
    null,
    adminId,
  );
  const mockId = Number(result.meta.last_row_id);

  const version = await run(
    `INSERT INTO mock_test_versions
      (mock_id, version_no, duration_min, total_marks, marking_scheme, instructions,
       status, published_at, created_by)
     VALUES (?, 1, ?, ?, ?, ?, ?, NULL, ?)`,
    mockId,
    input.duration_min,
    input.total_marks,
    JSON.stringify(input.marking),
    input.instructions || null,
    initialStatus,
    adminId,
  );
  const versionId = Number(version.meta.last_row_id);
  await replaceVersionQuestions(versionId, input);

  if (input.status === "published") {
    await publishMockVersion(mockId, versionId);
  }
  return mockId;
}

/** Update the stable identity and the editable version content together. */
export async function updateMockDraft(
  id: number,
  input: MockPayload,
  slug: string,
  version: MockVersionRow,
): Promise<void> {
  const publishedAt = input.status === "published" ? new Date().toISOString() : null;
  await run(
    `UPDATE mock_tests SET
      subject_id = ?, title = ?, slug = ?, type = ?, duration_min = ?, total_marks = ?,
      marking_scheme = ?, instructions = ?, intro_html = ?, pyq_year = ?, pyq_shift = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
    input.subject_id ?? null,
    input.title,
    slug,
    input.type,
    input.duration_min,
    input.total_marks,
    JSON.stringify(input.marking),
    input.instructions || null,
    input.intro_html || null,
    input.pyq_year ?? null,
    input.pyq_shift || null,
    id,
  );

  await run(
    `UPDATE mock_test_versions SET duration_min = ?, total_marks = ?, marking_scheme = ?,
       instructions = ?, status = ?, published_at = COALESCE(published_at, ?)
     WHERE id = ? AND status != 'published'`,
    input.duration_min,
    input.total_marks,
    JSON.stringify(input.marking),
    input.instructions || null,
    input.status === "published" ? "in_review" : input.status,
    publishedAt,
    version.id,
  );

  await replaceVersionQuestions(version.id, input);
}

/**
 * Publish a version: freeze it, supersede the previous published version, and
 * move the stable mock identity to it. Attempts keep their pinned version_id.
 */
export async function publishMockVersion(mockId: number, versionId: number): Promise<void> {
  const version = await findVersion(versionId);
  if (!version || version.mock_id !== mockId) throw new Error("Version does not belong to this mock.");
  const questions = await listVersionQuestions(versionId);
  const problem = await validateQuestionsForPublish(questions.map((row) => row.question_id));
  if (problem) throw new Error(problem);

  const publishedAt = new Date().toISOString();
  await run(
    "UPDATE mock_test_versions SET status = 'superseded' WHERE mock_id = ? AND status = 'published' AND id != ?",
    mockId,
    versionId,
  );
  await run(
    `UPDATE mock_test_versions SET status = 'published', published_at = COALESCE(published_at, ?)
     WHERE id = ?`,
    publishedAt,
    versionId,
  );
  await run(
    `UPDATE mock_tests SET status = 'published', current_version_id = ?,
       published_at = COALESCE(published_at, ?),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
    versionId,
    publishedAt,
    mockId,
  );
}

/** Clone the latest version into an editable draft (version_no + 1). */
export async function createMockVersion(mockId: number, adminId: number): Promise<number> {
  const latest = await latestVersion(mockId);
  if (!latest) throw new Error("Mock has no version to clone.");
  if (latest.status !== "published" && latest.status !== "superseded") {
    return latest.id;
  }
  const questions = await listVersionQuestions(latest.id);
  const created = await run(
    `INSERT INTO mock_test_versions
      (mock_id, version_no, duration_min, total_marks, marking_scheme, instructions,
       status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)`,
    mockId,
    latest.version_no + 1,
    latest.duration_min,
    latest.total_marks,
    latest.marking_scheme,
    latest.instructions,
    adminId,
  );
  const versionId = Number(created.meta.last_row_id);
  for (const row of questions) {
    await run(
      "INSERT INTO mock_questions (version_id, question_id, section, position) VALUES (?, ?, ?, ?)",
      versionId,
      row.question_id,
      row.section,
      row.position,
    );
  }
  await run(
    "UPDATE mock_tests SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    mockId,
  );
  return versionId;
}

/** Copy a mock and its latest question set into a fresh draft. */
export async function duplicateMock(
  mockId: number,
  adminId: number,
): Promise<{ id: number; slug: string } | { error: string }> {
  const mock = await findMock(mockId);
  if (!mock || mock.deleted_at) return { error: "Mock test not found." };
  const version = await latestVersion(mockId);
  if (!version) return { error: "Mock has no version to copy." };
  const questions = await listVersionQuestions(version.id);

  let slug = `${mock.slug}-copy`.slice(0, 120);
  for (let suffix = 2; suffix < 50; suffix += 1) {
    const taken = await first<{ id: number }>("SELECT id FROM mock_tests WHERE slug = ?", slug);
    if (!taken) break;
    slug = `${mock.slug}-copy-${suffix}`.slice(0, 120);
  }

  const title = `${mock.title} (copy)`.slice(0, 180);
  const created = await run(
    `INSERT INTO mock_tests
      (exam_id, subject_id, title, slug, type, duration_min, total_marks, marking_scheme,
       instructions, intro_html, pyq_paper_id, pyq_year, pyq_shift, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
    mock.exam_id,
    mock.subject_id,
    title,
    slug,
    mock.type,
    version.duration_min,
    version.total_marks,
    version.marking_scheme,
    version.instructions,
    mock.intro_html,
    mock.pyq_paper_id,
    mock.pyq_year,
    mock.pyq_shift,
    adminId,
  );
  const id = Number(created.meta.last_row_id);
  const draft = await run(
    `INSERT INTO mock_test_versions
      (mock_id, version_no, duration_min, total_marks, marking_scheme, instructions,
       status, created_by)
     VALUES (?, 1, ?, ?, ?, ?, 'draft', ?)`,
    id,
    version.duration_min,
    version.total_marks,
    version.marking_scheme,
    version.instructions,
    adminId,
  );
  const versionId = Number(draft.meta.last_row_id);
  for (const row of questions) {
    await run(
      "INSERT INTO mock_questions (version_id, question_id, section, position) VALUES (?, ?, ?, ?)",
      versionId,
      row.question_id,
      row.section,
      row.position,
    );
  }
  return { id, slug };
}

/** Archive keeps the row and attempts intact while hiding it from the public site. */
export async function setMockArchived(mockId: number, archived: boolean): Promise<{ status: string } | { error: string }> {
  const mock = await findMock(mockId);
  if (!mock || mock.deleted_at) return { error: "Mock test not found." };
  let next: string;
  if (archived) {
    next = "archived";
  } else {
    const current = mock.current_version_id
      ? await findVersion(mock.current_version_id)
      : null;
    next = current?.status === "published" ? "published" : "draft";
  }
  await run(
    "UPDATE mock_tests SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    next,
    mockId,
  );
  return { status: next };
}

/**
 * Roll back a suspicious ranked attempt. A replacement is promoted only when
 * the disqualified attempt actually held the first-attempt slot; removing an
 * already-unranked retake must never create a second ranked attempt.
 */
export async function disqualifyAttempt(
  attemptId: number,
  adminId: number | null = null,
): Promise<{ promoted: number | null }> {
  const attempt = await first<{
    id: number;
    user_id: number | null;
    mock_id: number;
    status: string;
    is_first_attempt: number;
  }>(
    "SELECT id, user_id, mock_id, status, is_first_attempt FROM attempts WHERE id = ?",
    attemptId,
  );
  if (!attempt) throw new Error("Attempt not found.");
  if (attempt.status !== "submitted") throw new Error("Only a submitted attempt can be disqualified.");

  const wasRanked = attempt.is_first_attempt === 1;
  await run(
    `UPDATE attempts SET is_first_attempt = 0, disqualified_at = ?, disqualified_by = ?
     WHERE id = ? AND status = 'submitted'`,
    new Date().toISOString(),
    adminId,
    attemptId,
  );

  if (!wasRanked || !attempt.user_id) return { promoted: null };

  const replacement = await first<{ id: number }>(
    `SELECT a.id FROM attempts a
     WHERE a.user_id = ? AND a.mock_id = ? AND a.status = 'submitted' AND a.id != ?
       AND NOT EXISTS (
         SELECT 1 FROM attempts b
         WHERE b.user_id = a.user_id AND b.mock_id = a.mock_id
           AND b.status = 'submitted' AND b.is_first_attempt = 1
       )
     ORDER BY a.submitted_at ASC, a.id ASC
     LIMIT 1`,
    attempt.user_id,
    attempt.mock_id,
    attemptId,
  );
  if (!replacement) return { promoted: null };

  await run("UPDATE attempts SET is_first_attempt = 1 WHERE id = ?", replacement.id);
  return { promoted: replacement.id };
}
