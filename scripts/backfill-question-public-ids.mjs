#!/usr/bin/env node
/**
 * Backfill one public id per question lineage and repair stale pointers.
 *
 * Usage (from the repository root, after applying migration 0012):
 *   node scripts/backfill-question-public-ids.mjs --local
 *   node scripts/backfill-question-public-ids.mjs --remote
 *   node scripts/backfill-question-public-ids.mjs --local --dry-run
 *
 * The public id is generated in application code with Web Crypto, not by SQL.
 * The script is idempotent: existing lineages keep their id and reruns only
 * fill missing heads or move a pointer to the newest revision.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generatePublicId } from "../src/lib/share/public-id.ts";
import {
  createStatementSql,
  moveStatementSql,
  planPublicIdBackfill,
} from "../src/lib/share/backfill.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, ".wrangler", "share-backfill");
const DB_NAME = "cuet-blueprint-db";
const WRANGLER_BIN = join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");

const args = new Set(process.argv.slice(2));
const local = args.has("--local");
const remote = args.has("--remote");
const dryRun = args.has("--dry-run");

if (local === remote) {
  console.error("Choose exactly one target: --local or --remote.");
  process.exit(1);
}
if (!remote && args.has("--production")) {
  console.error("Use --remote for production.");
  process.exit(1);
}

const target = remote ? "--remote" : "--local";

function runWrangler(wranglerArgs) {
  const result = spawnSync(process.execPath, wranglerArgs, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `wrangler failed (${result.status}):\n${result.stderr || result.stdout || ""}`,
    );
  }
  return result.stdout;
}

function d1Json(command) {
  const output = runWrangler([
    WRANGLER_BIN,
    "d1",
    "execute",
    DB_NAME,
    target,
    "--json",
    "--command",
    command,
  ]);
  const start = output.indexOf("[");
  const end = output.lastIndexOf("]");
  if (start < 0 || end < start) {
    throw new Error(`Could not read wrangler JSON output:\n${output.slice(0, 2000)}`);
  }
  return JSON.parse(output.slice(start, end + 1));
}

const questionsSql = `
  SELECT q.id, q.supersedes_id, q.deleted_at, q.year,
         CASE WHEN EXISTS (
           SELECT 1
           FROM mock_questions_current mq
           JOIN mock_tests m ON m.id = mq.mock_id
           WHERE mq.question_id = q.id AND m.type = 'pyq' AND m.deleted_at IS NULL
         ) THEN 1 ELSE 0 END AS is_pyq
  FROM questions q
  ORDER BY q.id`;
const mappingsSql = `
  SELECT public_id, current_question_id
  FROM question_public_ids
  ORDER BY public_id`;

console.log(`Target: ${remote ? "REMOTE" : "local D1"}${dryRun ? " (dry run)" : ""}`);
const [questionResult, mappingResult] = d1Json(`${questionsSql};\n${mappingsSql};`);
const questions = questionResult?.results ?? [];
const mappings = mappingResult?.results ?? [];
if (!Array.isArray(questions) || !Array.isArray(mappings)) {
  throw new Error("Unexpected D1 result shape for the backfill query.");
}

const plan = planPublicIdBackfill(questions, mappings, generatePublicId);

console.log(
  `Read ${questions.length} question rows and ${mappings.length} public ids. ` +
    `${plan.create.length} will be created, ${plan.move.length} pointer(s) moved.`,
);
if (plan.conflicts.length > 0) {
  console.error("\nConflicts found; no SQL was written:");
  for (const conflict of plan.conflicts) console.error(`- ${conflict}`);
  process.exit(1);
}
if (plan.create.length > 0) {
  console.log("\nNew public ids:");
  for (const entry of plan.create.slice(0, 20)) {
    console.log(`  question ${entry.questionId} -> ${entry.publicId} (share ${entry.shareEnabled})`);
  }
  if (plan.create.length > 20) console.log(`  ...and ${plan.create.length - 20} more`);
}
if (plan.move.length > 0) {
  console.log("\nPointer moves:");
  for (const entry of plan.move.slice(0, 20)) {
    console.log(`  ${entry.publicId} -> question ${entry.questionId}`);
  }
  if (plan.move.length > 20) console.log(`  ...and ${plan.move.length - 20} more`);
}

if (dryRun) {
  console.log("\nDry run: no D1 statements executed.");
  process.exit(0);
}

const sql = [
  "PRAGMA foreign_keys = ON;",
  moveStatementSql(plan),
  createStatementSql(plan),
]
  .filter(Boolean)
  .join("\n");
if (!sql.trim()) {
  console.log("\nNothing to write.");
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
const file = join(OUT_DIR, `backfill-${Date.now()}.sql`);
writeFileSync(file, `${sql}\n`);

console.log(`\nApplying ${file}`);
runWrangler([
  WRANGLER_BIN,
  "d1",
  "execute",
  DB_NAME,
  target,
  `--file=${file}`,
]);

const [verifyQuestions, verifyMappings] = d1Json(`${questionsSql};\n${mappingsSql};`);
const verifiedQuestions = verifyQuestions?.results ?? [];
const verifiedMappings = verifyMappings?.results ?? [];
const verifyPlan = planPublicIdBackfill(verifiedQuestions, verifiedMappings, generatePublicId);
if (verifyPlan.create.length > 0 || verifyPlan.move.length > 0 || verifyPlan.conflicts.length > 0) {
  console.error(
    `\nVerification failed: ${verifyPlan.create.length} missing, ` +
      `${verifyPlan.move.length} stale pointer(s), ${verifyPlan.conflicts.length} conflict(s).`,
  );
  process.exit(1);
}
const heads = new Set(
  verifiedQuestions
    .filter((question) => !question.deleted_at)
    .map((question) => question.id),
);
console.log(
  `\nDone. ${verifiedMappings.length} public id(s) across ${heads.size} non-deleted question row(s).`,
);
