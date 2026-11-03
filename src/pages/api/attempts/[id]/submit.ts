import type { APIRoute } from "astro";
import {
  attemptQuestions,
  canAccessAttempt,
  finalizeAttempt,
  findAttempt,
  hasExpired,
} from "../../../../lib/attempts";
import { getGuestToken } from "../../../../lib/auth/session";
import { rateLimit } from "../../../../lib/auth/rate-limit";
import { normalizeIncomingAnswers, saveAttemptAnswers } from "../../../../lib/attempt-save";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();

  const id = Number(context.params.id);
  let attempt = await findAttempt(id);
  if (!attempt || !canAccessAttempt(attempt, context.locals.user, getGuestToken(context.cookies))) {
    return apiError("Attempt not found.", 404);
  }
  if (attempt.status !== "in_progress") {
    return json({ ok: true, status: attempt.status, redirect: `/result/${attempt.id}` });
  }

  const submitter = attempt.user_id ? `user-${attempt.user_id}` : `guest-${attempt.guest_token}`;
  const limit = await rateLimit("submit", submitter, 5, 60);
  if (!limit.allowed) return apiError("Too many submit attempts. Try again in a minute.", 429);

  let body: Record<string, unknown> = {};
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    // A submit without a body still scores the last autosaved answers.
  }

  if (Array.isArray(body.answers)) {
    const questions = await attemptQuestions(attempt.version_id);
    const normalized = normalizeIncomingAnswers(body.answers, questions);
    if ("error" in normalized) return apiError(normalized.error);
    await saveAttemptAnswers(attempt.id, normalized.answers);
  }

  attempt = (await findAttempt(attempt.id)) ?? attempt;
  if (hasExpired(attempt)) {
    await finalizeAttempt(attempt, "expired");
    return json({ ok: true, status: "expired", redirect: `/result/${attempt.id}` });
  }

  await finalizeAttempt(attempt, "submitted");
  const scored = (await findAttempt(attempt.id)) ?? attempt;
  return json({
    ok: true,
    status: scored.status,
    score: scored.score,
    redirect: `/result/${scored.id}`,
  });
};
