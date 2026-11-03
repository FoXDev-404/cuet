import type { APIRoute } from "astro";
import { rateLimit } from "../../../../lib/auth/rate-limit";
import { hasFinishedAttempt } from "../../../../lib/discussions";
import { first, run } from "../../../../lib/db";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";
import { getSetting } from "../../../../lib/settings";

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const user = context.locals.user;
  if (!user) return apiError("Log in to vote.", 401);
  if (!context.locals.admin && (await getSetting("discussion_enabled", "true")) === "false") {
    return apiError("Discussions are temporarily paused.", 403);
  }

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Comment not found.", 404);

  const discussion = await first<{ id: number; mock_id: number; status: string }>(
    "SELECT id, mock_id, status FROM discussions WHERE id = ?",
    id,
  );
  if (!discussion || discussion.status !== "visible") return apiError("Comment not found.", 404);

  const limit = await rateLimit("discussion-vote", String(user.id), 30, 60);
  if (!limit.allowed) return apiError("Too many votes. Try again in a minute.", 429);

  if (!context.locals.admin && !(await hasFinishedAttempt(discussion.mock_id, user.id, null))) {
    return apiError("Finish this mock test before voting.", 403);
  }

  const existing = await first<{ discussion_id: number }>(
    "SELECT discussion_id FROM discussion_votes WHERE discussion_id = ? AND user_id = ?",
    id,
    user.id,
  );
  if (existing) {
    await run("DELETE FROM discussion_votes WHERE discussion_id = ? AND user_id = ?", id, user.id);
    await run("UPDATE discussions SET upvotes = MAX(0, upvotes - 1) WHERE id = ?", id);
  } else {
    await run("INSERT INTO discussion_votes (discussion_id, user_id) VALUES (?, ?)", id, user.id);
    await run("UPDATE discussions SET upvotes = upvotes + 1 WHERE id = ?", id);
  }

  const updated = await first<{ upvotes: number }>("SELECT upvotes FROM discussions WHERE id = ?", id);
  return json({ ok: true, voted: !existing, upvotes: updated?.upvotes ?? 0 });
};
