#!/usr/bin/env node
/**
 * Safe first-admin / role CLI.
 *
 *   npm run admin:create -- --email=owner@example.com
 *   npm run admin:create -- --email=editor@example.com --role=editor
 *   npm run admin:create -- --email=owner@example.com --remote --force
 *
 * Refuses to create a *new* active super admin when one already exists unless
 * --force is passed. Defaults to the local D1 database; production requires
 * --remote explicitly.
 */
import { spawnSync } from "node:child_process";
import process from "node:process";

const ROLES = ["super", "editor", "moderator", "contributor"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseArgs(argv) {
  const options = { email: "", role: "super", remote: false, force: false, database: "cuet-blueprint-db" };
  for (const arg of argv) {
    if (arg === "--remote") options.remote = true;
    else if (arg === "--force") options.force = true;
    else if (arg.startsWith("--email=")) options.email = arg.slice("--email=".length).trim();
    else if (arg.startsWith("--role=")) options.role = arg.slice("--role=".length).trim();
    else if (arg.startsWith("--database=")) options.database = arg.slice("--database=".length).trim();
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function runWrangler(args) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(command, ["wrangler", "d1", "execute", ...args], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || "wrangler failed");
  }
  return result.stdout ?? "";
}

function parseJsonOutput(stdout) {
  const start = stdout.indexOf("[");
  const end = stdout.lastIndexOf("]");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(stdout.slice(start, end + 1));
  } catch {
    return null;
  }
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log("Usage: npm run admin:create -- --email=<email> [--role=super|editor|moderator|contributor] [--remote] [--force]");
    return;
  }
  if (!EMAIL.test(options.email)) throw new Error("Provide a valid --email address.");
  if (!ROLES.includes(options.role)) throw new Error(`--role must be one of: ${ROLES.join(", ")}`);

  const target = options.remote ? ["--remote"] : ["--local"];
  const scope = options.remote ? "REMOTE" : "LOCAL";

  const listArgs = [options.database, ...target, "--json", "--command", "SELECT id, email, role, is_active FROM admins ORDER BY id"];
  const listed = parseJsonOutput(runWrangler(listArgs));
  const rows = listed?.[0]?.results ?? [];
  const activeSupers = rows.filter((row) => row.role === "super" && Number(row.is_active) === 1);

  if (options.role === "super" && activeSupers.length > 0 && !options.force) {
    throw new Error(
      `${scope} already has ${activeSupers.length} active super admin(s). ` +
        "Refusing to add another. Re-run with --force only if you intend to add one.",
    );
  }

  const email = options.email.toLowerCase();
  const sql =
    `INSERT INTO admins (email, role, is_active) VALUES (${sqlString(email)}, ${sqlString(options.role)}, 1) ` +
    `ON CONFLICT(email) DO UPDATE SET role = ${sqlString(options.role)}, is_active = 1;`;
  runWrangler([options.database, ...target, "--command", sql]);

  console.log(`${scope}: ${email} is now ${options.role} (active).`);
  console.log("Sign in with this email (Google or password), then open /admin.");
}

try {
  main();
} catch (error) {
  console.error(`admin:create failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
