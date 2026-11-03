import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { all } from "../../../../lib/db";
import { json } from "../../../../lib/http";

const STATUSES = new Set(["open", "resolved", "dismissed"]);

export const GET: APIRoute = async (context) => {
  const guard = requirePermission(context, "moderation.write");
  if (guard.response) return guard.response;

  const url = new URL(context.request.url);
  const status = (url.searchParams.get("status") ?? "open").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "50") || 50, 1), 200);
  const where = STATUSES.has(status) ? "WHERE r.status = ?" : "";
  const params = STATUSES.has(status) ? [status, limit] : [limit];

  const reports = await all<{
    id: number;
    question_id: number;
    reason: string;
    status: string;
    created_at: string;
    question_text: string | null;
    mock_title: string | null;
    mock_slug: string | null;
    reporter: string | null;
  }>(
    `SELECT r.id, r.question_id, r.reason, r.status, r.created_at,
            q.text AS question_text, m.title AS mock_title, m.slug AS mock_slug,
            u.username AS reporter
     FROM question_reports r
     LEFT JOIN questions q ON q.id = r.question_id
     LEFT JOIN mock_questions_current mq ON mq.question_id = r.question_id
     LEFT JOIN mock_tests m ON m.id = mq.mock_id
     LEFT JOIN users u ON u.id = r.user_id
     ${where}
     ORDER BY r.created_at DESC
     LIMIT ?`,
    ...params,
  );

  return json({ ok: true, count: reports.length, reports });
};
