import type { APIRoute } from "astro";
import { z } from "zod";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import { first, run } from "../../../../lib/db";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

const reviewActionSchema = z.object({
  table: z.enum(["practice_questions", "questions"]),
  questionId: z.number().int().positive(),
  action: z.enum(["approve", "flag", "edit"]),
  explanation: z.string().trim().optional(),
});

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "questions.write");
  if (guard.response) return guard.response;

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return apiError("Invalid JSON body.");
  }

  const parsed = reviewActionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid review action payload.");
  }

  const { table, questionId, action, explanation } = parsed.data;

  // Fetch current question state to verify constraints
  const question = await first<{ id: number; correct_option: number | null; explanation_status: string }>(
    `SELECT id, correct_option, explanation_status FROM ${table} WHERE id = ? AND deleted_at IS NULL`,
    questionId,
  );

  if (!question) {
    return apiError("Question not found.", 404);
  }

  const now = new Date().toISOString();

  if (action === "approve") {
    // CRITICAL POLICY GUARD: Unkeyed questions cannot be marked reviewed
    if (question.correct_option === null) {
      return apiError(
        "Cannot approve explanation for an unkeyed question. The correct option must be verified and set before approving.",
        400,
      );
    }

    await run(
      `UPDATE ${table}
       SET explanation_status = 'reviewed',
           reviewed_by = ?,
           reviewed_at = ?,
           updated_at = ?
       WHERE id = ?`,
      guard.admin.email,
      now,
      now,
      questionId,
    );

    await audit({
      adminId: guard.admin.id,
      action: "question.explanation_approve",
      entityType: table,
      entityId: questionId,
      diff: { status: "reviewed" },
    });

    return json({ ok: true, message: "Explanation approved as reviewed." });
  }

  if (action === "flag") {
    await run(
      `UPDATE ${table}
       SET explanation_status = 'flagged',
           reviewed_by = ?,
           reviewed_at = ?,
           updated_at = ?
       WHERE id = ?`,
      guard.admin.email,
      now,
      now,
      questionId,
    );

    await audit({
      adminId: guard.admin.id,
      action: "question.explanation_flag",
      entityType: table,
      entityId: questionId,
      diff: { status: "flagged" },
    });

    return json({ ok: true, message: "Question explanation flagged for editorial revision." });
  }

  if (action === "edit") {
    if (!explanation) {
      return apiError("Explanation text is required for edit action.", 400);
    }

    await run(
      `UPDATE ${table}
       SET explanation = ?,
           explanation_source = 'human',
           explanation_status = 'reviewed',
           reviewed_by = ?,
           reviewed_at = ?,
           updated_at = ?
       WHERE id = ?`,
      explanation,
      guard.admin.email,
      now,
      now,
      questionId,
    );

    await audit({
      adminId: guard.admin.id,
      action: "question.explanation_edit",
      entityType: table,
      entityId: questionId,
      diff: { explanation, source: "human", status: "reviewed" },
    });

    return json({ ok: true, message: "Explanation updated and signed off as human-reviewed." });
  }

  return apiError("Unknown action.", 400);
};
