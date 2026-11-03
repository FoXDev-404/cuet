import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { all } from "../../../../lib/db";
import { json } from "../../../../lib/http";

const STATUSES = new Set(["pending", "visible", "hidden"]);

export const GET: APIRoute = async (context) => {
  const guard = requirePermission(context, "moderation.write");
  if (guard.response) return guard.response;

  const url = new URL(context.request.url);
  const status = (url.searchParams.get("status") ?? "pending").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "50") || 50, 1), 200);
  const where = STATUSES.has(status) ? "WHERE d.status = ?" : "";
  const params = STATUSES.has(status) ? [status, limit] : [limit];

  const discussions = await all<{
    id: number;
    mock_id: number;
    question_id: number | null;
    user_id: number;
    parent_id: number | null;
    body: string;
    status: string;
    is_pinned: number;
    is_best_answer: number;
    upvotes: number;
    created_at: string;
    username: string;
    mock_title: string;
    mock_slug: string;
    question_text: string | null;
    report_count: number;
  }>(
    `SELECT d.id, d.mock_id, d.question_id, d.user_id, d.parent_id, d.body, d.status,
            d.is_pinned, d.is_best_answer, d.upvotes, d.created_at,
            u.username, m.title AS mock_title, m.slug AS mock_slug, q.text AS question_text,
            (SELECT COUNT(*) FROM discussion_reports dr WHERE dr.discussion_id = d.id) AS report_count
     FROM discussions d
     JOIN users u ON u.id = d.user_id
     JOIN mock_tests m ON m.id = d.mock_id
     LEFT JOIN questions q ON q.id = d.question_id
     ${where}
     ORDER BY d.created_at DESC
     LIMIT ?`,
    ...params,
  );

  return json({ ok: true, count: discussions.length, discussions });
};
