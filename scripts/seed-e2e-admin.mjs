#!/usr/bin/env node
/**
 * Create the local E2E admin account used by tests/e2e/admin-flow.spec.ts.
 *
 *   node scripts/seed-e2e-admin.mjs
 *
 * Local D1 only. The CI workflow runs the same migrations/imports as a
 * developer, so this script gives the E2E suite the password account it logs
 * in with. It never targets the remote database and refuses --remote so a
 * known test password cannot be seeded into production.
 *
 * The `admins` row itself is seeded by migrations/0002_seed.sql; this script
 * adds the matching users row with a real PBKDF2 hash and re-activates the
 * admin role.
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword } from "../src/lib/auth/password.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@cuetfreemocktest.com";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "AdminPass123!";
const DATABASE = "cuet-blueprint-db";

if (process.argv.includes("--remote")) {
  console.error("Refusing to seed a known test admin into the remote database.");
  process.exit(1);
}
if (PASSWORD.length < 8) {
  console.error("E2E_ADMIN_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

const passwordHash = await hashPassword(PASSWORD);
const sql = [
  `INSERT INTO users (username, email, password_hash)
   VALUES ('ci_admin', ${sqlString(EMAIL)}, ${sqlString(passwordHash)})
   ON CONFLICT(email) DO UPDATE SET
     password_hash = excluded.password_hash,
     deleted_at = NULL;`,
  `UPDATE users SET deleted_at = NULL WHERE lower(email) = lower(${sqlString(EMAIL)});`,
  `INSERT INTO admins (email, role, is_active)
   VALUES (${sqlString(EMAIL)}, 'super', 1)
   ON CONFLICT(email) DO UPDATE SET role = 'super', is_active = 1;`,
  `SELECT u.id, u.username, u.email, a.role, a.is_active
   FROM users u JOIN admins a ON lower(a.email) = lower(u.email)
   WHERE lower(u.email) = lower(${sqlString(EMAIL)});`,
].join("\n");

const result = spawnSync(
  "npx",
  ["wrangler", "d1", "execute", DATABASE, "--local", "--command", sql],
  { cwd: ROOT, stdio: "inherit" },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(`Admin seed failed with exit code ${result.status}.`);
  process.exit(result.status ?? 1);
}
console.log(`Seeded local E2E admin ${EMAIL}.`);
