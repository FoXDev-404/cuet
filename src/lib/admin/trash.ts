import { all, first, run } from "../db";
import { getTable, type TableDef } from "./schema";

export type TrashRow = {
  table: string;
  tableLabel: string;
  id: number | string;
  label: string;
  deletedAt: string;
};

const LABEL_COLUMN: Record<string, string> = {
  questions: "text",
  mock_tests: "title",
  users: "username",
  passages: "body",
  pyq_papers: "title",
  announcements: "message",
  blog_posts: "title",
  subjects: "name",
  topics: "name",
  exams: "name",
  admins: "email",
  media_assets: "alt",
  badges: "name",
  discussions: "body",
  practice_papers: "title",
  practice_passages: "title",
  practice_questions: "stem",
};

export function trashTables(): TableDef[] {
  return [...new Map(
    [
      "questions",
      "passages",
      "mock_tests",
      "pyq_papers",
      "announcements",
      "blog_posts",
      "subjects",
      "topics",
      "exams",
      "admins",
      "media_assets",
      "badges",
      "discussions",
      "practice_papers",
      "practice_passages",
      "practice_questions",
    ]
      .map((name) => getTable(name))
      .filter((table): table is TableDef => Boolean(table && table.softDelete))
      .map((table) => [table.name, table]),
  ).values()];
}

function plainText(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
}

export async function trashCounts(): Promise<Record<string, number>> {
  const entries = await Promise.all(
    trashTables().map(async (table) => {
      const row = await first<{ count: number }>(
        `SELECT COUNT(*) AS count FROM "${table.name}" WHERE deleted_at IS NOT NULL`,
      );
      return [table.name, row?.count ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export async function listTrash(options: {
  table?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: TrashRow[]; total: number }> {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const tables = trashTables().filter((table) => !options.table || table.name === options.table);
  if (tables.length === 0) return { rows: [], total: 0 };

  const collected: TrashRow[] = [];
  let total = 0;
  for (const table of tables) {
    const countRow = await first<{ count: number }>(
      `SELECT COUNT(*) AS count FROM "${table.name}" WHERE deleted_at IS NOT NULL`,
    );
    total += countRow?.count ?? 0;
    const labelColumn = LABEL_COLUMN[table.name] ?? table.pk;
    const rows = await all<Record<string, unknown>>(
      `SELECT "${table.pk}" AS pk, "${labelColumn}" AS label, deleted_at
       FROM "${table.name}" WHERE deleted_at IS NOT NULL
       ORDER BY deleted_at DESC LIMIT ?`,
      limit + offset,
    );
    for (const row of rows) {
      collected.push({
        table: table.name,
        tableLabel: table.label,
        id: row.pk as number | string,
        label: plainText(row.label) || `#${String(row.pk)}`,
        deletedAt: String(row.deleted_at),
      });
    }
  }

  collected.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  return { rows: collected.slice(offset, offset + limit), total };
}

export async function trashRow(tableName: string, id: number | string): Promise<TrashRow | null> {
  const table = getTable(tableName);
  if (!table?.softDelete) return null;
  const labelColumn = LABEL_COLUMN[table.name] ?? table.pk;
  const row = await first<{ pk: number | string; label: unknown; deleted_at: string }>(
    `SELECT "${table.pk}" AS pk, "${labelColumn}" AS label, deleted_at
     FROM "${table.name}" WHERE "${table.pk}" = ? AND deleted_at IS NOT NULL`,
    id,
  );
  if (!row) return null;
  return {
    table: table.name,
    tableLabel: table.label,
    id: row.pk,
    label: plainText(row.label) || `#${String(row.pk)}`,
    deletedAt: row.deleted_at,
  };
}

export async function restoreTrashRow(
  tableName: string,
  id: number | string,
): Promise<{ ok: true } | { error: string }> {
  const table = getTable(tableName);
  if (!table) return { error: "Unknown table." };
  if (!table.softDelete) return { error: "This table has no restore support." };

  const existing = await first<Record<string, unknown>>(
    `SELECT "${table.pk}" AS pk, deleted_at FROM "${table.name}" WHERE "${table.pk}" = ?`,
    id,
  );
  if (!existing) return { error: "Row not found." };
  if (!existing.deleted_at) return { error: "Row is not in the trash." };

  await run(`UPDATE "${table.name}" SET deleted_at = NULL WHERE "${table.pk}" = ?`, id);
  return { ok: true };
}

export async function purgeTrashRow(
  tableName: string,
  id: number | string,
): Promise<{ ok: true } | { error: string }> {
  const table = getTable(tableName);
  if (!table) return { error: "Unknown table." };

  try {
    await run(`DELETE FROM "${table.name}" WHERE "${table.pk}" = ?`, id);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      error: `This row is still referenced by other data and cannot be purged. ${message.slice(0, 300)}`,
    };
  }
}
