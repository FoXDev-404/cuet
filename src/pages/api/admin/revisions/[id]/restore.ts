import type { APIRoute } from "astro";
import { requirePermission } from "../../../../../lib/auth/guard";
import { audit } from "../../../../../lib/audit";
import { findRevision, restoreRevision } from "../../../../../lib/admin/revisions";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../../lib/http";

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "revisions.restore");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Invalid revision id.", 404);
  const revision = await findRevision(id);
  if (!revision) return apiError("Revision not found.", 404);

  const result = await restoreRevision(revision, guard.admin.id);
  if ("error" in result) return apiError(result.error, 400);

  await audit({
    adminId: guard.admin.id,
    action: "revision.restore",
    entityType: revision.entity_type,
    entityId: revision.entity_id,
    diff: { revisionId: id, reason: revision.reason },
  });
  return json({ ok: true });
};

export const prerender = false;
