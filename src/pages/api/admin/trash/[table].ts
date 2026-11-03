import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import { coerceId } from "../../../../lib/admin/data";
import { getTable } from "../../../../lib/admin/schema";
import { purgeTrashRow, restoreTrashRow, trashRow } from "../../../../lib/admin/trash";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

type ResolvedTable =
  | { table: NonNullable<ReturnType<typeof getTable>>; id: string | number }
  | { error: Response };

/** Query-string variant so string primary keys containing "/" work safely. */
function resolve(context: Parameters<typeof requirePermission>[0]): ResolvedTable {
  const table = getTable(context.params.table ?? "");
  if (!table) return { error: apiError("Unknown table.", 404) };
  const id = coerceId(table, context.url.searchParams.get("id") ?? "");
  if (id === null) return { error: apiError("Provide a valid ?id= for the row.", 404) };
  return { table, id };
}

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "trash.manage");
  if (guard.response) return guard.response;
  const resolved = resolve(context);
  if ("error" in resolved) return resolved.error;

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
  if ("error" in resolved) return resolved.error;

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
