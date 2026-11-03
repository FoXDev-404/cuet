import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import {
  findPassage,
  parsePassageInput,
  softDeletePassage,
  updatePassage,
} from "../../../../lib/admin/passages";
import { snapshotEntity } from "../../../../lib/admin/revisions";
import { run } from "../../../../lib/db";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

export const PATCH: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "taxonomy.write");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Passage not found.", 404);
  const existing = await findPassage(id);
  if (!existing || existing.deleted_at) return apiError("Passage not found.", 404);

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Expected a JSON body.");
  }
  const parsed = parsePassageInput(body);
  if ("error" in parsed) return apiError(parsed.error);

  await snapshotEntity({
    entityType: "passages",
    entityId: id,
    adminId: guard.admin.id,
    reason: "Before passage edit",
  });
  await updatePassage(id, parsed.input);
  await audit({
    adminId: guard.admin.id,
    action: "passage.update",
    entityType: "passages",
    entityId: id,
    diff: { subject_id: parsed.input.subject_id },
  });
  return json({ ok: true, id });
};

export const DELETE: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "taxonomy.write");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Passage not found.", 404);
  const existing = await findPassage(id);
  if (!existing || existing.deleted_at) return apiError("Passage not found.", 404);

  if (context.url.searchParams.get("purge") === "1") {
    if (guard.admin.role !== "super") return apiError("Only a Super Admin can purge.", 403);
    if (context.url.searchParams.get("confirm") !== String(id)) {
      return apiError("Typed confirmation does not match the passage id.");
    }
    try {
      await run("DELETE FROM passages WHERE id = ?", id);
    } catch {
      return apiError(
        "Questions still reference this passage. Reassign or delete them before purging.",
        409,
      );
    }
    await audit({
      adminId: guard.admin.id,
      action: "passage.purge",
      entityType: "passages",
      entityId: id,
      diff: { body: existing.body.slice(0, 200) },
    });
    return json({ ok: true });
  }

  await snapshotEntity({
    entityType: "passages",
    entityId: id,
    adminId: guard.admin.id,
    reason: "Before soft delete",
  });
  await softDeletePassage(id);
  await audit({
    adminId: guard.admin.id,
    action: "passage.delete",
    entityType: "passages",
    entityId: id,
  });
  return json({ ok: true, trash: "/admin/trash?table=passages" });
};

export const prerender = false;
