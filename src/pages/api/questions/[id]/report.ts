import type { APIRoute } from "astro";
import { rateLimit } from "../../../../lib/auth/rate-limit";
import { apiError, clientIp, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";
import { first, run } from "../../../../lib/db";

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();

  const questionId = Number(context.params.id);
  if (!Number.isInteger(questionId) || questionId <= 0) {
    return apiError("Question not found.", 404);
  }
  const question = await first<{ id: number }>(
    "SELECT id FROM questions WHERE id = ? AND deleted_at IS NULL",
    questionId,
  );
  if (!question) {
    return apiError("Question not found.", 404);
  }

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid request body.");
  }

  const reason = String(body.reason ?? "").trim();
  if (reason.length < 5 || reason.length > 1000) {
    return apiError("Explain the problem in 5-1000 characters.");
  }

  const limit = await rateLimit("report", clientIp(context.request), 10, 60 * 60);
  if (!limit.allowed) {
    return apiError("Too many reports. Try again later.", 429);
  }

  await run(
    "INSERT INTO question_reports (question_id, user_id, reason) VALUES (?, ?, ?)",
    questionId,
    context.locals.user?.id ?? null,
    reason,
  );
  return json({ ok: true, message: "Report received. An editor will review it." }, 201);
};
