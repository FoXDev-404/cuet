import type { APIRoute } from "astro";
import { createSession, GUEST_COOKIE } from "../../../lib/auth/session";
import { verifyPassword } from "../../../lib/auth/password";
import { claimGuestAttempts, findUserByEmail, normalizeEmail } from "../../../lib/auth/users";
import { rateLimit } from "../../../lib/auth/rate-limit";
import { apiError, clientIp, forbiddenOrigin, isSameOrigin, json, safeNext, withQuery } from "../../../lib/http";

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid request body.");
  }

  const email = normalizeEmail(String(body.email ?? ""));
  const password = String(body.password ?? "");
  const next = safeNext(typeof body.next === "string" ? body.next : null, "/dashboard");
  if (!email || !password) return apiError("Enter your email and password.");

  const limit = await rateLimit("login", `${clientIp(request)}:${email}`, 10, 15 * 60);
  if (!limit.allowed) return apiError("Too many login attempts. Try again in 15 minutes.", 429);

  const user = await findUserByEmail(email);
  if (!user || user.deleted_at || !user.password_hash) {
    return apiError("Email or password is incorrect.", 401);
  }
  if (!(await verifyPassword(password, user.password_hash))) {
    return apiError("Email or password is incorrect.", 401);
  }

  await createSession(cookies, user.id);
  const claimed = await claimGuestAttempts(user.id, cookies.get(GUEST_COOKIE)?.value);
  cookies.delete(GUEST_COOKIE, { path: "/" });

  return json({ ok: true, redirect: claimed > 0 ? withQuery(next, "claimed", String(claimed)) : next });
};
