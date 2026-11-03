import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import { createRescoreJob, previewRescore, type RescoreScope } from "../../../../lib/admin/rescore";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

function parseScope(body: Record<string, unknown>): RescoreScope {
  const attemptIds = Array.isArray(body.attemptIds)
    ? body.attemptIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
    : undefined;
  const mockId = Number(body.mockId ?? 0) || undefined;
  const questionId = Number(body.questionId ?? 0) || undefined;
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 1000) : undefined;
  return { attemptIds, mockId, questionId, reason };
}

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Expected a JSON body.");
  }

  const mode = body.mode === "start" ? "start" : "preview";
  const guard = requirePermission(context, mode === "start" ? "attempts.rescore" : "attempts.view");
  if (guard.response) return guard.response;

  const scope = parseScope(body);
  if (mode === "preview") {
    const preview = await previewRescore(scope);
    return json(preview);
  }

  if (!scope.attemptIds?.length && !scope.mockId && !scope.questionId) {
    return apiError("Choose a question, a mock or a set of attempts to rescore.");
  }

  const jobId = await createRescoreJob(scope, guard.admin.id);
  await audit({
    adminId: guard.admin.id,
    action: "rescore.start",
    entityType: "rescore_jobs",
    entityId: jobId,
    diff: { scope: { ...scope, attemptIds: scope.attemptIds?.length ?? 0 }, reason: scope.reason },
  });
  return json({ ok: true, jobId }, 201);
};

export const prerender = false;
