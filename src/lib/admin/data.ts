import { all, first, run } from "../db";
import {
  editableColumns,
  getTable,
  visibleColumns,
  type ColumnDef,
  type TableDef,
} from "./schema";

export type ListOptions = {
  page?: number;
  per?: number;
  q?: string;
  sort?: string;
  dir?: "asc" | "desc";
  includeDeleted?: boolean;
};

export type RowRecord = Record<string, string | number | null>;

export function coerceId(table: TableDef, raw: string): string | number | null {
  const pk = table.columns.find((column) => column.name === table.pk);
  if (!pk) return null;
  if (pk.type === "integer" || pk.type === "real") {
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  const value = raw.trim();
  return value && value.length <= 200 ? value : null;
}

function searchableColumns(table: TableDef): ColumnDef[] {
  return visibleColumns(table).filter(
    (column) => (column.type === "text" || column.type === "longtext") && column.name !== table.pk,
  );
}

export async function listRows(
  table: TableDef,
  options: ListOptions,
): Promise<{ rows: RowRecord[]; total: number; page: number; per: number }> {
  const per = Math.min(Math.max(options.per ?? 25, 1), 100);
  const page = Math.max(options.page ?? 1, 1);
  const offset = (page - 1) * per;

  const where: string[] = [];
  const params: (string | number)[] = [];

  if (table.softDelete && !options.includeDeleted) where.push("deleted_at IS NULL");

  const term = (options.q ?? "").trim().slice(0, 100);
  if (term) {
    const columns = searchableColumns(table);
    if (columns.length > 0) {
      where.push(`(${columns.map((column) => `"${column.name}" LIKE ?`).join(" OR ")})`);
      for (let index = 0; index < columns.length; index += 1) params.push(`%${term}%`);
    }
  }

  const visible = visibleColumns(table);
  const sortColumn = visible.find((column) => column.name === options.sort) ?? null;
  const orderBy = sortColumn ? `"${sortColumn.name}"` : `"${table.pk}"`;
  const direction = options.dir === "asc" ? "ASC" : "DESC";

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const countRow = await first<{ count: number }>(
    `SELECT COUNT(*) AS count FROM "${table.name}" ${whereSql}`,
    ...params,
  );
  const rows = await all<RowRecord>(
    `SELECT ${visible.map((column) => `"${column.name}"`).join(", ")}
     FROM "${table.name}" ${whereSql}
     ORDER BY ${orderBy} ${direction}
     LIMIT ? OFFSET ?`,
    ...params,
    per,
    offset,
  );

  return { rows, total: countRow?.count ?? 0, page, per };
}

export async function getRow(table: TableDef, id: string | number): Promise<RowRecord | null> {
  const visible = visibleColumns(table);
  return first<RowRecord>(
    `SELECT ${visible.map((column) => `"${column.name}"`).join(", ")}
     FROM "${table.name}" WHERE "${table.pk}" = ?`,
    id,
  );
}

function validateValue(column: ColumnDef, raw: unknown): { value: string | number | null } | { error: string } {
  if (raw === undefined || raw === null || raw === "") {
    if (column.nullable === false) return { error: `${column.label} is required.` };
    return { value: null };
  }

  if (column.type === "boolean") {
    if (raw === true || raw === 1 || raw === "1" || raw === "true" || raw === "on") return { value: 1 };
    if (raw === false || raw === 0 || raw === "0" || raw === "false") return { value: 0 };
    return { error: `${column.label} must be true or false.` };
  }

  if (column.type === "integer" || column.type === "real") {
    const value = Number(raw);
    if (!Number.isFinite(value)) return { error: `${column.label} must be a number.` };
    if (column.type === "integer" && !Number.isInteger(value)) {
      return { error: `${column.label} must be a whole number.` };
    }
    return { value };
  }

  const text = String(raw);
  const limit = column.maxLength ?? (column.type === "longtext" ? 60_000 : 2_000);
  if (text.length > limit) return { error: `${column.label} is longer than ${limit} characters.` };

  if (column.type === "json") {
    try {
      JSON.parse(text);
    } catch {
      return { error: `${column.label} must be valid JSON.` };
    }
  }

  if (column.type === "enum") {
    if (!column.enumValues?.includes(text)) {
      return { error: `${column.label} must be one of: ${column.enumValues?.join(", ")}.` };
    }
  }

  if (column.type === "datetime" && text.length > 10 && Number.isNaN(Date.parse(text))) {
    return { error: `${column.label} must be a valid date/time.` };
  }

  return { value: text };
}

export type WriteResult =
  | { ok: true; id: string | number }
  | { error: string; conflict?: boolean };

export async function createRow(table: TableDef, input: Record<string, unknown>): Promise<WriteResult> {
  if (table.editable === false) return { error: `${table.label} is read-only in the data manager.` };

  const columns = editableColumns(table).filter((column) => column.name !== table.pk);
  const names: string[] = [];
  const placeholders: string[] = [];
  const values: (string | number | null)[] = [];

  for (const column of columns) {
    if (!(column.name in input)) continue;
    const parsed = validateValue(column, input[column.name]);
    if ("error" in parsed) return parsed;
    names.push(`"${column.name}"`);
    placeholders.push("?");
    values.push(parsed.value);
  }

  if (names.length === 0) return { error: "Provide at least one column value." };

  try {
    const result = await run(
      `INSERT INTO "${table.name}" (${names.join(", ")}) VALUES (${placeholders.join(", ")})`,
      ...values,
    );
    return { ok: true, id: Number(result.meta.last_row_id) };
  } catch (error) {
    return { error: databaseMessage(error) };
  }
}

export async function updateRow(
  table: TableDef,
  id: string | number,
  input: Record<string, unknown>,
  expectedUpdatedAt?: string,
): Promise<WriteResult> {
  if (table.editable === false) return { error: `${table.label} is read-only in the data manager.` };

  const columns = editableColumns(table).filter((column) => column.name !== table.pk);
  const assignments: string[] = [];
  const values: (string | number | null)[] = [];

  for (const column of columns) {
    if (!(column.name in input)) continue;
    const parsed = validateValue(column, input[column.name]);
    if ("error" in parsed) return parsed;
    assignments.push(`"${column.name}" = ?`);
    values.push(parsed.value);
  }

  if (assignments.length === 0) return { error: "No editable fields were provided." };

  const hasUpdatedAt = table.columns.some((column) => column.name === "updated_at");
  if (hasUpdatedAt) assignments.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`);

  const where = [`"${table.pk}" = ?`];
  const whereValues: (string | number | null)[] = [id];
  if (hasUpdatedAt && expectedUpdatedAt) {
    where.push("updated_at IS ?");
    whereValues.push(expectedUpdatedAt);
  }

  const result = await run(
    `UPDATE "${table.name}" SET ${assignments.join(", ")} WHERE ${where.join(" AND ")}`,
    ...values,
    ...whereValues,
  );

  if (expectedUpdatedAt && (result.meta.changes ?? 0) === 0) {
    return {
      error: "Someone else changed this row while you were editing. Reload and compare before saving.",
      conflict: true,
    };
  }
  return { ok: true, id };
}

export async function softDeleteRow(
  table: TableDef,
  id: string | number,
  purge = false,
): Promise<WriteResult> {
  if (!table.deletable) return { error: `${table.label} cannot be deleted from the data manager. ${table.note ?? ""}` };
  try {
    if (purge || !table.softDelete) {
      await run(`DELETE FROM "${table.name}" WHERE "${table.pk}" = ?`, id);
    } else {
      await run(
        `UPDATE "${table.name}" SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "${table.pk}" = ?`,
        id,
      );
    }
    return { ok: true, id };
  } catch (error) {
    return { error: databaseMessage(error) };
  }
}

export async function restoreRow(table: TableDef, id: string | number): Promise<WriteResult> {
  if (!table.softDelete) return { error: `${table.label} has no soft-delete column.` };
  await run(`UPDATE "${table.name}" SET deleted_at = NULL WHERE "${table.pk}" = ?`, id);
  return { ok: true, id };
}

export async function exportRows(
  table: TableDef,
  options: Omit<ListOptions, "page" | "per">,
): Promise<RowRecord[]> {
  const per = 10_000;
  const result = await listRows(table, { ...options, page: 1, per: 100 });
  if (result.total <= 100) return result.rows;
  // Page through in 100-row windows to respect D1 limits.
  const rows: RowRecord[] = [];
  for (let page = 1; page <= Math.ceil(result.total / 100) && rows.length < per; page += 1) {
    const chunk = await listRows(table, { ...options, page, per: 100 });
    rows.push(...chunk.rows);
  }
  return rows.slice(0, per);
}

export async function foreignOptions(
  fk: { table: string; value: string; label: string },
): Promise<Array<{ value: string | number; label: string }>> {
  const target = getTable(fk.table);
  if (!target) return [];
  const targetColumn = target.columns.find((column) => column.name === fk.label);
  const safeLabel = targetColumn && !targetColumn.sensitive && !targetColumn.hidden ? fk.label : target.pk;
  const deletedClause = target.softDelete ? "WHERE deleted_at IS NULL" : "";
  const rows = await all<Record<string, unknown>>(
    `SELECT "${fk.value}" AS value, "${safeLabel}" AS label
     FROM "${target.name}" ${deletedClause}
     ORDER BY "${fk.value}" DESC LIMIT 200`,
  );
  return rows.map((row) => ({
    value: row.value as string | number,
    label: String(row.label ?? row.value ?? "").replace(/<[^>]+>/g, " ").trim().slice(0, 80) || String(row.value),
  }));
}

function databaseMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes("foreign key")) {
    return "This change is blocked by a foreign-key relationship. Remove or reassign the dependent rows first.";
  }
  if (message.toLowerCase().includes("unique")) {
    return "That value must be unique and is already used by another row.";
  }
  return message.slice(0, 400);
}
