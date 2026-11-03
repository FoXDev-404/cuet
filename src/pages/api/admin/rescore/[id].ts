import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import { runRescoreJob } from "../../../../lib/admin/rescore";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "attempts.rescore");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Invalid job id.", 404);

  let batchSize = 8;
  try {
    const body = (await context.request.json()) as { batchSize?: unknown };
    const requested = Number(body.batchSize);
    if (Number.isInteger(requested) && requested > 0) batchSize = Math.min(requested, 20);
  } catch {
    // An empty body runs the default batch.
  }

  try {
    const result = await runRescoreJob(id, guard.admin.id, batchSize);
    if (result.done) {
      await audit({
        adminId: guard.admin.id,
        action: "rescore.complete",
        entityType: "rescore_jobs",
        entityId: id,
        diff: result,
      });
    }
    return json(result);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Rescore failed.", 500);
  }
};

export const prerender = false;
