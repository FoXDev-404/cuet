import { z } from "zod";
import { all, first, run } from "../db";

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

export const pyqPayloadSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  shift: z.string().trim().max(60).optional().default(""),
  subject_id: optionalInteger(),
  title: z.string().trim().min(4).max(180),
  source_url: z.string().trim().max(1000).optional().default(""),
  rights_note: z.string().trim().max(2000).optional().default(""),
  status: z.enum(["draft", "published"]).default("draft"),
  mock_id: optionalInteger(),
});

export type PyqPayload = z.infer<typeof pyqPayloadSchema>;

export type AdminPyqRow = {
  id: number;
  exam_id: number;
  subject_id: number | null;
  year: number;
  shift: string | null;
  title: string;
  source_url: string | null;
  rights_note: string | null;
  status: "draft" | "published";
  created_at: string | null;
  updated_at: string | null;
  subject_name: string | null;
  mock_id: number | null;
  mock_title: string | null;
  mock_slug: string | null;
  mock_status: string | null;
  question_count: number | null;
};

export async function listAdminPyq(): Promise<AdminPyqRow[]> {
  return all<AdminPyqRow>(
    `SELECT p.id, p.exam_id, p.subject_id, p.year, p.shift, p.title, p.source_url,
            p.rights_note, p.status, p.created_at, p.updated_at,
            s.name AS subject_name,
            m.id AS mock_id, m.title AS mock_title, m.slug AS mock_slug, m.status AS mock_status,
            (SELECT COUNT(*) FROM mock_questions_current mq WHERE mq.mock_id = m.id) AS question_count
     FROM pyq_papers p
     LEFT JOIN subjects s ON s.id = p.subject_id
     LEFT JOIN mock_tests m ON m.pyq_paper_id = p.id AND m.deleted_at IS NULL
     WHERE p.deleted_at IS NULL
     ORDER BY p.year DESC, p.shift, p.id DESC`,
  );
}

export async function findPyqPaper(id: number): Promise<AdminPyqRow | null> {
  return first<AdminPyqRow>(
    `SELECT p.id, p.exam_id, p.subject_id, p.year, p.shift, p.title, p.source_url,
            p.rights_note, p.status, p.created_at, p.updated_at,
            s.name AS subject_name,
            m.id AS mock_id, m.title AS mock_title, m.slug AS mock_slug, m.status AS mock_status,
            (SELECT COUNT(*) FROM mock_questions_current mq WHERE mq.mock_id = m.id) AS question_count
     FROM pyq_papers p
     LEFT JOIN subjects s ON s.id = p.subject_id
     LEFT JOIN mock_tests m ON m.pyq_paper_id = p.id AND m.deleted_at IS NULL
     WHERE p.id = ? AND p.deleted_at IS NULL`,
    id,
  );
}

export async function listPyqMockOptions(): Promise<{ id: number; title: string; slug: string; pyq_year: number | null; pyq_paper_id: number | null }[]> {
  return all(
    `SELECT id, title, slug, pyq_year, pyq_paper_id FROM mock_tests
     WHERE deleted_at IS NULL AND type = 'pyq'
     ORDER BY pyq_year DESC, title`,
  );
}

export async function savePyqPaper(
  input: PyqPayload,
  examId: number,
  adminId: number,
  id?: number,
): Promise<number> {
  const now = new Date().toISOString();
  if (input.subject_id) {
    const subject = await first<{ id: number }>(
      "SELECT id FROM subjects WHERE id = ? AND exam_id = ? AND is_active = 1",
      input.subject_id,
      examId,
    );
    if (!subject) throw new Error("Choose an active subject for this exam.");
  }

  let paperId: number;
  if (id) {
    const existing = await findPyqPaper(id);
    if (!existing) throw new Error("PYQ paper not found.");
    await run(
      `UPDATE pyq_papers SET year = ?, shift = ?, subject_id = ?, title = ?, source_url = ?,
         rights_note = ?, status = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
      input.year,
      input.shift || null,
      input.subject_id,
      input.title,
      input.source_url || null,
      input.rights_note || null,
      input.status,
      now,
      id,
    );
    paperId = id;
  } else {
    const result = await run(
      `INSERT INTO pyq_papers
        (exam_id, subject_id, year, shift, title, source_url, rights_note, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      examId,
      input.subject_id,
      input.year,
      input.shift || null,
      input.title,
      input.source_url || null,
      input.rights_note || null,
      input.status,
      now,
      now,
    );
    paperId = Number(result.meta.last_row_id);
  }

  await linkMock(paperId, input.mock_id, adminId);
  return paperId;
}

export async function linkMock(paperId: number, mockId: number | null, _adminId: number): Promise<void> {
  const paper = await first<{ id: number; exam_id: number; year: number; shift: string | null }>(
    "SELECT id, exam_id, year, shift FROM pyq_papers WHERE id = ? AND deleted_at IS NULL",
    paperId,
  );
  if (!paper) throw new Error("PYQ paper not found.");

  await run(
    "UPDATE mock_tests SET pyq_paper_id = NULL WHERE pyq_paper_id = ? AND id != ?",
    paperId,
    mockId ?? 0,
  );

  if (!mockId) return;
  const mock = await first<{ id: number; exam_id: number }>(
    "SELECT id, exam_id FROM mock_tests WHERE id = ? AND deleted_at IS NULL",
    mockId,
  );
  if (!mock) throw new Error("Mock test not found.");
  if (mock.exam_id !== paper.exam_id) throw new Error("The mock belongs to a different exam.");

  await run(
    `UPDATE mock_tests
     SET pyq_paper_id = ?, pyq_year = ?, pyq_shift = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
    paperId,
    paper.year,
    paper.shift,
    mockId,
  );
}

export async function softDeletePyqPaper(id: number): Promise<void> {
  const linked = await first<{ id: number }>(
    "SELECT id FROM mock_tests WHERE pyq_paper_id = ? AND deleted_at IS NULL LIMIT 1",
    id,
  );
  if (linked) throw new Error("Unlink the mock test before deleting this PYQ paper.");
  await run(
    `UPDATE pyq_papers SET status = 'draft',
       deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ? AND deleted_at IS NULL`,
    id,
  );
}
