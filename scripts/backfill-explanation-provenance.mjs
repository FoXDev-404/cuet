#!/usr/bin/env node
/**
 * Backfill explanation provenance and review status.
 *
 *   node scripts/backfill-explanation-provenance.mjs            # local D1
 *   node scripts/backfill-explanation-provenance.mjs --remote   # production D1
 *
 * The local mode writes the Miniflare SQLite file directly. The remote mode
 * writes the same statements to a temporary SQL file and runs
 * `wrangler d1 execute --remote --file`, so it needs a valid
 * CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID (or an authenticated Wrangler).
 *
 * Run this after every practice/ranked import; the importers insert
 * explanation text but deliberately leave its provenance unclassified.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const REMOTE = process.argv.includes("--remote");
const DATABASE = (() => {
  const index = process.argv.indexOf("--database");
  return index >= 0 ? process.argv[index + 1] : "cuet-blueprint-db";
})();
if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(DATABASE)) {
  console.error(`Invalid D1 database name: ${DATABASE}`);
  process.exit(1);
}
const d1Dir = resolve(process.cwd(), ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");

const statements = [
  // Practice questions ------------------------------------------------------
  "UPDATE practice_questions SET explanation_source = 'none', explanation_status = 'unreviewed'",
  `UPDATE practice_questions
   SET explanation_source = 'banner', explanation_status = 'unreviewed'
   WHERE correct_option IS NULL
      OR explanation LIKE '%pending%'
      OR explanation LIKE '%editorial review%'
      OR explanation LIKE '%under review%'`,
  `UPDATE practice_questions
   SET explanation_source = 'ai_draft', explanation_status = 'unreviewed'
   WHERE explanation_source != 'banner'
     AND (
       explanation LIKE '%National Testing Agency (NTA) official answer key confirms Option%'
       OR explanation LIKE '%Option % is the correct answer according to the NTA answer key%'
       OR explanation LIKE '%NTA answer key%'
     )`,
  `UPDATE practice_questions
   SET explanation_source = 'ai_draft', explanation_status = 'unreviewed'
   WHERE explanation_source = 'none' AND explanation IS NOT NULL AND length(trim(explanation)) > 0`,
  // Ranked questions --------------------------------------------------------
  "UPDATE questions SET explanation_source = 'none', explanation_status = 'unreviewed'",
  `UPDATE questions
   SET explanation_source = 'banner', explanation_status = 'unreviewed'
   WHERE correct_option IS NULL
      OR explanation LIKE '%pending%'
      OR explanation LIKE '%editorial review%'`,
  `UPDATE questions
   SET explanation_source = 'ai_draft', explanation_status = 'unreviewed'
   WHERE explanation_source != 'banner' AND explanation IS NOT NULL AND length(trim(explanation)) > 0`,
];

const countQuery = (table) =>
  `SELECT explanation_source, explanation_status, count(*) AS count FROM ${table} GROUP BY explanation_source, explanation_status`;

function wrangler(args, options = {}) {
  const result = spawnSync("npx", ["wrangler", "d1", "execute", DATABASE, ...args], {
    cwd: process.cwd(),
    encoding: options.encoding ?? "utf8",
    stdio: options.stdio ?? "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout ?? "";
}

function parseWranglerJson(stdout) {
  const start = stdout.indexOf("[");
  const end = stdout.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(stdout.slice(start, end + 1));
    return parsed?.[0]?.results ?? [];
  } catch {
    return [];
  }
}

console.log(`🔄 Backfilling explanation provenance (${REMOTE ? "remote" : "local"})...`);

if (REMOTE) {
  const dir = mkdtempSync(join(tmpdir(), "cuet-provenance-"));
  const file = join(dir, "backfill.sql");
  writeFileSync(file, ["BEGIN TRANSACTION;", ...statements.map((sql) => `${sql};`), "COMMIT;"].join("\n"));
  wrangler(["--remote", `--file=${file}`]);
  for (const table of ["practice_questions", "questions"]) {
    const rows = parseWranglerJson(
      wrangler(["--remote", "--json", "--command", countQuery(table)], { encoding: "utf8", stdio: "pipe" }),
    );
    console.log(`\n📊 ${table}:`);
    console.table(rows);
  }
} else {
  const files = readdirSync(d1Dir)
    .filter((f) => f.endsWith(".sqlite"))
    .map((f) => ({ name: f, size: statSync(join(d1Dir, f)).size }))
    .sort((a, b) => b.size - a.size);
  if (files.length === 0) {
    console.error("No local Miniflare D1 database found. Run npm run db:migrate:local first.");
    process.exit(1);
  }
  const db = new DatabaseSync(join(d1Dir, files[0].name));
  db.exec("BEGIN TRANSACTION;");
  for (const sql of statements) db.exec(sql);
  db.exec("COMMIT;");
  for (const table of ["practice_questions", "questions"]) {
    console.log(`\n📊 ${table}:`);
    console.table(db.prepare(countQuery(table)).all());
  }
}

console.log("✅ Backfill completed successfully.");
