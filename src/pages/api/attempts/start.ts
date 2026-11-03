import type { APIRoute } from "astro";
import { ensureGuestToken, getGuestToken } from "../../../lib/auth/session";
import { rateLimit } from "../../../lib/auth/rate-limit";
import { findInProgressAttempt, settleAttempt } from "../../../lib/attempts";
import { first, run } from "../../../lib/db";
import { apiError, clientIp, forbiddenOrigin, isSameOrigin, json } from "../../../lib/http";

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid request body.");
  }

  const mockId = Number(body.mockId);
  if (!Number.isInteger(mockId) || mockId <= 0) return apiError("Choose a valid mock test.");

  const mock = await first<{
    id: number;
    title: string;
    status: string;
    deleted_at: string | null;
    version_id: number | null;
    duration_min: number | null;
  }>(
    `SELECT m.id, m.title, m.status, m.deleted_at, m.current_version_id AS version_id,
            v.duration_min
     FROM mock_tests m
     LEFT JOIN mock_test_versions v ON v.id = m.current_version_id
     WHERE m.id = ?`,
    mockId,
  );
  if (!mock || mock.deleted_at || mock.status !== "published" || !mock.version_id || !mock.duration_min) {
    return apiError("This mock test is not available.", 404);
  }

  const user = context.locals.user;
  const startLimit = await rateLimit(
    "attempt-start",
    user ? `user-${user.id}` : `ip-${clientIp(context.request)}`,
    20,
    10 * 60,
  );
  if (!startLimit.allowed) {
    return apiError("Too many attempt starts. Wait a few minutes and try again.", 429);
  }

  let guestToken = getGuestToken(context.cookies);
  const existing = await findInProgressAttempt(mockId, user?.id ?? null, guestToken);
  if (existing) {
    const settled = await settleAttempt(existing);
    if (settled.status === "in_progress") {
      return json({
        ok: true,
        attemptId: existing.id,
        redirect: `/attempt/${existing.id}`,
        resumed: true,
      });
    }
  }

  if (!user && !guestToken) guestToken = ensureGuestToken(context.cookies);

  const startedAt = new Date();
  const deadlineAt = new Date(startedAt.getTime() + mock.duration_min * 60 * 1000);
  const result = await run(
    `INSERT INTO attempts (user_id, guest_token, mock_id, version_id, status, started_at, deadline_at)
     VALUES (?, ?, ?, ?, 'in_progress', ?, ?)`,
    user?.id ?? null,
    user ? null : guestToken,
    mockId,
    mock.version_id,
    startedAt.toISOString(),
    deadlineAt.toISOString(),
  );
  const attemptId = Number(result.meta.last_row_id);
  return json(
    { ok: true, attemptId, redirect: `/attempt/${attemptId}`, deadlineAt: deadlineAt.toISOString() },
    201,
  );
};
