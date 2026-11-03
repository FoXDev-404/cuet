import type { APIRoute } from "astro";
import { requirePermission } from "../../../../../lib/auth/guard";
import { audit } from "../../../../../lib/audit";
import { findQuestion, insertQuestion, toDbInput } from "../../../../../lib/admin/questions";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../../lib/http";

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "questions.write");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Invalid question id.", 404);
  const existing = await findQuestion(id);
  if (!existing || existing.deleted_at) return apiError("Question not found.", 404);

  if (guard.admin.role === "contributor" && existing.created_by !== guard.admin.id) {
    return apiError("Contributors can only duplicate their own questions.", 403);
  }

  const input = toDbInput({
    subject_id: existing.subject_id,
    topic_id: existing.topic_id,
    passage_id: existing.passage_id,
    text: existing.text,
    text_hi: existing.text_hi,
    options: JSON.parse(existing.options),
    options_hi: existing.options_hi ? JSON.parse(existing.options_hi) : null,
    correct_option: existing.correct_option,
    explanation: existing.explanation,
    explanation_hi: existing.explanation_hi,
    difficulty: existing.difficulty as "easy" | "medium" | "hard" | null,
    year: existing.year,
    image_url: existing.image_url,
    image_alt: existing.image_alt,
    explanation_image_url: existing.explanation_image_url,
    explanation_image_alt: existing.explanation_image_alt,
    status: "draft",
  });

  const newId = await insertQuestion(input, guard.admin.id, null);
  await audit({
    adminId: guard.admin.id,
    action: "question.duplicate",
    entityType: "question",
    entityId: newId,
    diff: { source: id },
  });
  return json({ ok: true, id: newId, redirect: `/admin/questions/${newId}` }, 201);
};

export const prerender = false;
