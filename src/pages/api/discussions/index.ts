import type { APIRoute } from "astro";
import { rateLimit } from "../../../lib/auth/rate-limit";
import { hasFinishedAttempt, hasLiveAttempt } from "../../../lib/discussions";
import { commentStatusFor, isTrustedContributor } from "../../../lib/moderation";
import { first, run } from "../../../lib/db";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../lib/http";
import { getSetting } from "../../../lib/settings";

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();

  const user = context.locals.user;
  if (!user) return apiError("Log in to join the discussion.", 401);
  if (!context.locals.admin && (await getSetting("discussion_enabled", "true")) === "false") {
    return apiError("Discussions are temporarily paused.", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid request body.");
  }

  const mockId = Number(body.mockId);
  const questionId = body.questionId === null || body.questionId === undefined || body.questionId === ""
    ? null
    : Number(body.questionId);
  const parentId = body.parentId === null || body.parentId === undefined || body.parentId === ""
    ? null
    : Number(body.parentId);
  const text = String(body.body ?? "").trim();

  if (!Number.isInteger(mockId) || mockId <= 0) return apiError("Invalid mock test.");
  if (questionId !== null && (!Number.isInteger(questionId) || questionId <= 0)) {
    return apiError("Invalid question.");
  }
  if (parentId !== null && (!Number.isInteger(parentId) || parentId <= 0)) {
    return apiError("Invalid reply target.");
  }
  if (text.length < 2 || text.length > 2000) {
    return apiError("Write between 2 and 2000 characters.");
  }

  const limit = await rateLimit("comment", String(user.id), 5, 60);
  if (!limit.allowed) return apiError("Too many comments. Try again in a minute.", 429);

  const mock = await first<{ id: number }>(
    "SELECT id FROM mock_tests WHERE id = ? AND status = 'published' AND deleted_at IS NULL",
    mockId,
  );
  if (!mock) return apiError("This mock test is not available.", 404);

  if (
    !context.locals.admin &&
    !(await hasFinishedAttempt(mockId, user.id, null)) &&
    !(await hasLiveAttempt(mockId, user.id))
  ) {
    return apiError("Start this mock test or finish an attempt before joining its discussion.", 403);
  }

  if (questionId !== null) {
    const linked = await first<{ question_id: number }>(
      "SELECT question_id FROM mock_questions_current WHERE mock_id = ? AND question_id = ?",
      mockId,
      questionId,
    );
    if (!linked) return apiError("That question is not part of this mock.", 400);
  }

  if (parentId !== null) {
    const parent = await first<{ id: number; mock_id: number; parent_id: number | null; question_id: number | null }>(
      "SELECT id, mock_id, parent_id, question_id FROM discussions WHERE id = ?",
      parentId,
    );
    if (!parent || parent.mock_id !== mockId) return apiError("Reply target not found.", 404);
    if (parent.parent_id !== null) return apiError("Replies can only be one level deep.");
    if (questionId !== null && parent.question_id !== null && parent.question_id !== questionId) {
      return apiError("Reply target belongs to a different question.");
    }
  }

  const account = await first<{ approved_comments: number; muted_until: string | null }>(
    "SELECT approved_comments, muted_until FROM users WHERE id = ?",
    user.id,
  );
  if (!account) return apiError("Account not found.", 404);
  if (account.muted_until && account.muted_until > new Date().toISOString()) {
    return apiError("Your account is muted. Contact the moderator.", 403);
  }

  const trusted = isTrustedContributor(account.approved_comments);
  const status = commentStatusFor(account.approved_comments);
  try {
    const result = await run(
      `INSERT INTO discussions (mock_id, question_id, user_id, parent_id, body, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      mockId,
      questionId,
      user.id,
      parentId,
      text,
      status,
    );
    return json(
      {
        ok: true,
        id: Number(result.meta.last_row_id),
        status,
        message: trusted
          ? "Posted."
          : "Comment submitted. A moderator will review it before it appears publicly.",
      },
      201,
    );
  } catch (error) {
    console.error("discussion create failed", error);
    return apiError("Could not save the comment.", 500);
  }
};
