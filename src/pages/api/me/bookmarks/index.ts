import type { APIRoute } from "astro";
import {
  addBookmark,
  findPublishedQuestion,
  isBookmarked,
  listBookmarks,
  removeBookmark,
} from "../../../../lib/bookmarks";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) return apiError("Login required.", 401);

  const bookmarks = await listBookmarks(user.id);
  return json({ ok: true, count: bookmarks.length, bookmarks });
};

/** Blueprint alias: list, add, remove or toggle a saved question. */
export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const user = context.locals.user;
  if (!user) return apiError("Login required.", 401);

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid request body.");
  }

  const questionId = Number(body.questionId);
  if (!Number.isInteger(questionId) || questionId <= 0) return apiError("Choose a valid question.");
  const action = String(body.action ?? "add").toLowerCase();
  if (!["add", "remove", "toggle"].includes(action)) {
    return apiError("Action must be add, remove or toggle.");
  }

  const existing = await isBookmarked(user.id, questionId);
  const shouldRemove = action === "remove" || (action === "toggle" && existing);
  if (shouldRemove) {
    await removeBookmark(user.id, questionId);
    return json({ ok: true, questionId, bookmarked: false });
  }

  const question = await findPublishedQuestion(questionId);
  if (!question) return apiError("Question not found.", 404);
  const note = String(body.note ?? "").trim().slice(0, 500);
  await addBookmark(user.id, questionId, note);
  return json({ ok: true, questionId, bookmarked: true }, 201);
};
