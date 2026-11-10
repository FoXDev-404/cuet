#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createTursoClient, queryRows } from "./turso-lib.mjs";

/**
 * Applies the repository migrations to the Turso database.
 *
 * The SQL files are the same ones Wrangler applies to D1, so the schema cannot
 * drift between the two engines. Every file runs inside its own transaction and
 * is recorded in `d1_migrations`, matching Wrangler's bookkeeping table.
 */

const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations/", import.meta.url));
const MIGRATIONS_TABLE = "d1_migrations";
/**
 * `0002_seed.sql` is a standalone local seed, not part of the tracked
 * migration history (Wrangler's `d1_migrations` does not contain it either).
 * Do not filter on `_seed.sql`: `0020_exam_info_seed.sql` is a real migration.
 */
const STANDALONE_SEED = "0002_seed.sql";
const CREATE_MIGRATIONS = `
  CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`;

const dryRun = process.argv.includes("--dry-run");

async function migrationFiles() {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries
    .filter((name) => name.endsWith(".sql") && name !== STANDALONE_SEED)
    .sort();
}

async function appliedNames(client) {
  const rows = await queryRows(client, `SELECT name FROM ${MIGRATIONS_TABLE}`);
  return new Set(rows.map((row) => String(row.name)));
}

async function main() {
  const client = createTursoClient();
  const files = await migrationFiles();

  await client.execute(CREATE_MIGRATIONS);
  const applied = await appliedNames(client);
  const pending = files.filter((name) => !applied.has(name));

  console.log(
    `${files.length} migrations, ${applied.size} already applied, ${pending.length} pending.`,
  );
  if (pending.length === 0) return;
  if (dryRun) {
    for (const name of pending) console.log(`pending ${name}`);
    return;
  }

  for (const name of pending) {
    const sql = await readFile(join(MIGRATIONS_DIR, name), "utf8");
    const transaction = await client.transaction("write");
    try {
      await transaction.executeMultiple(sql);
      await transaction.execute({
        sql: `INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`,
        args: [name],
      });
      await transaction.commit();
      console.log(`applied ${name}`);
    } catch (error) {
      try {
        await transaction.rollback();
      } catch {
        // The transaction may already be closed after a transport failure.
      }
      console.error(`failed  ${name}`);
      throw error;
    }
  }

  const integrity = await queryRows(client, "PRAGMA integrity_check");
  const fk = await queryRows(client, "PRAGMA foreign_key_check");
  if (integrity.length !== 1 || integrity[0].integrity_check !== "ok") {
    throw new Error(`integrity_check failed: ${JSON.stringify(integrity)}`);
  }
  if (fk.length > 0) {
    throw new Error(`foreign_key_check found ${fk.length} violation(s).`);
  }
  console.log("schema applied; integrity_check ok, foreign_key_check clean.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
