import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import { findDiscussion, recordApproval } from "../../../../lib/discussions";
import { run } from "../../../../lib/db";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

const ACTIONS = ["approve", "hide", "pin", "unpin", "best", "unbest"] as const;
type Action = (typeof ACTIONS)[number];

export const PATCH: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "moderation.write");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Comment not found.", 404);
  const discussion = await findDiscussion(id);
  if (!discussion) return apiError("Comment not found.", 404);

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid request body.");
  }
  const action = String(body.action ?? "") as Action;
  if (!ACTIONS.includes(action)) return apiError("Unknown moderation action.");

  const wasPending = discussion.status === "pending";
  try {
    switch (action) {
      case "approve":
        if (wasPending) {
          await recordApproval(discussion.id, discussion.user_id);
        } else {
          await run("UPDATE discussions SET status = 'visible' WHERE id = ?", discussion.id);
        }
        break;
      case "hide":
        await run("UPDATE discussions SET status = 'hidden' WHERE id = ?", discussion.id);
        break;
      case "pin":
        await run("UPDATE discussions SET is_pinned = 1 WHERE id = ?", discussion.id);
        break;
      case "unpin":
        await run("UPDATE discussions SET is_pinned = 0 WHERE id = ?", discussion.id);
        break;
      case "best":
        await run(
          `UPDATE discussions SET is_best_answer = 0
           WHERE mock_id = ? AND COALESCE(question_id, 0) = COALESCE(?, 0)`,
          discussion.mock_id,
          discussion.question_id,
        );
        await run(
          "UPDATE discussions SET is_best_answer = 1, status = 'visible' WHERE id = ?",
          discussion.id,
        );
        break;
      case "unbest":
        await run("UPDATE discussions SET is_best_answer = 0 WHERE id = ?", discussion.id);
        break;
    }
  } catch (error) {
    console.error("discussion moderation failed", error);
    return apiError("Could not update the comment.", 500);
  }

  await audit({
    adminId: guard.admin.id,
    action: `discussion.${action}`,
    entityType: "discussion",
    entityId: discussion.id,
    diff: { previous_status: discussion.status, user_id: discussion.user_id },
  });

  return json({ ok: true, action, id: discussion.id });
};
