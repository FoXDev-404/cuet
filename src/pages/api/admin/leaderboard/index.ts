import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import { disqualifyAttempt } from "../../../../lib/admin/mocks";
import { reinstateAttempt } from "../../../../lib/admin/leaderboard";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

const ACTIONS = ["disqualify", "reinstate"] as const;
type Action = (typeof ACTIONS)[number];

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "leaderboards.write");
  if (guard.response) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid request body.");
  }

  const attemptId = Number(body.attemptId);
  const action = String(body.action ?? "") as Action;
  if (!Number.isInteger(attemptId) || attemptId <= 0) return apiError("Attempt not found.", 404);
  if (!ACTIONS.includes(action)) return apiError("Unknown leaderboard action.");

  try {
    if (action === "disqualify") {
      const result = await disqualifyAttempt(attemptId, guard.admin.id);
      await audit({
        adminId: guard.admin.id,
        action: "leaderboard.disqualify",
        entityType: "attempt",
        entityId: attemptId,
        diff: result,
      });
      return json({ ok: true, action, ...result });
    }

    const result = await reinstateAttempt(attemptId, guard.admin.id);
    await audit({
      adminId: guard.admin.id,
      action: "leaderboard.reinstate",
      entityType: "attempt",
      entityId: attemptId,
      diff: result,
    });
    return json({ ok: true, action, ...result });
  } catch (error) {
    console.error("leaderboard action failed", error);
    return apiError(error instanceof Error ? error.message : "Could not update the leaderboard.", 400);
  }
};
