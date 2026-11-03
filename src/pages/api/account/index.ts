import type { APIRoute } from "astro";
import { first, run } from "../../../lib/db";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../lib/http";

const USERNAME = /^[A-Za-z0-9_]{3,30}$/;

export const PATCH: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const user = context.locals.user;
  if (!user) return apiError("Login required.", 401);

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid request body.");
  }

  const username = String(body.username ?? "").trim();
  const bio = String(body.bio ?? "").trim().slice(0, 500);
  const targetExamDate = String(body.target_exam_date ?? "").trim();
  const isPublic = body.is_profile_public ? 1 : 0;

  if (!USERNAME.test(username)) {
    return apiError("Username must be 3–30 letters, numbers or underscores.");
  }
  if (targetExamDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetExamDate)) {
    return apiError("Use a valid target exam date.");
  }

  const taken = await first<{ id: number }>(
    "SELECT id FROM users WHERE username = ? AND id != ?",
    username,
    user.id,
  );
  if (taken) return apiError("That username is already taken.", 409);

  await run(
    `UPDATE users SET username = ?, bio = ?, target_exam_date = ?, is_profile_public = ?
     WHERE id = ? AND deleted_at IS NULL`,
    username,
    bio || null,
    targetExamDate || null,
    isPublic,
    user.id,
  );
  return json({ ok: true, username, is_profile_public: isPublic });
};
