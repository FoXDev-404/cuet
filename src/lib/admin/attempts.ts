import { all, first } from "../db";

export type AdminAttemptRow = {
  id: number;
  user_id: number | null;
  username: string | null;
  email: string | null;
  guest_token: string | null;
  mock_id: number;
  mock_title: string;
  version_id: number;
  version_no: number | null;
  status: string;
  score: number | null;
  correct: number | null;
  wrong: number | null;
  skipped: number | null;
  time_taken_sec: number | null;
  started_at: string;
  submitted_at: string | null;
  is_first_attempt: number;
  disqualified_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
};

export type AttemptFilters = {
  q?: string;
  status?: string;
  mockId?: number;
  voided?: "" | "1" | "0";
  page?: number;
  per?: number;
};

function whereClause(filters: AttemptFilters): { sql: string; params: (string | number)[] } {
  const where: string[] = [];
  const params: (string | number)[] = [];

  const status = ["in_progress", "submitted", "expired"].includes(filters.status ?? "")
    ? filters.status
    : "";
  if (status) {
    where.push("a.status = ?");
    params.push(status);
  }
  if (filters.mockId) {
    where.push("a.mock_id = ?");
    params.push(filters.mockId);
  }
  if (filters.voided === "1") where.push("a.voided_at IS NOT NULL");
  if (filters.voided === "0") where.push("a.voided_at IS NULL");

  const term = (filters.q ?? "").trim().slice(0, 120);
  if (term) {
    where.push("(u.username LIKE ? OR u.email LIKE ? OR m.title LIKE ? OR CAST(a.id AS TEXT) = ?)");
    params.push(`%${term}%`, `%${term}%`, `%${term}%`, term);
  }

  return { sql: where.length > 0 ? `WHERE ${where.join(" AND ")}` : "", params };
}

export async function listAttempts(filters: AttemptFilters): Promise<{
  rows: AdminAttemptRow[];
  total: number;
  page: number;
  per: number;
}> {
  const per = Math.min(Math.max(filters.per ?? 25, 1), 100);
  const page = Math.max(filters.page ?? 1, 1);
  const { sql, params } = whereClause(filters);

  const count = await first<{ count: number }>(
    `SELECT COUNT(*) AS count FROM attempts a
     LEFT JOIN users u ON u.id = a.user_id
     JOIN mock_tests m ON m.id = a.mock_id
     ${sql}`,
    ...params,
  );

  const rows = await all<AdminAttemptRow>(
    `SELECT a.id, a.user_id, u.username, u.email, a.guest_token, a.mock_id,
            m.title AS mock_title, a.version_id, v.version_no, a.status, a.score,
            a.correct, a.wrong, a.skipped, a.time_taken_sec, a.started_at,
            a.submitted_at, a.is_first_attempt, a.disqualified_at, a.voided_at, a.void_reason
     FROM attempts a
     LEFT JOIN users u ON u.id = a.user_id
     JOIN mock_tests m ON m.id = a.mock_id
     LEFT JOIN mock_test_versions v ON v.id = a.version_id
     ${sql}
     ORDER BY a.id DESC LIMIT ? OFFSET ?`,
    ...params,
    per,
    (page - 1) * per,
  );

  return { rows, total: count?.count ?? 0, page, per };
}

export type AdminAnswerRow = {
  question_id: number;
  selected: number | null;
  time_spent_sec: number;
  marked_for_review: number;
  is_correct: number | null;
  text: string;
  correct_option: number;
  subject_name: string | null;
  topic_name: string | null;
};

export async function findAttemptDetail(id: number): Promise<{
  attempt: AdminAttemptRow;
  answers: AdminAnswerRow[];
} | null> {
  const attempt = await first<AdminAttemptRow>(
    `SELECT a.id, a.user_id, u.username, u.email, a.guest_token, a.mock_id,
            m.title AS mock_title, a.version_id, v.version_no, a.status, a.score,
            a.correct, a.wrong, a.skipped, a.time_taken_sec, a.started_at,
            a.submitted_at, a.is_first_attempt, a.disqualified_at, a.voided_at, a.void_reason
     FROM attempts a
     LEFT JOIN users u ON u.id = a.user_id
     JOIN mock_tests m ON m.id = a.mock_id
     LEFT JOIN mock_test_versions v ON v.id = a.version_id
     WHERE a.id = ?`,
    id,
  );
  if (!attempt) return null;

  const answers = await all<AdminAnswerRow>(
    `SELECT aa.question_id, aa.selected, aa.time_spent_sec, aa.marked_for_review, aa.is_correct,
            q.text, q.correct_option, s.name AS subject_name, t.name AS topic_name
     FROM attempt_answers aa
     JOIN questions q ON q.id = aa.question_id
     LEFT JOIN subjects s ON s.id = q.subject_id
     LEFT JOIN topics t ON t.id = q.topic_id
     WHERE aa.attempt_id = ?
     ORDER BY aa.question_id`,
    id,
  );

  return { attempt, answers };
}

export async function listMocksForFilter(): Promise<Array<{ id: number; title: string }>> {
  return all<{ id: number; title: string }>(
    "SELECT id, title FROM mock_tests WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 300",
  );
}
