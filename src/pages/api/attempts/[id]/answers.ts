import type { APIRoute } from "astro";
import {
  attemptQuestions,
  canAccessAttempt,
  finalizeAttempt,
  findAttempt,
  hasExpired,
  remainingSeconds,
} from "../../../../lib/attempts";
import { getGuestToken } from "../../../../lib/auth/session";
import { normalizeIncomingAnswers, saveAttemptAnswers } from "../../../../lib/attempt-save";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

export const PUT: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();

  const id = Number(context.params.id);
  const attempt = await findAttempt(id);
  if (!attempt || !canAccessAttempt(attempt, context.locals.user, getGuestToken(context.cookies))) {
    return apiError("Attempt not found.", 404);
  }
  if (attempt.status !== "in_progress") {
    return json({ ok: false, status: attempt.status, redirect: `/result/${attempt.id}` }, 409);
  }
  if (hasExpired(attempt)) {
    await finalizeAttempt(attempt, "expired");
    return json({ ok: false, status: "expired", redirect: `/result/${attempt.id}` }, 409);
  }

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid request body.");
  }

  const questions = await attemptQuestions(attempt.version_id);
  const normalized = normalizeIncomingAnswers(body.answers, questions);
  if ("error" in normalized) return apiError(normalized.error);

  await saveAttemptAnswers(attempt.id, normalized.answers);
  return json({
    ok: true,
    saved: normalized.answers.length,
    serverNow: new Date().toISOString(),
    remainingSec: remainingSeconds(attempt),
  });
};

/** Blueprint API surface names PATCH; PUT is kept for older clients. */
export const PATCH: APIRoute = PUT;
