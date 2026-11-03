import type { APIRoute } from "astro";
import { addBookmark, findPublishedQuestion, listBookmarks } from "../../../lib/bookmarks";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../lib/http";

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) return apiError("Login required.", 401);

  const bookmarks = await listBookmarks(user.id);
  return json({ ok: true, count: bookmarks.length, bookmarks });
};

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
  const note = String(body.note ?? "").trim().slice(0, 500);
  if (!Number.isInteger(questionId) || questionId <= 0) return apiError("Choose a valid question.");

  const question = await findPublishedQuestion(questionId);
  if (!question) return apiError("Question not found.", 404);

  await addBookmark(user.id, questionId, note);
  return json({ ok: true, questionId, bookmarked: true }, 201);
};
