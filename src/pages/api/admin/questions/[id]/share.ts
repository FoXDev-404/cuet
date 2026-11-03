import type { APIRoute } from "astro";
import { requirePermission } from "../../../../../lib/auth/guard";
import { audit } from "../../../../../lib/audit";
import {
  getQuestionShareInfo,
  updateQuestionShare,
  type SharePatch,
} from "../../../../../lib/admin/share";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../../lib/http";

const BOOLEAN_FIELDS = ["share_enabled", "seo_indexable", "rights_ok"] as const;
const FIELD_NAMES = [...BOOLEAN_FIELDS, "reveal_policy"] as const;

export const GET: APIRoute = async (context) => {
  const guard = requirePermission(context, "questions.publish");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Invalid question id.", 404);

  try {
    const share = await getQuestionShareInfo(id);
    if (!share) return apiError("Question not found.", 404);
    return json({ ok: true, share });
  } catch (error) {
    console.error("question share read failed", error);
    return apiError("Could not load the sharing settings.", 500);
  }
};

export const PATCH: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "questions.publish");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Invalid question id.", 404);

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid JSON body.");
  }

  const unknown = Object.keys(body).filter(
    (key) => !(FIELD_NAMES as readonly string[]).includes(key),
  );
  if (unknown.length > 0) {
    return apiError(`Unknown sharing field: ${unknown[0]}.`);
  }

  const patch: SharePatch = {};
  for (const field of BOOLEAN_FIELDS) {
    if (!(field in body)) continue;
    if (typeof body[field] !== "boolean") {
      return apiError(`${field} must be true or false.`);
    }
    if (field === "share_enabled") patch.shareEnabled = body[field];
    if (field === "seo_indexable") patch.seoIndexable = body[field];
    if (field === "rights_ok") patch.rightsOk = body[field];
  }

  if ("reveal_policy" in body) {
    const value = String(body.reveal_policy);
    if (value !== "attempted_only" && value !== "public") {
      return apiError("reveal_policy must be attempted_only or public.");
    }
    patch.revealPolicy = value;
  }

  if (Object.keys(patch).length === 0) {
    return apiError("No sharing fields supplied.");
  }

  const before = await getQuestionShareInfo(id);
  if (!before) return apiError("Question not found.", 404);

  const result = await updateQuestionShare(id, patch);
  if (!result.ok) return apiError(result.error, result.status);

  await audit({
    adminId: guard.admin.id,
    action: "question.share_update",
    entityType: "question",
    entityId: id,
    diff: {
      public_id: result.info.publicId,
      before: before.flags,
      after: result.info.flags,
      changed: result.changed,
      cleared: result.cleared,
    },
  });

  return json({
    ok: true,
    share: result.info,
    changed: result.changed,
    cleared: result.cleared,
  });
};

export const prerender = false;
