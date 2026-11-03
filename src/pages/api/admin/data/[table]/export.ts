import type { APIRoute } from "astro";
import { requirePermission } from "../../../../../lib/auth/guard";
import { audit } from "../../../../../lib/audit";
import { exportRows } from "../../../../../lib/admin/data";
import { getTable, visibleColumns } from "../../../../../lib/admin/schema";
import { apiError } from "../../../../../lib/http";

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const GET: APIRoute = async (context) => {
  const guard = requirePermission(context, "data.manage");
  if (guard.response) return guard.response;

  const table = getTable(context.params.table ?? "");
  if (!table) return apiError("Unknown table.", 404);

  const params = context.url.searchParams;
  const rows = await exportRows(table, {
    q: params.get("q") ?? "",
    sort: params.get("sort") ?? undefined,
    dir: params.get("dir") === "asc" ? "asc" : "desc",
    includeDeleted: params.get("deleted") === "1",
  });

  await audit({
    adminId: guard.admin.id,
    action: "data.export",
    entityType: table.name,
    diff: { rows: rows.length, format: params.get("format") ?? "csv" },
  });

  const filename = `${table.name}-${new Date().toISOString().slice(0, 10)}`;
  if (params.get("format") === "json") {
    return new Response(JSON.stringify({ table: table.name, rows }, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}.json"`,
        "cache-control": "no-store",
      },
    });
  }

  const columns = visibleColumns(table);
  const header = columns.map((column) => csvCell(column.name)).join(",");
  const body = rows.map((row) => columns.map((column) => csvCell(row[column.name])).join(",")).join("\n");
  return new Response(`${header}\n${body}\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}.csv"`,
      "cache-control": "no-store",
    },
  });
};

export const prerender = false;
