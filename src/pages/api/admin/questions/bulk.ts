import type { APIRoute } from "astro";
import { run } from "../../../../lib/db";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import { updateQuestionShare, type SharePatch } from "../../../../lib/admin/share";
import { snapshotEntity } from "../../../../lib/admin/revisions";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

const STATUSES = ["draft", "in_review", "published"];
const DIFFICULTIES = ["easy", "medium", "hard"];
const SHARE_ACTIONS = ["share_enabled", "reveal_policy", "seo_indexable", "rights_ok"] as const;

function parseIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0),
  )].slice(0, 500);
}

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Expected a JSON body.");
  }

  const action = String(body.action ?? "");
  const ids = parseIds(body.ids);
  if (ids.length === 0) return apiError("Select at least one question.");

  const placeholders = ids.map(() => "?").join(", ");

  if ((SHARE_ACTIONS as readonly string[]).includes(action)) {
    const guard = requirePermission(context, "questions.publish");
    if (guard.response) return guard.response;
    if (guard.admin.role === "contributor") {
      return apiError("Contributors cannot change sharing settings.", 403);
    }
    if (ids.length > 100) {
      return apiError("Share bulk actions accept up to 100 questions at a time.");
    }

    const patch: SharePatch = {};
    if (action === "reveal_policy") {
      const value = String(body.value);
      if (value !== "attempted_only" && value !== "public") {
        return apiError("Invalid reveal policy.");
      }
      patch.revealPolicy = value;
    } else {
      const value = body.value;
      if (value !== true && value !== false && value !== 1 && value !== 0) {
        return apiError(`${action} must be true or false.`);
      }
      const enabled = value === true || value === 1;
      if (action === "share_enabled") patch.shareEnabled = enabled;
      if (action === "seo_indexable") patch.seoIndexable = enabled;
      if (action === "rights_ok") patch.rightsOk = enabled;
    }

    // Sharing validation is per question (rights, published mock membership,
    // explanation), so report skipped rows instead of failing the whole batch.
    const changed: number[] = [];
    const skipped: Array<{ id: number; error: string }> = [];
    const shareIds = ids.slice(0, 100);
    for (const id of shareIds) {
      const result = await updateQuestionShare(id, patch);
      if (result.ok) {
        if (result.changed.length > 0) changed.push(id);
      } else {
        skipped.push({ id, error: result.error });
      }
    }
    await audit({
      adminId: guard.admin.id,
      action: "question.bulk_share",
      entityType: "question",
      diff: {
        ids: shareIds,
        field: action,
        value: body.value,
        changed,
        skipped,
      },
    });
    return json({
      ok: true,
      changes: changed.length,
      changed,
      skipped,
    });
  }

  if (action === "delete") {
    const guard = requirePermission(context, "questions.delete");
    if (guard.response) return guard.response;
    if (guard.admin.role === "contributor") {
      return apiError("Contributors cannot bulk-delete questions.", 403);
    }
    for (const id of ids.slice(0, 50)) {
      await snapshotEntity({ entityType: "questions", entityId: id, adminId: guard.admin.id, reason: "Before bulk delete" });
    }
    const result = await run(
      `UPDATE questions SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
      ...ids,
    );
    await audit({
      adminId: guard.admin.id,
      action: "question.bulk_delete",
      entityType: "question",
      diff: { ids, changes: result.meta.changes ?? 0 },
    });
    return json({ ok: true, changes: result.meta.changes ?? 0 });
  }

  const guard = requirePermission(context, "questions.write");
  if (guard.response) return guard.response;

  let column = "";
  let value: string | number = "";

  if (action === "status") {
    if (!STATUSES.includes(String(body.value))) return apiError("Invalid status.");
    if (body.value === "published" && guard.admin.role === "contributor") {
      return apiError("Contributors cannot publish.", 403);
    }
    column = "status";
    value = String(body.value);
  } else if (action === "difficulty") {
    if (!DIFFICULTIES.includes(String(body.value))) return apiError("Invalid difficulty.");
    column = "difficulty";
    value = String(body.value);
  } else if (action === "subject") {
    const subjectId = Number(body.value);
    if (!Number.isInteger(subjectId) || subjectId <= 0) return apiError("Invalid subject.");
    column = "subject_id";
    value = subjectId;
  } else if (action === "topic") {
    const topicId = Number(body.value);
    if (!Number.isInteger(topicId) || topicId < 0) return apiError("Invalid topic.");
    column = "topic_id";
    value = topicId;
  } else {
    return apiError("Unsupported bulk action.");
  }

  if (guard.admin.role === "contributor") {
    const owned = await run(
      `UPDATE questions SET ${column} = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id IN (${placeholders}) AND deleted_at IS NULL AND created_by = ? AND status = 'draft'`,
      value,
      ...ids,
      guard.admin.id,
    );
    await audit({
      adminId: guard.admin.id,
      action: `question.bulk_${action}`,
      entityType: "question",
      diff: { ids, value, changes: owned.meta.changes ?? 0 },
    });
    return json({ ok: true, changes: owned.meta.changes ?? 0 });
  }

  const result = await run(
    `UPDATE questions SET ${column} = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
    value,
    ...ids,
  );
  await audit({
    adminId: guard.admin.id,
    action: `question.bulk_${action}`,
    entityType: "question",
    diff: { ids, value, changes: result.meta.changes ?? 0 },
  });
  return json({ ok: true, changes: result.meta.changes ?? 0 });
};

export const prerender = false;
