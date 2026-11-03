import type { APIRoute } from "astro";
import { first } from "../../../../lib/db";
import { getGuestToken } from "../../../../lib/auth/session";
import { groupThreads, hasFinishedAttempt, loadVisibleThreads } from "../../../../lib/discussions";
import { apiError, isSameOrigin, json } from "../../../../lib/http";
import { getSetting } from "../../../../lib/settings";

export const GET: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return apiError("Cross-origin request blocked.", 403);

  const admin = context.locals.admin;
  if (!admin && (await getSetting("discussion_enabled", "true")) === "false") {
    return apiError("Discussions are temporarily paused.", 403);
  }

  const questionId = Number(context.params.id);
  if (!Number.isInteger(questionId) || questionId <= 0) return apiError("Question not found.", 404);

  const row = await first<{
    id: number;
    text: string;
    mock_id: number;
    mock_title: string;
    mock_slug: string;
  }>(
    `SELECT q.id, q.text, m.id AS mock_id, m.title AS mock_title, m.slug AS mock_slug
     FROM questions q
     JOIN mock_questions_current mq ON mq.question_id = q.id
     JOIN mock_tests m ON m.id = mq.mock_id
     WHERE q.id = ? AND q.status = 'published' AND q.deleted_at IS NULL
       AND m.status = 'published' AND m.deleted_at IS NULL
     ORDER BY m.published_at DESC, m.id DESC
     LIMIT 1`,
    questionId,
  );
  if (!row) return apiError("Question discussion not found.", 404);

  const user = context.locals.user;
  if (!admin && !(await hasFinishedAttempt(row.mock_id, user?.id ?? null, getGuestToken(context.cookies)))) {
    return apiError("Finish this mock test before reading its discussion.", 403);
  }

  const rows = await loadVisibleThreads(row.mock_id, row.id, user?.id ?? null);
  const threads = groupThreads(rows);
  return json({
    question: { id: row.id, text: row.text },
    mock: { id: row.mock_id, title: row.mock_title, slug: row.mock_slug },
    count: threads.length,
    threads,
  });
};
