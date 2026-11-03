import type { APIRoute } from "astro";
import { run } from "../../../lib/db";
import { destroySession } from "../../../lib/auth/session";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../lib/http";

/**
 * Soft-delete the account and anonymise personal identifiers. Historical
 * attempts stay for leaderboard integrity; public queries filter deleted users.
 */
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
  if (String(body.confirm ?? "") !== "DELETE") {
    return apiError("Type DELETE to confirm account deletion.");
  }

  await run(
    `UPDATE users SET
       deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
       email = 'deleted-' || id || '@invalid.local',
       username = 'deleted-' || id,
       password_hash = NULL,
       google_id = NULL,
       avatar_url = NULL,
       bio = NULL,
       target_exam_date = NULL,
       is_profile_public = 0,
       muted_until = NULL,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ? AND deleted_at IS NULL`,
    user.id,
  );
  await run("DELETE FROM sessions WHERE user_id = ?", user.id);
  await run("DELETE FROM password_resets WHERE user_id = ?", user.id);
  await run("DELETE FROM email_verifications WHERE user_id = ?", user.id);
  await run("DELETE FROM bookmarks WHERE user_id = ?", user.id);
  await run("DELETE FROM discussion_votes WHERE user_id = ?", user.id);
  await destroySession(context.cookies);

  return json({ ok: true, redirect: "/" });
};
