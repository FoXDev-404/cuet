import { all, first, run } from "../db";
import { isAdminRole, type AdminRole } from "../auth/admin";

export type AdminRow = {
  id: number;
  email: string;
  role: AdminRole;
  is_active: number;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  return EMAIL.test(email) && email.length <= 254 ? email : null;
}

export async function listAdmins(query: string, includeDeleted = false): Promise<AdminRow[]> {
  const term = `%${query.trim().replace(/[%_]/g, " ")}%`;
  const deleted = includeDeleted ? "" : "AND deleted_at IS NULL";
  return all<AdminRow>(
    `SELECT id, email, role, is_active, created_at, updated_at, deleted_at
     FROM admins
     WHERE (email LIKE ? OR role LIKE ?) ${deleted}
     ORDER BY is_active DESC, role = 'super' DESC, email
     LIMIT 300`,
    term,
    term,
  );
}

export async function findAdmin(id: number): Promise<AdminRow | null> {
  return first<AdminRow>(
    `SELECT id, email, role, is_active, created_at, updated_at, deleted_at
     FROM admins WHERE id = ?`,
    id,
  );
}

export async function countActiveSupers(): Promise<number> {
  const row = await first<{ count: number }>(
    "SELECT COUNT(*) AS count FROM admins WHERE role = 'super' AND is_active = 1 AND deleted_at IS NULL",
  );
  return row?.count ?? 0;
}

export async function createAdmin(email: string, role: AdminRole): Promise<number> {
  const result = await run(
    `INSERT INTO admins (email, role, is_active) VALUES (?, ?, 1)`,
    email,
    role,
  );
  return Number(result.meta.last_row_id);
}

export async function updateAdmin(
  id: number,
  input: { email?: string; role?: AdminRole; isActive?: boolean },
): Promise<void> {
  const assignments: string[] = [];
  const values: (string | number)[] = [];
  if (input.email) {
    assignments.push("email = ?");
    values.push(input.email);
  }
  if (input.role) {
    assignments.push("role = ?");
    values.push(input.role);
  }
  if (input.isActive !== undefined) {
    assignments.push("is_active = ?");
    values.push(input.isActive ? 1 : 0);
  }
  if (assignments.length === 0) return;
  assignments.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
  await run(`UPDATE admins SET ${assignments.join(", ")} WHERE id = ?`, ...values, id);
}

export async function deleteAdmin(id: number): Promise<void> {
  await run(
    `UPDATE admins SET is_active = 0, deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
    id,
  );
}

/** A super admin can only be removed while another active super remains. */
export async function removalWouldOrphan(id: number): Promise<boolean> {
  const target = await findAdmin(id);
  if (!target) return false;
  if (target.role !== "super" || !target.is_active) return false;
  return (await countActiveSupers()) <= 1;
}

export function validRole(value: unknown): AdminRole | null {
  return isAdminRole(value) ? value : null;
}
