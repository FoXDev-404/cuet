import { first } from "../db";
import type { SessionUser } from "./session";

export type AdminRole = "super" | "editor" | "moderator" | "contributor";

export type AdminUser = {
  id: number;
  email: string;
  role: AdminRole;
};

/**
 * The single source of truth for capabilities. The API guard and the UI both
 * read from this list, and GET /api/admin/me returns the same set so the shell
 * can never disagree with server enforcement.
 */
export const PERMISSIONS = [
  "questions.write",
  "questions.publish",
  "questions.delete",
  "taxonomy.write",
  "mocks.write",
  "mocks.publish",
  "media.write",
  "seo.write",
  "exam_info.write",
  "announcements.write",
  "leaderboards.write",
  "moderation.write",
  "attempts.view",
  "attempts.void",
  "attempts.rescore",
  "users.view",
  "users.mute",
  "users.manage",
  "admins.manage",
  "settings.write",
  "data.manage",
  "trash.manage",
  "revisions.restore",
  "audit.view",
  "audit.own",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ADMIN_ROLES: AdminRole[] = ["super", "editor", "moderator", "contributor"];

const EDITOR_PERMISSIONS: Permission[] = [
  "questions.write",
  "questions.publish",
  "questions.delete",
  "taxonomy.write",
  "mocks.write",
  "mocks.publish",
  "media.write",
  "seo.write",
  "exam_info.write",
  "announcements.write",
  "leaderboards.write",
  "moderation.write",
  "attempts.view",
  "users.view",
  "revisions.restore",
  "audit.own",
];

export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  super: [...PERMISSIONS],
  editor: EDITOR_PERMISSIONS,
  moderator: ["moderation.write", "users.view", "users.mute"],
  contributor: ["questions.write", "media.write"],
};

export function permissionsFor(role: AdminRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function can(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as string[]).includes(value);
}

export async function getAdminByEmail(email: string): Promise<AdminUser | null> {
  try {
    const row = await first<{ id: number; email: string; role: AdminRole }>(
      "SELECT id, email, role FROM admins WHERE lower(email) = lower(?) AND is_active = 1",
      email,
    );
    return row ?? null;
  } catch {
    return null;
  }
}

/**
 * First-admin bootstrap. It only runs while no active super admin exists, so a
 * second attempt in production is refused. `BOOTSTRAP_SUPER_ADMIN_EMAIL` is a
 * one-shot promotion, not a permanent backdoor.
 */
export async function bootstrapSuperAdmin(email: string): Promise<AdminUser | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const existingSuper = await first<{ count: number }>(
    "SELECT COUNT(*) AS count FROM admins WHERE role = 'super' AND is_active = 1",
  );
  if ((existingSuper?.count ?? 0) > 0) return null;

  await first(
    `INSERT INTO admins (email, role, is_active) VALUES (?, 'super', 1)
     ON CONFLICT(email) DO UPDATE SET role = 'super', is_active = 1
     RETURNING id, email, role`,
    normalized,
  );
  return getAdminByEmail(normalized);
}

/** Development/staging fallback while Cloudflare Access is being configured. */
export async function getAdminForUser(user: SessionUser | null): Promise<AdminUser | null> {
  if (!user) return null;
  return getAdminByEmail(user.email);
}
