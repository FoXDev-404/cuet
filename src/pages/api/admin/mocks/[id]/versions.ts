import type { APIRoute } from "astro";
import { requirePermission } from "../../../../../lib/auth/guard";
import { audit } from "../../../../../lib/audit";
import { createMockVersion, findMock, latestVersion } from "../../../../../lib/admin/mocks";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../../lib/http";

/** Create the next editable version from the currently published paper. */
export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "mocks.write");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Invalid mock id.", 404);
  const mock = await findMock(id);
  if (!mock || mock.deleted_at) return apiError("Mock test not found.", 404);
  if (mock.status !== "published") return apiError("Only published mocks need a new version.", 409);

  const latest = await latestVersion(id);
  if (latest && (latest.status === "draft" || latest.status === "in_review")) {
    return json({ ok: true, versionId: latest.id, versionNo: latest.version_no, existing: true });
  }

  try {
    const versionId = await createMockVersion(id, guard.admin.id);
    await audit({
      adminId: guard.admin.id,
      action: "mock.version.create",
      entityType: "mock_test",
      entityId: id,
      diff: { fromVersionId: latest?.id ?? null, versionId },
    });
    return json({ ok: true, versionId, redirect: `/admin/mocks/${id}` }, 201);
  } catch (error) {
    console.error("mock version create failed", error);
    return apiError("Could not create a new version.", 500);
  }
};
