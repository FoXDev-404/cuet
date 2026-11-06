import { all, first, run } from "../db";
import { softDeleteUserAccount } from "../user-deletion";

export type AdminUserRow = {
  id: number;
  username: string;
  email: string;
  created_at: string;
  deleted_at: string | null;
  banned_at: string | null;
  muted_until: string | null;
  approved_comments: number;
  attempt_count: number;
  comment_count: number;
  last_attempt_at: string | null;
};

export async function listUsers(query: string, includeDeleted = false): Promise<AdminUserRow[]> {
  const term = `%${query.trim().replace(/[%_]/g, " ")}%`;
  const deletedClause = includeDeleted ? "" : "AND u.deleted_at IS NULL";
  return all<AdminUserRow>(
    `SELECT u.id, u.username, u.email, u.created_at, u.deleted_at, u.banned_at,
            u.muted_until, u.approved_comments,
            (SELECT COUNT(*) FROM attempts a WHERE a.user_id = u.id) AS attempt_count,
            (SELECT COUNT(*) FROM discussions d WHERE d.user_id = u.id) AS comment_count,
            (SELECT MAX(a.started_at) FROM attempts a WHERE a.user_id = u.id) AS last_attempt_at
     FROM users u
     WHERE (u.username LIKE ? OR u.email LIKE ?) ${deletedClause}
     ORDER BY u.id DESC LIMIT 200`,
    term,
    term,
  );
}

export async function findAdminUser(id: number): Promise<AdminUserRow | null> {
  return first<AdminUserRow>(
    `SELECT u.id, u.username, u.email, u.created_at, u.deleted_at, u.banned_at,
            u.muted_until, u.approved_comments,
            (SELECT COUNT(*) FROM attempts a WHERE a.user_id = u.id) AS attempt_count,
            (SELECT COUNT(*) FROM discussions d WHERE d.user_id = u.id) AS comment_count,
            (SELECT MAX(a.started_at) FROM attempts a WHERE a.user_id = u.id) AS last_attempt_at
     FROM users u WHERE u.id = ?`,
    id,
  );
}

export function parseMuteUntil(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T23:59:59.999Z`)
    : new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getTime() <= Date.now()) return null;
  return date.toISOString();
}

export async function muteUser(id: number, until: string): Promise<void> {
  await run(
    "UPDATE users SET muted_until = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    until,
    id,
  );
}

export async function unmuteUser(id: number): Promise<void> {
  await run(
    "UPDATE users SET muted_until = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    id,
  );
}

export async function setBanned(id: number, banned: boolean): Promise<void> {
  await run(
    "UPDATE users SET banned_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    banned ? new Date().toISOString() : null,
    id,
  );
  if (banned) await run("DELETE FROM sessions WHERE user_id = ?", id);
}

/** Admin-initiated soft delete. Historical attempts stay for leaderboard integrity. */
export async function deleteUserByAdmin(id: number): Promise<void> {
  await softDeleteUserAccount(id);
}
