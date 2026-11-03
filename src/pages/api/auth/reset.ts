import type { APIRoute } from "astro";
import { hashPassword } from "../../../lib/auth/password";
import { sha256Hex } from "../../../lib/auth/session";
import { rateLimit } from "../../../lib/auth/rate-limit";
import { apiError, clientIp, forbiddenOrigin, isSameOrigin, json } from "../../../lib/http";
import { first, run } from "../../../lib/db";

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid request body.");
  }

  const token = String(body.token ?? "");
  const password = String(body.password ?? "");
  if (!token || token.length < 20) return apiError("This reset link is invalid.");
  if (password.length < 8) return apiError("Password must be at least 8 characters.");
  if (password.length > 200) return apiError("Password is too long.");

  const limit = await rateLimit("reset", clientIp(request), 10, 60 * 60);
  if (!limit.allowed) return apiError("Too many attempts. Try again later.", 429);

  const id = await sha256Hex(token);
  const reset = await first<{ user_id: number; expires_at: string; used_at: string | null }>(
    "SELECT user_id, expires_at, used_at FROM password_resets WHERE id = ?",
    id,
  );
  if (!reset || reset.used_at || reset.expires_at <= new Date().toISOString()) {
    return apiError("This reset link is invalid or has expired.", 400);
  }

  const passwordHash = await hashPassword(password);
  await run("UPDATE users SET password_hash = ? WHERE id = ?", passwordHash, reset.user_id);
  await run("UPDATE password_resets SET used_at = ? WHERE id = ?", new Date().toISOString(), id);
  await run("DELETE FROM sessions WHERE user_id = ?", reset.user_id);

  return json({ ok: true, redirect: "/login?reset=1" });
};
