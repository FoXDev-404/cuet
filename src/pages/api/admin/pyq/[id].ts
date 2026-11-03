import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import { findPyqPaper, pyqPayloadSchema, savePyqPaper, softDeletePyqPaper } from "../../../../lib/admin/pyq";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

export const PATCH: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "mocks.write");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("PYQ paper not found.", 404);
  const existing = await findPyqPaper(id);
  if (!existing) return apiError("PYQ paper not found.", 404);

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

  try {
    await savePyqPaper(parsed.data, existing.exam_id, guard.admin.id, id);
    await audit({
      adminId: guard.admin.id,
      action: "pyq.update",
      entityType: "pyq_paper",
      entityId: id,
      diff: { year: parsed.data.year, title: parsed.data.title, status: parsed.data.status, mock_id: parsed.data.mock_id },
    });
    return json({ ok: true, id, redirect: `/admin/pyq?id=${id}` });
  } catch (error) {
    console.error("pyq update failed", error);
    return apiError(error instanceof Error ? error.message : "Could not save the PYQ paper.", 400);
  }
};

export const DELETE: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "mocks.write");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("PYQ paper not found.", 404);
  try {
    await softDeletePyqPaper(id);
    await audit({
      adminId: guard.admin.id,
      action: "pyq.delete",
      entityType: "pyq_paper",
      entityId: id,
    });
    return json({ ok: true, id });
  } catch (error) {
    console.error("pyq delete failed", error);
    return apiError(error instanceof Error ? error.message : "Could not delete the PYQ paper.", 400);
  }
};

export const GET: APIRoute = async (context) => {
  const guard = requirePermission(context, "mocks.write");
  if (guard.response) return guard.response;
  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("PYQ paper not found.", 404);
  const paper = await findPyqPaper(id);
  if (!paper) return apiError("PYQ paper not found.", 404);
  return json(paper);
};

