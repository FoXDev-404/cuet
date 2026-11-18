#!/usr/bin/env node
/**
 * Backup the PYQ rebuild blast radius before any write.
 *
 * Usage:
 *   node scripts/backup-pyq-tables.mjs --local
 *   node --env-file-if-exists=.dev.vars scripts/backup-pyq-tables.mjs --turso
 *
 * Produces `backups/pyq-rebuild-<timestamp>/` with:
 *   - `rows.json`      every row of every affected table (restore source)
 *   - `backup.sql`     INSERT OR REPLACE statements for the same rows
 *   - `manifest.json`  table row counts + SHA-256 of rows.json
 * For `--local` it also copies the raw SQLite file.
 */
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_DB = join(
  ROOT,
  ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/9e86a3487f62f60f2005838556d2eb9f94df20a990ccf3e7e9e15550212e2901.sqlite",
);

const TABLES = [
  "practice_papers",
  "practice_questions",
  "practice_passages",
  "mock_tests",
  "mock_test_versions",
  "mock_questions",
  "questions",
  "passages",
  "attempts",
  "attempt_answers",
  "slug_redirects",
];

const turso = process.argv.includes("--turso");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = join(ROOT, "backups", `pyq-rebuild-${stamp}`);
mkdirSync(outDir, { recursive: true });

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "bigint") return String(value);
  if (value instanceof Uint8Array) return `X'${Buffer.from(value).toString("hex")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

function insertStatements(table, columns, rows) {
  const columnList = columns.map((name) => `"${name}"`).join(", ");
  return rows.map(
    (row) =>
      `INSERT OR REPLACE INTO "${table}" (${columnList}) VALUES (${columns
        .map((name) => sqlValue(row[name]))
        .join(", ")});`,
  );
}

const dump = { generatedAt: new Date().toISOString(), target: turso ? "turso" : "local", tables: {} };

if (turso) {
  const { createTursoClient } = await import("./turso-lib.mjs");
  const client = createTursoClient();
  for (const table of TABLES) {
    const result = await client.execute(`SELECT * FROM "${table}"`);
    const columns = result.columns ?? [];
    const rows = result.rows.map((row) =>
      Object.fromEntries(columns.map((column, index) => [column, row[index]])),
    );
    dump.tables[table] = { columns, rows };
    console.log(`${table}: ${rows.length}`);
  }
} else {
  const db = new DatabaseSync(LOCAL_DB, { readOnly: true });
  for (const table of TABLES) {
    const columns = db.prepare(`PRAGMA table_info("${table}")`).all().map((row) => row.name);
    const rows = db.prepare(`SELECT * FROM "${table}"`).all();
    dump.tables[table] = { columns, rows };
    console.log(`${table}: ${rows.length}`);
  }
  db.close();
  const copy = join(outDir, "local-d1.sqlite");
  copyFileSync(LOCAL_DB, copy);
  console.log(`raw sqlite copy: ${copy} (${statSync(copy).size} bytes)`);
}

const rowsJson = JSON.stringify(dump);
writeFileSync(join(outDir, "rows.json"), rowsJson);
const sha256 = createHash("sha256").update(rowsJson).digest("hex");

const sqlLines = [
  "-- PYQ rebuild backup. Restore with: sqlite3 <db> < backup.sql",
  `-- generated ${dump.generatedAt}`,
  "PRAGMA foreign_keys = OFF;",
  "BEGIN;",
];
for (const table of TABLES) {
  const { columns, rows } = dump.tables[table];
  sqlLines.push(`DELETE FROM "${table}";`);
  sqlLines.push(...insertStatements(table, columns, rows));
}
sqlLines.push("COMMIT;", "PRAGMA foreign_keys = ON;", "");
writeFileSync(join(outDir, "backup.sql"), sqlLines.join("\n"));

const manifest = {
  generatedAt: dump.generatedAt,
  target: dump.target,
  rowsJsonSha256: sha256,
  rowsJsonBytes: rowsJson.length,
  backupSqlBytes: statSync(join(outDir, "backup.sql")).size,
  tables: Object.fromEntries(
    Object.entries(dump.tables).map(([table, value]) => [table, value.rows.length]),
  ),
};
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`\nwrote ${outDir}`);
console.log(JSON.stringify(manifest.tables, null, 1));
console.log(`sha256 ${sha256}`);
