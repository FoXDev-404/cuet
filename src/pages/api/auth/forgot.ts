import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { randomToken, sha256Hex } from "../../../lib/auth/session";
import { findUserByEmail, normalizeEmail } from "../../../lib/auth/users";
import { rateLimit } from "../../../lib/auth/rate-limit";
import { apiError, clientIp, forbiddenOrigin, isSameOrigin, json } from "../../../lib/http";
import { run } from "../../../lib/db";
import { siteUrl } from "../../../lib/site-url";
import { getSetting } from "../../../lib/settings";
import { buildPasswordResetEmail, devResetLinkAllowed } from "../../../lib/email-config";
import { emailConfigured, sendEmailWithEnv } from "../../../lib/email";

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid request body.");
  }

  const email = normalizeEmail(String(body.email ?? ""));
  if (!email) return apiError("Enter your email address.");

  const devResetLink = devResetLinkAllowed(import.meta.env.PROD, env.DEV_SHOW_RESET_LINK);
  const mailReady = emailConfigured();
  if (!mailReady && !devResetLink) {
    return apiError(
      "Password reset by email is not available yet. Contact support@cuetfreemocktest.com.",
      503,
    );
  }

  const limit = await rateLimit("forgot", `${clientIp(request)}:${email}`, 3, 60 * 60);
  if (!limit.allowed) return apiError("Too many reset requests. Try again later.", 429);

  const generic = {
    ok: true,
    message: "If that email has an account, a reset link has been created.",
  };

  const user = await findUserByEmail(email);
  if (!user || user.deleted_at) return json(generic);

  const token = randomToken();
  const id = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await run("DELETE FROM password_resets WHERE user_id = ? OR expires_at <= ?", user.id, new Date().toISOString());
  await run(
    "INSERT INTO password_resets (id, user_id, expires_at) VALUES (?, ?, ?)",
    id,
    user.id,
    expiresAt,
  );

  if (devResetLink) {
    // Never available in a production build, even if the flag is copied over.
    return json({ ...generic, devResetUrl: `/reset-password/${token}` });
  }

  const siteName = await getSetting("site_name", "CUET Free Mock Test");
  const resetUrl = new URL(`/reset-password/${token}`, siteUrl(request.url)).toString();
  const result = await sendEmailWithEnv(buildPasswordResetEmail(email, resetUrl, siteName));
  if (!result.ok) {
    // Status only: no token, reset URL or provider key reaches the logs.
    console.error("Password reset email failed:", result.error);
  }

  return json(generic);
};
