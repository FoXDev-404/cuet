import type { APIRoute } from "astro";
import { first } from "../../../../lib/db";
import { getGuestToken } from "../../../../lib/auth/session";
import { hasFinishedAttempt, loadMockThreadFeed } from "../../../../lib/discussions";
import { apiError, isSameOrigin, json } from "../../../../lib/http";
import { getSetting } from "../../../../lib/settings";

export const GET: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return apiError("Cross-origin request blocked.", 403);

  const admin = context.locals.admin;
  if (!admin && (await getSetting("discussion_enabled", "true")) === "false") {
    return apiError("Discussions are temporarily paused.", 403);
  }

  const mockId = Number(context.params.id);
  if (!Number.isInteger(mockId) || mockId <= 0) return apiError("Mock test not found.", 404);

  const mock = await first<{ id: number; title: string; slug: string }>(
    `SELECT id, title, slug FROM mock_tests
     WHERE id = ? AND status = 'published' AND deleted_at IS NULL`,
    mockId,
  );
  if (!mock) return apiError("Mock test not found.", 404);

  const user = context.locals.user;
  if (!admin && !(await hasFinishedAttempt(mock.id, user?.id ?? null, getGuestToken(context.cookies)))) {
    return apiError("Finish this mock test before reading its discussion.", 403);
  }

  const sort = context.url.searchParams.get("sort") === "top" ? "top" : "new";
  const cursor = Number(context.url.searchParams.get("cursor") ?? "0");
  const { threads, nextCursor } = await loadMockThreadFeed(mock.id, user?.id ?? null, {
    sort,
    cursor: Number.isInteger(cursor) && cursor > 0 ? cursor : 0,
  });

  return json({
    mock,
    sort,
    nextCursor,
    count: threads.length,
    threads,
  });
};
