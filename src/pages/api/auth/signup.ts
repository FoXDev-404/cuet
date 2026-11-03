import type { APIRoute } from "astro";
import { createSession, GUEST_COOKIE } from "../../../lib/auth/session";
import { claimGuestAttempts, createPasswordUser, findUserByEmail, normalizeEmail } from "../../../lib/auth/users";
import { rateLimit } from "../../../lib/auth/rate-limit";
import { apiError, clientIp, forbiddenOrigin, isSameOrigin, json, safeNext, withQuery } from "../../../lib/http";
import { first } from "../../../lib/db";
import { getSetting } from "../../../lib/settings";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME = /^[A-Za-z0-9_]{3,30}$/;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOrigin(request)) return forbiddenOrigin();
  if ((await getSetting("registration_enabled", "true")) === "false") {
    return apiError("Registration is temporarily closed.", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid request body.");
  }

  const email = normalizeEmail(String(body.email ?? ""));
  const password = String(body.password ?? "");
  const username = String(body.username ?? "").trim();
  const next = safeNext(typeof body.next === "string" ? body.next : null, "/dashboard");

  if (!EMAIL.test(email)) return apiError("Enter a valid email address.");
  if (password.length < 8) return apiError("Password must be at least 8 characters.");
  if (password.length > 200) return apiError("Password is too long.");
  if (username && !USERNAME.test(username)) {
    return apiError("Username must be 3-30 letters, numbers or underscores.");
  }

  const limit = await rateLimit("signup", clientIp(request), 5, 60 * 60);
  if (!limit.allowed) return apiError("Too many signup attempts. Try again later.", 429);

  if (await findUserByEmail(email)) {
    return apiError("An account with this email already exists. Log in instead.", 409);
  }
  if (username) {
    const taken = await first<{ id: number }>("SELECT id FROM users WHERE username = ?", username);
    if (taken) return apiError("That username is already taken.", 409);
  }

  try {
    const user = await createPasswordUser({ email, password, username: username || undefined });
    await createSession(cookies, user.id);
    const claimed = await claimGuestAttempts(user.id, cookies.get(GUEST_COOKIE)?.value);
    cookies.delete(GUEST_COOKIE, { path: "/" });
    return json({ ok: true, redirect: claimed > 0 ? withQuery(next, "claimed", String(claimed)) : next });
  } catch (error) {
    console.error("signup failed", error);
    return apiError("Could not create the account. Try a different username.", 500);
  }
};
