import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import { first, run } from "../../../../lib/db";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

export const PATCH: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "moderation.write");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Report not found.", 404);
  const report = await first<{ id: number; status: string; question_id: number }>(
    "SELECT id, status, question_id FROM question_reports WHERE id = ?",
    id,
  );
  if (!report) return apiError("Report not found.", 404);

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid request body.");
  }
  const status = String(body.status ?? "");
  if (!["resolved", "dismissed"].includes(status)) {
    return apiError("Choose resolved or dismissed.");
  }

  await run("UPDATE question_reports SET status = ? WHERE id = ?", status, id);
  await audit({
    adminId: guard.admin.id,
    action: `question_report.${status}`,
    entityType: "question_report",
    entityId: id,
    diff: { question_id: report.question_id, previous_status: report.status },
  });
  return json({ ok: true, status });
};
