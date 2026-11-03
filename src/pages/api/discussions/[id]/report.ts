import type { APIRoute } from "astro";
import { rateLimit } from "../../../../lib/auth/rate-limit";
import { hasFinishedAttempt } from "../../../../lib/discussions";
import { first, run } from "../../../../lib/db";
import { apiError, clientIp, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";
import { getSetting } from "../../../../lib/settings";

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const user = context.locals.user;
  if (!user) return apiError("Log in to report a comment.", 401);
  if (!context.locals.admin && (await getSetting("discussion_enabled", "true")) === "false") {
    return apiError("Discussions are temporarily paused.", 403);
  }

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Comment not found.", 404);

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid request body.");
  }
  const reason = String(body.reason ?? "").trim();
  if (reason.length < 5 || reason.length > 500) {
    return apiError("Explain the problem in 5-500 characters.");
  }

  const limit = await rateLimit("discussion-report", `${user.id}:${clientIp(context.request)}`, 10, 60 * 60);
  if (!limit.allowed) return apiError("Too many reports. Try again later.", 429);

  const discussion = await first<{ id: number; mock_id: number; status: string }>(
    "SELECT id, mock_id, status FROM discussions WHERE id = ?",
    id,
  );
  if (!discussion || discussion.status !== "visible") return apiError("Comment not found.", 404);

  if (!context.locals.admin && !(await hasFinishedAttempt(discussion.mock_id, user.id, null))) {
    return apiError("Finish this mock test before reporting a comment.", 403);
  }

  await run(
    "INSERT OR IGNORE INTO discussion_reports (discussion_id, user_id, reason) VALUES (?, ?, ?)",
    id,
    user.id,
    reason,
  );
  return json({ ok: true, message: "Report received. A moderator will review it." }, 201);
};
