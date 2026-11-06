import type { APIRoute } from "astro";
import { destroySession } from "../../../lib/auth/session";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../lib/http";
import { softDeleteUserAccount } from "../../../lib/user-deletion";

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

  await softDeleteUserAccount(user.id);
  await destroySession(context.cookies);

  return json({ ok: true, redirect: "/" });
};
