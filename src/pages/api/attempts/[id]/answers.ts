import type { APIRoute } from "astro";
import {
  canAccessAttempt,
  finalizeAttempt,
  findAttempt,
  hasExpired,
  remainingSeconds,
} from "../../../../lib/attempts";
import { getGuestToken } from "../../../../lib/auth/session";
import { normalizeIncomingAnswers, saveAttemptAnswers } from "../../../../lib/attempt-save";
import { getMockVersionQuestionMeta } from "../../../../lib/mock-cache";
import { run } from "../../../../lib/db";
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

  const clientSeq = typeof body.seq === "number" ? Math.floor(body.seq) : 0;
  const lastSeq = attempt.last_client_seq ?? 0;

  // Stale out-of-order autosave request arriving after a newer sequence
  if (clientSeq > 0 && clientSeq < lastSeq) {
    return json({
      ok: true,
      ignored: true,
      reason: "out_of_order",
      lastSeq,
      remainingSec: remainingSeconds(attempt),
    });
  }

  const metaMap = await getMockVersionQuestionMeta(attempt.version_id);
  const normalized = normalizeIncomingAnswers(body.answers, metaMap, clientSeq);
  if ("error" in normalized) return apiError(normalized.error);

  if (normalized.answers.length > 0) {
    await saveAttemptAnswers(attempt.id, normalized.answers, clientSeq);
  }

  if (clientSeq > lastSeq) {
    await run("UPDATE attempts SET last_client_seq = ? WHERE id = ?", clientSeq, attempt.id);
  }

  return json({
    ok: true,
    saved: normalized.answers.length,
    seq: clientSeq,
    serverNow: new Date().toISOString(),
    remainingSec: remainingSeconds(attempt),
  });
};

/** Blueprint API surface names PATCH; PUT is kept for older clients; POST handles navigator.sendBeacon. */
export const PATCH: APIRoute = PUT;
export const POST: APIRoute = PUT;
