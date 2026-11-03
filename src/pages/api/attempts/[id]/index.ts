import type { APIRoute } from "astro";
import {
  attemptAnswers,
  attemptQuestions,
  canAccessAttempt,
  findAttempt,
  remainingSeconds,
  settleAttempt,
} from "../../../../lib/attempts";
import { getGuestToken } from "../../../../lib/auth/session";
import { apiError, json } from "../../../../lib/http";

export const GET: APIRoute = async (context) => {
  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Attempt not found.", 404);
  let attempt = await findAttempt(id);
  if (!attempt) return apiError("Attempt not found.", 404);
  if (!canAccessAttempt(attempt, context.locals.user, getGuestToken(context.cookies))) {
    return apiError("Attempt not found.", 404);
  }

  attempt = await settleAttempt(attempt);
  if (attempt.status !== "in_progress") {
    return json({
      ok: true,
      status: attempt.status,
      redirect: `/result/${attempt.id}`,
      attemptId: attempt.id,
    });
  }

  const [questions, answers] = await Promise.all([
    attemptQuestions(attempt.version_id),
    attemptAnswers(attempt.id),
  ]);

  return json({
    ok: true,
    attemptId: attempt.id,
    mockId: attempt.mock_id,
    status: attempt.status,
    deadlineAt: attempt.deadline_at,
    serverNow: new Date().toISOString(),
    remainingSec: remainingSeconds(attempt),
    questions,
    answers,
  });
};
