import type { APIRoute } from "astro";
import {
  canAccessAttempt,
  findAttempt,
  loadResult,
  settleAttempt,
} from "../../../lib/attempts";
import { getGuestToken } from "../../../lib/auth/session";
import { apiError, json } from "../../../lib/http";

export const GET: APIRoute = async (context) => {
  const id = Number(context.params.attemptId);
  if (!Number.isInteger(id) || id <= 0) return apiError("Result not found.", 404);
  let attempt = await findAttempt(id);
  if (!attempt || !canAccessAttempt(attempt, context.locals.user, getGuestToken(context.cookies))) {
    return apiError("Result not found.", 404);
  }

  attempt = await settleAttempt(attempt);
  if (attempt.status === "in_progress") {
    return json({ ok: false, status: "in_progress", redirect: `/attempt/${attempt.id}` }, 409);
  }

  const result = await loadResult(attempt);
  if (!result) return apiError("Result not found.", 404);
  return json({ ok: true, ...result, serverNow: new Date().toISOString() });
};
