import type { APIRoute } from "astro";
import { can } from "../../../../lib/auth/admin";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import { questionPayloadSchema } from "../../../../lib/content";
import {
  findDuplicateQuestion,
  findQuestion,
  insertQuestion,
  prepareQuestion,
  updateQuestionRow,
} from "../../../../lib/admin/questions";
import { previewRescore } from "../../../../lib/admin/rescore";
import { snapshotEntity } from "../../../../lib/admin/revisions";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";
import { run } from "../../../../lib/db";

export const PATCH: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "questions.write");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Invalid question id.", 404);
  const existing = await findQuestion(id);
  if (!existing || existing.deleted_at) return apiError("Question not found.", 404);

  // Contributors may only edit their own drafts.
  if (
    guard.admin.role === "contributor" &&
    (existing.created_by !== guard.admin.id || existing.status !== "draft")
  ) {
    return apiError("Contributors can only edit their own drafts.", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid JSON body.");
  }

  const hotfix = body.mode === "hotfix";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const requestedRescore = body.rescore === true;
  if (hotfix) {
    if (guard.admin.role !== "super") return apiError("Only a Super Admin can hotfix live content.", 403);
    if (reason.length < 10) return apiError("A written reason of at least 10 characters is required for a hotfix.");
    if (existing.status !== "published") {
      return apiError("Hotfix is only available for published questions. Use a normal edit for drafts.");
    }
  }

  const parsed = questionPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid question data.");
  }
  if (
    (parsed.data.status !== "draft" || existing.status === "published") &&
    !can(guard.admin.role, "questions.publish")
  ) {
    return apiError("Contributors can only save drafts. An editor must publish.", 403);
  }
  if (hotfix && parsed.data.status !== existing.status) {
    return apiError("A hotfix cannot change the published status. Unpublish or supersede instead.");
  }

  const prepared = await prepareQuestion(parsed.data);
  if ("error" in prepared) return apiError(prepared.error);

  const duplicate = await findDuplicateQuestion(
    prepared.input.subject_id,
    prepared.input.text,
    existing.id,
  );
  if (duplicate) {
    return apiError(
      `A question with the same text already exists in this subject (#${duplicate.id}, ${duplicate.status}). Edit that question instead of creating a duplicate.`,
      409,
    );
  }

  try {
    if (existing.status === "published" && !hotfix) {
      // Editors do not edit history: they create a new draft revision and
      // publishing moves the live pointer. Old attempts keep their answers.
      await snapshotEntity({
        entityType: "questions",
        entityId: existing.id,
        adminId: guard.admin.id,
        reason: "Before creating a superseding revision",
      });
      const newId = await insertQuestion(prepared.input, guard.admin.id, existing.id);
      await audit({
        adminId: guard.admin.id,
        action: "question.supersede",
        entityType: "question",
        entityId: newId,
        diff: { supersedes_id: existing.id, status: prepared.input.status },
      });
      return json({ ok: true, id: newId, redirect: `/admin/questions/${newId}`, superseded: true });
    }

    const revisionId = await snapshotEntity({
      entityType: "questions",
      entityId: existing.id,
      adminId: guard.admin.id,
      reason: hotfix ? reason : "Before edit",
    });

    await updateQuestionRow(id, prepared.input);

    if (hotfix && existing.correct_option !== prepared.input.correct_option) {
      const impact = await previewRescore({ questionId: id, reason });
      await audit({
        adminId: guard.admin.id,
        action: "question.hotfix",
        entityType: "question",
        entityId: id,
        diff: {
          reason,
          revisionId,
          before: {
            correct_option: existing.correct_option,
            text: existing.text,
            options: existing.options,
          },
          after: {
            correct_option: prepared.input.correct_option,
            text: prepared.input.text,
            options: prepared.input.options,
          },
          impact: { total: impact.total, changed: impact.changed },
        },
      });
      return json({
        ok: true,
        id,
        redirect: `/admin/questions/${id}`,
        hotfix: true,
        revisionId,
        impact,
        rescoreRequested: requestedRescore,
      });
    }

    await audit({
      adminId: guard.admin.id,
      action: hotfix ? "question.hotfix" : "question.update",
      entityType: "question",
      entityId: id,
      diff: { status: prepared.input.status, subject_id: prepared.input.subject_id, reason: hotfix ? reason : null },
    });
    return json({ ok: true, id, redirect: `/admin/questions/${id}`, revisionId });
  } catch (error) {
    console.error("question update failed", error);
    return apiError("Could not save the question.", 500);
  }
};

export const DELETE: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "questions.delete");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Invalid question id.", 404);
  const existing = await findQuestion(id);
  if (!existing || existing.deleted_at) return apiError("Question not found.", 404);
  if (guard.admin.role === "contributor" && existing.created_by !== guard.admin.id) {
    return apiError("Contributors can only delete their own questions.", 403);
  }
  if (existing.status === "published" && !can(guard.admin.role, "questions.publish")) {
    return apiError("Only an editor can delete a published question.", 403);
  }

  await snapshotEntity({
    entityType: "questions",
    entityId: id,
    adminId: guard.admin.id,
    reason: "Before soft delete",
  });
  await run(
    "UPDATE questions SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    id,
  );
  await audit({
    adminId: guard.admin.id,
    action: "question.delete",
    entityType: "question",
    entityId: id,
    diff: { status: existing.status },
  });
  return json({ ok: true, trash: `/admin/trash?table=questions` });
};

export const prerender = false;
