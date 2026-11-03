import type { APIRoute } from "astro";
import { all } from "../../../lib/db";
import { apiError, json } from "../../../lib/http";

const STATUSES = new Set(["in_progress", "submitted", "expired"]);

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) return apiError("Login required.", 401);

  const url = new URL(context.request.url);
  const status = (url.searchParams.get("status") ?? "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "20") || 20, 1), 100);

  const where = ["a.user_id = ?"];
  const params: (number | string)[] = [user.id];
  if (STATUSES.has(status)) {
    where.push("a.status = ?");
    params.push(status);
  }

  const rows = await all<{
    id: number;
    status: string;
    score: number | null;
    correct: number | null;
    wrong: number | null;
    skipped: number | null;
    time_taken_sec: number | null;
    started_at: string;
    deadline_at: string;
    submitted_at: string | null;
    is_first_attempt: number;
    mock_id: number;
    title: string;
    slug: string;
    type: string;
    version_id: number;
    version_no: number;
    total_marks: number;
  }>(
    `SELECT a.id, a.status, a.score, a.correct, a.wrong, a.skipped, a.time_taken_sec,
            a.started_at, a.deadline_at, a.submitted_at, a.is_first_attempt,
            m.id AS mock_id, m.title, m.slug, m.type,
            v.id AS version_id, v.version_no, v.total_marks
     FROM attempts a
     JOIN mock_tests m ON m.id = a.mock_id
     JOIN mock_test_versions v ON v.id = a.version_id
     WHERE ${where.join(" AND ")}
     ORDER BY a.id DESC
     LIMIT ? OFFSET ?`,
    ...params,
    limit,
    (page - 1) * limit,
  );

  return json({
    ok: true,
    count: rows.length,
    attempts: rows.map((row) => ({
      id: row.id,
      href: `/result/${row.id}`,
      status: row.status,
      mock: {
        id: row.mock_id,
        title: row.title,
        slug: row.slug,
        type: row.type,
        versionId: row.version_id,
        versionNo: row.version_no,
        totalMarks: row.total_marks,
      },
      score: row.score,
      correct: row.correct,
      wrong: row.wrong,
      skipped: row.skipped,
      timeTakenSec: row.time_taken_sec,
      startedAt: row.started_at,
      deadlineAt: row.deadline_at,
      submittedAt: row.submitted_at,
      firstAttempt: row.is_first_attempt === 1,
    })),
    pagination: { page, limit, hasNext: rows.length === limit },
  });
};
