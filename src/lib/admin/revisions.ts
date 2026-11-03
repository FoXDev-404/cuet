import { all, first, run } from "../db";
import { getTable, type TableDef } from "./schema";

/** Tables that support integer-keyed revision snapshots. */
const REVISION_ENTITIES = new Set([
  "questions",
  "passages",
  "mock_tests",
  "pyq_papers",
  "announcements",
  "blog_posts",
  "subjects",
  "topics",
  "discussions",
]);

export type RevisionRow = {
  id: number;
  entity_type: string;
  entity_id: number;
  snapshot_json: string;
  reason: string | null;
  admin_id: number | null;
  created_at: string;
};

export function canRevise(entityType: string): boolean {
  return REVISION_ENTITIES.has(entityType);
}

export async function readEntity(table: TableDef, entityId: number): Promise<Record<string, unknown> | null> {
  const columns = table.columns.map((column) => `"${column.name}"`).join(", ");
  return first<Record<string, unknown>>(
    `SELECT ${columns} FROM "${table.name}" WHERE "${table.pk}" = ?`,
    entityId,
  );
}

export async function snapshotEntity(input: {
  entityType: string;
  entityId: number;
  adminId: number;
  reason?: string | null;
}): Promise<number | null> {
  if (!canRevise(input.entityType)) return null;
  const table = getTable(input.entityType);
  if (!table) return null;

  const row = await readEntity(table, input.entityId);
  if (!row) return null;

  const result = await run(
    `INSERT INTO revisions (entity_type, entity_id, snapshot_json, reason, admin_id)
     VALUES (?, ?, ?, ?, ?)`,
    input.entityType,
    input.entityId,
    JSON.stringify(row).slice(0, 200_000),
    input.reason?.slice(0, 2_000) ?? null,
    input.adminId,
  );
  return Number(result.meta.last_row_id);
}

export async function listRevisions(
  entityType: string,
  entityId: number,
  limit = 20,
): Promise<RevisionRow[]> {
  return all<RevisionRow>(
    `SELECT id, entity_type, entity_id, snapshot_json, reason, admin_id, created_at
     FROM revisions
     WHERE entity_type = ? AND entity_id = ?
     ORDER BY id DESC LIMIT ?`,
    entityType,
    entityId,
    Math.min(Math.max(limit, 1), 100),
  );
}

export async function findRevision(id: number): Promise<RevisionRow | null> {
  return first<RevisionRow>(
    `SELECT id, entity_type, entity_id, snapshot_json, reason, admin_id, created_at
     FROM revisions WHERE id = ?`,
    id,
  );
}

export async function restoreRevision(
  revision: RevisionRow,
  adminId: number,
): Promise<{ ok: true } | { error: string }> {
  if (!canRevise(revision.entity_type)) return { error: "This entity does not support revisions." };
  const table = getTable(revision.entity_type);
  if (!table) return { error: "Unknown entity table." };

  let snapshot: Record<string, unknown>;
  try {
    snapshot = JSON.parse(revision.snapshot_json) as Record<string, unknown>;
  } catch {
    return { error: "The stored snapshot is not valid JSON." };
  }

  const editable = table.columns.filter(
    (column) => !column.readonly && !column.hidden && !column.sensitive && column.name !== table.pk,
  );
  const assignments: string[] = [];
  const values: (string | number | null)[] = [];
  for (const column of editable) {
    if (!(column.name in snapshot)) continue;
    const value = snapshot[column.name];
    assignments.push(`"${column.name}" = ?`);
    values.push(value === null || value === undefined ? null : (value as string | number));
  }
  if (assignments.length === 0) return { error: "No editable columns in this snapshot." };

  if (table.columns.some((column) => column.name === "updated_at")) {
    assignments.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`);
  }

  await run(
    `UPDATE "${table.name}" SET ${assignments.join(", ")} WHERE "${table.pk}" = ?`,
    ...values,
    revision.entity_id,
  );

  // The restore itself is a revision, so it can be undone.
  await snapshotEntity({
    entityType: revision.entity_type,
    entityId: revision.entity_id,
    adminId,
    reason: `Before restoring revision #${revision.id}`,
  });

  return { ok: true };
}
