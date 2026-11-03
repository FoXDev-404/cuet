import type { APIRoute } from "astro";
import { run } from "../../../lib/db";
import { findDiscussion } from "../../../lib/discussions";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../lib/http";

export const DELETE: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();

  const user = context.locals.user;
  if (!user) return apiError("Login required.", 401);

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Comment not found.", 404);

  const discussion = await findDiscussion(id);
  if (!discussion || discussion.user_id !== user.id) return apiError("Comment not found.", 404);

  await run("UPDATE discussions SET status = 'hidden' WHERE id = ? AND user_id = ?", id, user.id);
  return json({ ok: true, id, deleted: true });
};
