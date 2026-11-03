import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import {
  coerceId,
  createRow,
  getRow,
  listRows,
  restoreRow,
  softDeleteRow,
  updateRow,
} from "../../../../lib/admin/data";
import { getTable } from "../../../../lib/admin/schema";
import { snapshotEntity } from "../../../../lib/admin/revisions";
import { invalidateAfterPracticeMutation } from "../../../../lib/practice-cache";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

export const GET: APIRoute = async (context) => {
  const guard = requirePermission(context, "data.manage");
  if (guard.response) return guard.response;

  const table = getTable(context.params.table ?? "");
  if (!table) return apiError("Unknown table.", 404);

  const params = context.url.searchParams;
  const result = await listRows(table, {
    page: Number(params.get("page") ?? 1),
    per: Number(params.get("per") ?? 25),
    q: params.get("q") ?? "",
    sort: params.get("sort") ?? undefined,
    dir: params.get("dir") === "asc" ? "asc" : "desc",
    includeDeleted: params.get("deleted") === "1",
  });
  return json({ table: table.name, ...result });
};

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "data.manage");
  if (guard.response) return guard.response;

  const table = getTable(context.params.table ?? "");
  if (!table) return apiError("Unknown table.", 404);

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return apiError("Expected a JSON body.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return apiError("Expected a JSON object.");
  const record = body as Record<string, unknown>;
  const action = String(record._action ?? "create");
  const rawId = record._id;
  const id = rawId === undefined || rawId === null ? null : coerceId(table, String(rawId));

  if (action === "create") {
    const { _action, ...input } = record;
    void _action;
    const result = await createRow(table, input);
    if ("error" in result) return apiError(result.error, 400);

    await invalidateAfterPracticeMutation(table.name, [input]);

    await audit({
      adminId: guard.admin.id,
      action: "data.create",
      entityType: table.name,
      entityId: typeof result.id === "number" ? result.id : null,
      diff: { id: result.id, after: input },
    });
    return json({ ok: true, id: result.id }, 201);
  }

  if (id === null) return apiError("A valid row id is required for this action.");

  if (action === "update") {
    const before = await getRow(table, id);
    if (!before) return apiError("Row not found.", 404);
    const expected = typeof record._expectedUpdatedAt === "string" ? record._expectedUpdatedAt : undefined;
    const { _action, _id, _expectedUpdatedAt, ...input } = record;
    void _action;
    void _id;
    void _expectedUpdatedAt;

    if (table.name === "questions" || table.name === "mock_tests" || table.name === "passages") {
      await snapshotEntity({
        entityType: table.name,
        entityId: Number(id),
        adminId: guard.admin.id,
        reason: "Data manager edit",
      });
    }

    const result = await updateRow(table, id, input, expected);
    if ("error" in result) return apiError(result.error, result.conflict ? 409 : 400);

    const after = await getRow(table, id);
    await invalidateAfterPracticeMutation(table.name, [before, after]);
    await audit({
      adminId: guard.admin.id,
      action: "data.update",
      entityType: table.name,
      entityId: typeof id === "number" ? id : null,
      diff: { before, after },
    });
    return json({ ok: true, row: after });
  }

  if (action === "restore") {
    const result = await restoreRow(table, id);
    if ("error" in result) return apiError(result.error, 400);
    await invalidateAfterPracticeMutation(table.name, [await getRow(table, id)]);
    await audit({
      adminId: guard.admin.id,
      action: "data.restore",
      entityType: table.name,
      entityId: typeof id === "number" ? id : null,
    });
    return json({ ok: true });
  }

  if (action === "delete") {
    const before = await getRow(table, id);
    if (!before) return apiError("Row not found.", 404);
    if (table.name === "questions" || table.name === "mock_tests" || table.name === "passages") {
      await snapshotEntity({
        entityType: table.name,
        entityId: Number(id),
        adminId: guard.admin.id,
        reason: "Before data manager delete",
      });
    }
    const result = await softDeleteRow(table, id, false);
    if ("error" in result) return apiError(result.error, 400);
    await invalidateAfterPracticeMutation(table.name, [before]);
    await audit({
      adminId: guard.admin.id,
      action: "data.delete",
      entityType: table.name,
      entityId: typeof id === "number" ? id : null,
      diff: { before },
    });
    return json({ ok: true });
  }

  return apiError("Unsupported action.", 400);
};

export const prerender = false;
