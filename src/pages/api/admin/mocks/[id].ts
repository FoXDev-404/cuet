import type { APIRoute } from "astro";
import { can } from "../../../../lib/auth/admin";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import {
  findMock,
  latestVersion,
  mockPayloadSchema,
  prepareMock,
  publishMockVersion,
  updateMockDraft,
} from "../../../../lib/admin/mocks";
import { first, run } from "../../../../lib/db";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

export const PATCH: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "mocks.write");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Invalid mock id.", 404);
  const existing = await findMock(id);
  if (!existing || existing.deleted_at) return apiError("Mock test not found.", 404);

  const version = await latestVersion(id);
  if (!version) return apiError("Mock has no version row.", 500);
  if (version.status === "published" || version.status === "superseded") {
    return apiError("Published versions are frozen. Create a new version before editing.", 409);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return apiError("Invalid JSON body.");
  }
  const parsed = mockPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid mock data.");
  }
  if (parsed.data.status === "published" && !can(guard.admin.role, "mocks.publish")) {
    return apiError("Your role cannot publish mock tests.", 403);
  }

  const prepared = await prepareMock(parsed.data, existing.exam_id);
  if ("error" in prepared) return apiError(prepared.error);

  const slugTaken = await first<{ id: number }>(
    "SELECT id FROM mock_tests WHERE slug = ? AND id != ?",
    prepared.slug,
    id,
  );
  if (slugTaken) return apiError("That slug is already used. Pick another URL slug.", 409);

  try {
    if (prepared.slug !== existing.slug) {
      await run(
        `INSERT INTO slug_redirects (old_slug, entity_type, entity_id) VALUES (?, 'mock', ?)
         ON CONFLICT(old_slug) DO UPDATE SET entity_type = 'mock', entity_id = excluded.entity_id`,
        existing.slug,
        id,
      );
      await run(
        "DELETE FROM slug_redirects WHERE old_slug = ? AND entity_id = ?",
        prepared.slug,
        id,
      );
    }
    await updateMockDraft(id, prepared.input, prepared.slug, version);
    if (parsed.data.status === "published") {
      await publishMockVersion(id, version.id);
    }
    await audit({
      adminId: guard.admin.id,
      action: parsed.data.status === "published" ? "mock.publish" : "mock.update",
      entityType: "mock_test",
      entityId: id,
      diff: {
        versionId: version.id,
        versionNo: version.version_no,
        title: parsed.data.title,
        questions: parsed.data.questions.length,
        status: parsed.data.status,
        slug: prepared.slug !== existing.slug ? { from: existing.slug, to: prepared.slug } : undefined,
      },
    });
    return json({ ok: true, id, redirect: `/admin/mocks/${id}` });
  } catch (error) {
    console.error("mock update failed", error);
    return apiError(error instanceof Error ? error.message : "Could not save the mock test.", 500);
  }
};

export const DELETE: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "mocks.write");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  const existing = await findMock(id);
  if (!existing || existing.deleted_at) return apiError("Mock test not found.", 404);
  if (existing.status === "published") {
    return apiError("Published mocks cannot be deleted. Archive them instead.", 409);
  }

  await run(
    "UPDATE mock_tests SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    id,
  );
  await audit({
    adminId: guard.admin.id,
    action: "mock.delete",
    entityType: "mock_test",
    entityId: id,
    diff: { status: existing.status },
  });
  return json({ ok: true });
};
