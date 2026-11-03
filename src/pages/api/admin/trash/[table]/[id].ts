import type { APIContext, APIRoute } from "astro";
import { requirePermission } from "../../../../../lib/auth/guard";
import { audit } from "../../../../../lib/audit";
import { coerceId } from "../../../../../lib/admin/data";
import { getTable, type TableDef } from "../../../../../lib/admin/schema";
import { purgeTrashRow, restoreTrashRow, trashRow } from "../../../../../lib/admin/trash";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../../lib/http";

type Resolved = { table: TableDef; id: string | number } | Response;

function resolve(context: APIContext): Resolved {
  const table = getTable(context.params.table ?? "");
  if (!table) return apiError("Unknown table.", 404);
  const id = coerceId(table, context.params.id ?? "");
  if (id === null) return apiError("Invalid row id.", 404);
  return { table, id };
}

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "trash.manage");
  if (guard.response) return guard.response;
  const resolved = resolve(context);
  if (resolved instanceof Response) return resolved;

  const result = await restoreTrashRow(resolved.table.name, resolved.id);
  if ("error" in result) return apiError(result.error, 400);

  await audit({
    adminId: guard.admin.id,
    action: "trash.restore",
    entityType: resolved.table.name,
    entityId: typeof resolved.id === "number" ? resolved.id : null,
  });
  return json({ ok: true });
};

export const DELETE: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "trash.manage");
  if (guard.response) return guard.response;
  const resolved = resolve(context);
  if (resolved instanceof Response) return resolved;

  if (context.url.searchParams.get("confirm") !== String(resolved.id)) {
    return apiError("Typed confirmation does not match the row id.", 400);
  }
  const row = await trashRow(resolved.table.name, resolved.id);
  if (!row) return apiError("Row is not in the trash.", 404);

  const result = await purgeTrashRow(resolved.table.name, resolved.id);
  if ("error" in result) return apiError(result.error, 409);

  await audit({
    adminId: guard.admin.id,
    action: "trash.purge",
    entityType: resolved.table.name,
    entityId: typeof resolved.id === "number" ? resolved.id : null,
    diff: row,
  });
  return json({ ok: true });
};

export const prerender = false;
