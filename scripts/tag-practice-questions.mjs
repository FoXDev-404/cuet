#!/usr/bin/env node
/**
 * Import editor-assigned topic tags for previous-year practice questions.
 *
 * The local practice library has no topic metadata in its source JSON, and the
 * timed bank cannot be re-tagged after publishing (the immutability trigger
 * blocks `questions.topic_id` updates). This script writes the nullable
 * `practice_questions.topic_id` column added by migration 0027 instead.
 *
 * CSV columns (header optional):
 *   paper_slug,question_key,topic_slug
 *
 * Usage:
 *   node scripts/tag-practice-questions.mjs --file topic-map.csv
 *       Dry-run against the local Miniflare D1 database.
 *   node scripts/tag-practice-questions.mjs --file topic-map.csv --apply
 *       Apply locally.
 *   node scripts/tag-practice-questions.mjs --file topic-map.csv --apply --remote
 *       Apply to production D1 (needs an authenticated Wrangler).
 *   node scripts/tag-practice-questions.mjs --file topic-map.csv --apply \
 *       --remote --database cuet-d1-staging
 *       Apply to another D1 database.
 *   node scripts/tag-practice-questions.mjs --file topic-map.csv --db path/to.sqlite
 *       Dry-run against an explicit SQLite file.
 *
 * Rows with an unknown paper, an unknown question key or a topic from another
 * subject abort the whole import. The script never guesses a topic from the
 * question text and never partially applies a CSV with validation errors.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
  parsePracticeTopicCsv,
  planPracticeTopicUpdates,
} from "../src/lib/practice-topics.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const D1_DIR = join(ROOT, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
const REMOTE = process.argv.includes("--remote");
const APPLY = process.argv.includes("--apply");
const DRY_RUN = !APPLY;

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

const FILE = option("--file");
if (!FILE) fail("Missing --file <csv>. See docs/TOPIC_BACKFILL.md for the format.");

const DATABASE = option("--database") ?? "cuet-blueprint-db";
if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(DATABASE)) fail(`Invalid D1 database name: ${DATABASE}`);

const WRANGLER_ENV = option("--env");
if (WRANGLER_ENV !== null && !/^[a-z0-9][a-z0-9-]{1,62}$/.test(WRANGLER_ENV)) {
  fail(`Invalid Wrangler environment: ${WRANGLER_ENV}`);
}
const ENV_ARGS = WRANGLER_ENV ? ["--env", WRANGLER_ENV] : [];

const explicitDb = option("--db");
if (REMOTE && explicitDb) fail("Use either --remote or --db, not both.");

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function wrangler(args, { capture = false } = {}) {
  const result = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", DATABASE, ...ENV_ARGS, ...args],
    {
      cwd: ROOT,
      encoding: "utf8",
      stdio: capture ? "pipe" : "inherit",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (capture && result.stderr) console.error(result.stderr);
    process.exit(result.status ?? 1);
  }
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

function remoteRows(sql) {
  return parseWranglerJson(
    wrangler(["--remote", "--json", "--command", sql], { capture: true }),
  );
}

function localDatabasePath() {
  if (explicitDb) return resolve(ROOT, explicitDb);
  if (!readdirSync(D1_DIR, { throwIfNoEntry: false })) {
    fail("No local Miniflare D1 directory. Run `npm run db:migrate:local` first.");
  }
  const files = readdirSync(D1_DIR)
    .filter((name) => name.endsWith(".sqlite"))
    .map((name) => ({ name, size: statSync(join(D1_DIR, name)).size }))
    .sort((a, b) => b.size - a.size);
  if (files.length === 0) fail("No local Miniflare D1 database found.");
  return join(D1_DIR, files[0].name);
}

function collectContext(paperSlugs) {
  const placeholders = paperSlugs.map(() => "?").join(",");
  const paperSql = `SELECT slug, subject_id FROM practice_papers
    WHERE slug IN (${placeholders})
      AND publication_status = 'published' AND deleted_at IS NULL`;
  const questionSql = `SELECT paper_slug, question_key FROM practice_questions
    WHERE paper_slug IN (${placeholders}) AND deleted_at IS NULL`;
  const topicSql = `SELECT id, slug, subject_id FROM topics WHERE deleted_at IS NULL`;

  let paperRows;
  let questionRows;
  let topicRows;
  if (REMOTE) {
    const inList = paperSlugs.map(sqlString).join(",");
    paperRows = remoteRows(paperSql.replace(placeholders, inList), []);
    questionRows = remoteRows(questionSql.replace(placeholders, inList));
    topicRows = remoteRows(topicSql);
  } else {
    const db = new DatabaseSync(localDatabasePath(), { readOnly: true });
    paperRows = db.prepare(paperSql).all(...paperSlugs);
    questionRows = db.prepare(questionSql).all(...paperSlugs);
    topicRows = db.prepare(topicSql).all();
    db.close();
  }

  const papers = new Map();
  for (const row of paperRows) papers.set(row.slug, { subjectId: Number(row.subject_id) });
  const questionKeys = new Map();
  for (const row of questionRows) {
    if (!questionKeys.has(row.paper_slug)) questionKeys.set(row.paper_slug, new Set());
    questionKeys.get(row.paper_slug).add(row.question_key);
  }
  const topics = new Map();
  for (const row of topicRows) {
    topics.set(`${Number(row.subject_id)}:${row.slug}`, {
      id: Number(row.id),
      subjectId: Number(row.subject_id),
    });
  }
  return { papers, questionKeys, topics };
}

const csvPath = resolve(ROOT, FILE);
let csv;
try {
  csv = readFileSync(csvPath, "utf8");
} catch (error) {
  fail(`Cannot read ${csvPath}: ${error.message}`);
}

const parsed = parsePracticeTopicCsv(csv);
if (parsed.errors.length > 0) {
  console.error("CSV validation failed:");
  for (const error of parsed.errors) console.error(`  - ${error}`);
  fail(`${parsed.errors.length} CSV row error(s); nothing was written.`);
}
if (parsed.rows.length === 0) fail("The CSV contains no mapping rows.");

const paperSlugs = [...new Set(parsed.rows.map((row) => row.paperSlug))];
const context = collectContext(paperSlugs);
const planned = planPracticeTopicUpdates(parsed.rows, context);
if (planned.errors.length > 0) {
  console.error("Mapping validation failed:");
  for (const error of planned.errors) console.error(`  - ${error}`);
  fail(`${planned.errors.length} mapping error(s); nothing was written.`);
}

console.log(
  `${DRY_RUN ? "🔎 Dry run" : "✍️  Import"} — ${planned.updates.length} tag(s) across ${
    new Set(planned.updates.map((row) => row.paperSlug)).size
  } paper(s), ${REMOTE ? `remote D1 ${DATABASE}` : "local D1"}.`,
);

if (DRY_RUN) {
  console.log("\nNo rows written. Re-run with --apply to persist the mapping.");
} else if (REMOTE) {
  const dir = mkdtempSync(join(tmpdir(), "cuet-topic-tags-"));
  const file = join(dir, "tag-practice-questions.sql");
  const statements = planned.updates.map(
    (row) =>
      `UPDATE practice_questions SET topic_id = ${row.topicId}, updated_at = CURRENT_TIMESTAMP
       WHERE paper_slug = ${sqlString(row.paperSlug)}
         AND question_key = ${sqlString(row.questionKey)}
         AND deleted_at IS NULL;`,
  );
  // D1 rejects BEGIN/COMMIT in uploaded SQL files. The updates are idempotent,
  // so a retry after a failure is safe.
  writeFileSync(file, `${statements.join("\n")}\n`);
  wrangler(["--remote", `--file=${file}`]);
} else {
  const db = new DatabaseSync(localDatabasePath());
  const update = db.prepare(
    `UPDATE practice_questions SET topic_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE paper_slug = ? AND question_key = ? AND deleted_at IS NULL`,
  );
  db.exec("BEGIN TRANSACTION;");
  try {
    for (const row of planned.updates) {
      const result = update.run(row.topicId, row.paperSlug, row.questionKey);
      if ((result.changes ?? 0) !== 1) {
        throw new Error(
          `Expected one row for ${row.paperSlug}/${row.questionKey}, changed ${result.changes ?? 0}.`,
        );
      }
    }
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    db.close();
    fail(`Import rolled back: ${error.message}`);
  }
  db.close();
}

const countSql =
  "SELECT COUNT(*) AS tagged FROM practice_questions WHERE topic_id IS NOT NULL AND deleted_at IS NULL";
if (REMOTE) {
  console.table(remoteRows(countSql));
} else {
  const db = new DatabaseSync(localDatabasePath(), { readOnly: true });
  console.table(db.prepare(countSql).all());
  db.close();
}

console.log("\n✅ Topic mapping import completed.");
