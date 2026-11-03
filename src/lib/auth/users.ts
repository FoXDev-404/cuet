import { all, first, run } from "../db";
import { hashPassword } from "./password";

export type UserRecord = {
  id: number;
  username: string;
  email: string;
  password_hash: string | null;
  google_id: string | null;
  deleted_at: string | null;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function baseUsername(email: string): string {
  const local = normalizeEmail(email).split("@")[0] ?? "student";
  const cleaned = local
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return cleaned.length >= 3 ? cleaned : `student_${cleaned || "cuet"}`;
}

export async function uniqueUsername(email: string): Promise<string> {
  const base = baseUsername(email).slice(0, 24);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base.slice(0, 20)}_${attempt + 1}`;
    const existing = await first<{ id: number }>("SELECT id FROM users WHERE username = ?", candidate);
    if (!existing) return candidate;
  }
  return `${base.slice(0, 16)}_${crypto.randomUUID().slice(0, 6)}`;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  return first<UserRecord>(
    `SELECT id, username, email, password_hash, google_id, deleted_at
     FROM users WHERE lower(email) = lower(?)`,
    normalizeEmail(email),
  );
}

export async function findUserByGoogleId(googleId: string): Promise<UserRecord | null> {
  return first<UserRecord>(
    `SELECT id, username, email, password_hash, google_id, deleted_at
     FROM users WHERE google_id = ?`,
    googleId,
  );
}

export async function createPasswordUser(input: {
  email: string;
  password: string;
  username?: string;
}): Promise<UserRecord> {
  const email = normalizeEmail(input.email);
  const username = input.username?.trim() || (await uniqueUsername(email));
  const passwordHash = await hashPassword(input.password);
  const result = await run(
    "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
    username,
    email,
    passwordHash,
  );
  const id = Number(result.meta.last_row_id);
  const user = await first<UserRecord>(
    "SELECT id, username, email, password_hash, google_id, deleted_at FROM users WHERE id = ?",
    id,
  );
  if (!user) throw new Error("Could not create the account.");
  return user;
}

export async function createGoogleUser(input: {
  email: string;
  googleId: string;
  username?: string;
  avatarUrl?: string | null;
}): Promise<UserRecord> {
  const email = normalizeEmail(input.email);
  const username = input.username?.trim() || (await uniqueUsername(email));
  const result = await run(
    "INSERT INTO users (username, email, google_id, avatar_url) VALUES (?, ?, ?, ?)",
    username,
    email,
    input.googleId,
    input.avatarUrl ?? null,
  );
  const id = Number(result.meta.last_row_id);
  const user = await first<UserRecord>(
    "SELECT id, username, email, password_hash, google_id, deleted_at FROM users WHERE id = ?",
    id,
  );
  if (!user) throw new Error("Could not create the account.");
  return user;
}

export async function linkGoogleUser(
  userId: number,
  googleId: string,
  avatarUrl?: string | null,
): Promise<void> {
  await run(
    "UPDATE users SET google_id = ?, avatar_url = COALESCE(?, avatar_url) WHERE id = ?",
    googleId,
    avatarUrl ?? null,
    userId,
  );
}

export async function claimGuestAttempts(
  userId: number,
  guestToken: string | null | undefined,
): Promise<number> {
  if (!guestToken) return 0;
  const rows = await all<{ id: number; mock_id: number; status: string }>(
    "SELECT id, mock_id, status FROM attempts WHERE guest_token = ? AND user_id IS NULL",
    guestToken,
  );
  if (rows.length === 0) return 0;

  const result = await run(
    `UPDATE attempts
     SET user_id = ?, guest_token = NULL
     WHERE guest_token = ? AND user_id IS NULL`,
    userId,
    guestToken,
  );

  for (const row of rows) {
    if (row.status === "in_progress") continue;
    const earlier = await first<{ count: number }>(
      `SELECT COUNT(*) AS count FROM attempts
       WHERE user_id = ? AND mock_id = ? AND id != ? AND status IN ('submitted','expired')`,
      userId,
      row.mock_id,
      row.id,
    );
    if ((earlier?.count ?? 0) > 0) continue;
    try {
      await run("UPDATE attempts SET is_first_attempt = 1 WHERE id = ?", row.id);
    } catch {
      // Another attempt already holds the partial unique first-attempt slot.
    }
  }

  return result.meta.changes ?? 0;
}
