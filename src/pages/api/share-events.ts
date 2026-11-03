import type { APIRoute } from "astro";
import { rateLimit } from "../../lib/auth/rate-limit";
import { first, run } from "../../lib/db";
import { apiError, clientIp, forbiddenOrigin, isSameOrigin, json } from "../../lib/http";
import { normalizeShareEvent } from "../../lib/share/events";

/**
 * Aggregate share analytics. The event table is intentionally small: no IP,
 * attempt id, score or email is stored. A signed-in viewer contributes only
 * their user id; guests contribute a null user id.
 */
export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();

  const user = context.locals.user;
  const limit = await rateLimit(
    "share-events",
    user ? `u:${user.id}` : `ip:${clientIp(context.request)}`,
    60,
    60,
  );
  if (!limit.allowed) {
    return apiError("Too many share events. Wait a moment and try again.", 429);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return apiError("Invalid JSON body.");
  }

  const parsed = normalizeShareEvent(body);
  if (!parsed.ok) return apiError(parsed.error, 400);
  const event = parsed.event;

  if (event.publicId) {
    const exists = await first<{ ok: number }>(
      "SELECT 1 AS ok FROM question_public_ids WHERE public_id = ?",
      event.publicId,
    );
    if (!exists) return apiError("Question not found.", 404);
  }
  if (event.mockId !== null) {
    const exists = await first<{ ok: number }>(
      "SELECT 1 AS ok FROM mock_tests WHERE id = ? AND deleted_at IS NULL",
      event.mockId,
    );
    if (!exists) return apiError("Mock test not found.", 404);
  }

  await run(
    `INSERT INTO share_events (public_id, mock_id, user_id, context, channel)
     VALUES (?, ?, ?, ?, ?)`,
    event.publicId,
    event.mockId,
    user?.id ?? null,
    event.context,
    event.channel,
  );

  return json({ ok: true }, 202);
};

export const prerender = false;
