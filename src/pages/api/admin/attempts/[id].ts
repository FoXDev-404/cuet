import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import { setAttemptVoided } from "../../../../lib/admin/rescore";
import { findAttemptDetail } from "../../../../lib/admin/attempts";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

export const GET: APIRoute = async (context) => {
  const guard = requirePermission(context, "attempts.view");
  if (guard.response) return guard.response;
  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Invalid attempt id.", 404);
  const detail = await findAttemptDetail(id);
  if (!detail) return apiError("Attempt not found.", 404);
  return json(detail);
};

export const PATCH: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "attempts.void");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Invalid attempt id.", 404);

  let body: { action?: string; reason?: string };
  try {
    body = (await context.request.json()) as { action?: string; reason?: string };
  } catch {
    return apiError("Expected a JSON body.");
  }
  if (body.action !== "void" && body.action !== "restore") {
    return apiError("action must be void or restore.");
  }

  const result = await setAttemptVoided(
    id,
    body.action === "void",
    body.reason ?? "",
    guard.admin.id,
  );
  if ("error" in result) return apiError(result.error, 400);

  if (result.changed) {
    await audit({
      adminId: guard.admin.id,
      action: `attempt.${body.action}`,
      entityType: "attempts",
      entityId: id,
      diff: { reason: body.reason ?? null },
    });
  }
  return json({ ok: true, changed: result.changed });
};

export const prerender = false;
