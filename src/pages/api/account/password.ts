import type { APIRoute } from "astro";
import { first, run } from "../../../lib/db";
import { hashPassword, verifyPassword } from "../../../lib/auth/password";
import { createSession, destroySession } from "../../../lib/auth/session";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../lib/http";

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

  const current = String(body.current_password ?? "");
  const next = String(body.new_password ?? "");
  if (next.length < 8) return apiError("The new password must be at least 8 characters.");

  const row = await first<{ password_hash: string | null }>(
    "SELECT password_hash FROM users WHERE id = ? AND deleted_at IS NULL",
    user.id,
  );
  if (!row) return apiError("Account not found.", 404);
  if (!row.password_hash) {
    return apiError("This account signs in with Google. Password login is not enabled for it.", 400);
  }
  if (!(await verifyPassword(current, row.password_hash))) {
    return apiError("The current password is incorrect.", 403);
  }

  await run(
    "UPDATE users SET password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    await hashPassword(next),
    user.id,
  );

  // Rotate every session after a credential change.
  await run("DELETE FROM sessions WHERE user_id = ?", user.id);
  await destroySession(context.cookies);
  await createSession(context.cookies, user.id);
  return json({ ok: true });
};
