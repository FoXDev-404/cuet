import type { APIRoute } from "astro";
import { requirePermission } from "../../../../../lib/auth/guard";
import { audit } from "../../../../../lib/audit";
import { setMockArchived } from "../../../../../lib/admin/mocks";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../../lib/http";

/** POST archives; DELETE restores. Archive never removes attempts or versions. */
export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "mocks.write");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Invalid mock id.", 404);

  const result = await setMockArchived(id, true);
  if ("error" in result) return apiError(result.error, 404);
  await audit({
    adminId: guard.admin.id,
    action: "mock.archive",
    entityType: "mock_test",
    entityId: id,
    diff: { status: result.status },
  });
  return json({ ok: true, status: result.status });
};

export const DELETE: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "mocks.write");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Invalid mock id.", 404);

  const result = await setMockArchived(id, false);
  if ("error" in result) return apiError(result.error, 404);
  await audit({
    adminId: guard.admin.id,
    action: "mock.restore",
    entityType: "mock_test",
    entityId: id,
    diff: { status: result.status },
  });
  return json({ ok: true, status: result.status });
};

export const prerender = false;
