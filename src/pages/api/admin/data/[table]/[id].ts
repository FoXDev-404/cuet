import type { APIContext, APIRoute } from "astro";
import { requirePermission } from "../../../../../lib/auth/guard";
import { audit } from "../../../../../lib/audit";
import { coerceId, getRow, restoreRow, softDeleteRow, updateRow } from "../../../../../lib/admin/data";
import { getTable, type TableDef } from "../../../../../lib/admin/schema";
import { snapshotEntity } from "../../../../../lib/admin/revisions";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../../lib/http";

type Resolved =
  | { table: TableDef; id: string | number }
  | Response;

function resolve(context: APIContext): Resolved {
  const table = getTable(context.params.table ?? "");
  if (!table) return apiError("Unknown table.", 404);
  const id = coerceId(table, context.params.id ?? "");
  if (id === null) return apiError("Invalid row id.", 404);
  return { table, id };
}

export const GET: APIRoute = async (context) => {
  const guard = requirePermission(context, "data.manage");
  if (guard.response) return guard.response;
  const resolved = resolve(context);
  if (resolved instanceof Response) return resolved;

  const row = await getRow(resolved.table, resolved.id);
  if (!row) return apiError("Row not found.", 404);
  return json({ table: resolved.table.name, row });
};

export const PATCH: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "data.manage");
  if (guard.response) return guard.response;
  const resolved = resolve(context);
  if (resolved instanceof Response) return resolved;

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return apiError("Expected a JSON body.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return apiError("Expected a JSON object.");

  const record = body as Record<string, unknown>;
  const expected = typeof record._expectedUpdatedAt === "string" ? record._expectedUpdatedAt : undefined;
  const before = await getRow(resolved.table, resolved.id);
  if (!before) return apiError("Row not found.", 404);

  if (resolved.table.name === "questions" || resolved.table.name === "mock_tests") {
    await snapshotEntity({
      entityType: resolved.table.name,
      entityId: Number(resolved.id),
      adminId: guard.admin.id,
      reason: "Data manager edit",
    });
  }

  const result = await updateRow(resolved.table, resolved.id, record, expected);
  if ("error" in result) return apiError(result.error, result.conflict ? 409 : 400);

  const after = await getRow(resolved.table, resolved.id);
  await audit({
    adminId: guard.admin.id,
    action: "data.update",
    entityType: resolved.table.name,
    entityId: typeof resolved.id === "number" ? resolved.id : null,
    diff: { before, after },
  });
  return json({ ok: true, row: after });
};

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "data.manage");
  if (guard.response) return guard.response;
  const resolved = resolve(context);
  if (resolved instanceof Response) return resolved;
  if (context.url.searchParams.get("action") !== "restore") {
    return apiError("Unsupported action.", 400);
  }

  const result = await restoreRow(resolved.table, resolved.id);
  if ("error" in result) return apiError(result.error, 400);
  await audit({
    adminId: guard.admin.id,
    action: "data.restore",
    entityType: resolved.table.name,
    entityId: typeof resolved.id === "number" ? resolved.id : null,
  });
  return json({ ok: true });
};

export const DELETE: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "data.manage");
  if (guard.response) return guard.response;
  const resolved = resolve(context);
  if (resolved instanceof Response) return resolved;

  const purge = context.url.searchParams.get("purge") === "1";
  if (purge) {
    const confirmation = context.url.searchParams.get("confirm") ?? "";
    if (confirmation !== String(resolved.id)) {
      return apiError("Typed confirmation does not match the row id.", 400);
    }
    if (resolved.table.softDelete) {
      const row = await getRow(resolved.table, resolved.id);
      if (row && !row.deleted_at) return apiError("Move the row to Trash before purging.", 400);
    }
  }

  const before = await getRow(resolved.table, resolved.id);
  if (!before) return apiError("Row not found.", 404);
  if (resolved.table.name === "questions" || resolved.table.name === "mock_tests") {
    await snapshotEntity({
      entityType: resolved.table.name,
      entityId: Number(resolved.id),
      adminId: guard.admin.id,
      reason: purge ? "Before purge" : "Before soft delete",
    });
  }

  const result = await softDeleteRow(resolved.table, resolved.id, purge);
  if ("error" in result) return apiError(result.error, 400);

  await audit({
    adminId: guard.admin.id,
    action: purge ? "data.purge" : "data.delete",
    entityType: resolved.table.name,
    entityId: typeof resolved.id === "number" ? resolved.id : null,
    diff: purge ? { before } : undefined,
  });
  return json({ ok: true });
};

export const prerender = false;
