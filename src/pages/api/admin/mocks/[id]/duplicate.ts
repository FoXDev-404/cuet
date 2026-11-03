import type { APIRoute } from "astro";
import { requirePermission } from "../../../../../lib/auth/guard";
import { audit } from "../../../../../lib/audit";
import { duplicateMock } from "../../../../../lib/admin/mocks";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../../lib/http";

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "mocks.write");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Invalid mock id.", 404);

  try {
    const result = await duplicateMock(id, guard.admin.id);
    if ("error" in result) return apiError(result.error, 404);
    await audit({
      adminId: guard.admin.id,
      action: "mock.duplicate",
      entityType: "mock_test",
      entityId: result.id,
      diff: { source_id: id, slug: result.slug },
    });
    return json({ ok: true, id: result.id, redirect: `/admin/mocks/${result.id}` }, 201);
  } catch (error) {
    console.error("mock duplicate failed", error);
    return apiError(error instanceof Error ? error.message : "Could not duplicate the mock.", 500);
  }
};

export const prerender = false;
