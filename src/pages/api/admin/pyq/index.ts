import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import { first } from "../../../../lib/db";
import { pyqPayloadSchema, savePyqPaper } from "../../../../lib/admin/pyq";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "mocks.write");
  if (guard.response) return guard.response;

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return apiError("Invalid JSON body.");
  }
  const parsed = pyqPayloadSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid PYQ paper.");
  if (parsed.data.source_url) {
    try {
      const url = new URL(parsed.data.source_url);
      if (!["http:", "https:"].includes(url.protocol)) return apiError("Source URL must use http or https.");
    } catch {
      return apiError("Enter a valid source URL.");
    }
  }

  const exam = await first<{ id: number }>("SELECT id FROM exams WHERE slug = 'cuet-ug'");
  if (!exam) return apiError("CUET UG exam row is missing.", 500);

  try {
    const id = await savePyqPaper(parsed.data, exam.id, guard.admin.id);
    await audit({
      adminId: guard.admin.id,
      action: "pyq.create",
      entityType: "pyq_paper",
      entityId: id,
      diff: { year: parsed.data.year, title: parsed.data.title, status: parsed.data.status, mock_id: parsed.data.mock_id },
    });
    return json({ ok: true, id, redirect: `/admin/pyq?id=${id}` }, 201);
  } catch (error) {
    console.error("pyq create failed", error);
    return apiError(error instanceof Error ? error.message : "Could not save the PYQ paper.", 400);
  }
};
