import type { APIRoute } from "astro";
import { can } from "../../../../../lib/auth/admin";
import { requirePermission } from "../../../../../lib/auth/guard";
import { audit } from "../../../../../lib/audit";
import { findMock, latestVersion, publishMockVersion } from "../../../../../lib/admin/mocks";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../../lib/http";

/**
 * Explicit publish endpoint. Editing a draft can request publishing, but this
 * route is the canonical action used by the builder and integrations.
 */
export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "mocks.write");
  if (guard.response) return guard.response;
  if (!can(guard.admin.role, "mocks.publish")) {
    return apiError("Your role cannot publish mock tests.", 403);
  }

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Mock test not found.", 404);

  const mock = await findMock(id);
  if (!mock || mock.deleted_at) return apiError("Mock test not found.", 404);

  const version = await latestVersion(id);
  if (!version) return apiError("Mock has no version to publish.", 409);
  if (version.status === "published") {
    return json({ ok: true, id, versionId: version.id, status: "published", alreadyPublished: true });
  }
  if (version.status === "superseded") {
    return apiError("The latest version is already superseded. Create a new version first.", 409);
  }

  try {
    await publishMockVersion(id, version.id);
    await audit({
      adminId: guard.admin.id,
      action: "mock.publish",
      entityType: "mock_test",
      entityId: id,
      diff: { versionId: version.id, versionNo: version.version_no },
    });
    return json({
      ok: true,
      id,
      versionId: version.id,
      versionNo: version.version_no,
      status: "published",
      redirect: `/admin/mocks/${id}`,
    });
  } catch (error) {
    console.error("mock publish failed", error);
    return apiError(
      error instanceof Error ? error.message : "Could not publish the mock test.",
      400,
    );
  }
};
