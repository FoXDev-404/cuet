import type { APIRoute } from "astro";
import { removeBookmark } from "../../../lib/bookmarks";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../lib/http";

export const DELETE: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const user = context.locals.user;
  if (!user) return apiError("Login required.", 401);
  const questionId = Number(context.params.questionId);
  if (!Number.isInteger(questionId) || questionId <= 0) return apiError("Invalid question id.", 404);
  await removeBookmark(user.id, questionId);
  return json({ ok: true, questionId, bookmarked: false });
};
