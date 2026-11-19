#!/usr/bin/env node
/**
 * Curation pass for the 25 locked 50-question PYQ sets that carry two or more
 * options with the identical text. Adds two review tags to each affected
 * `practice_questions` row instead of editing any content:
 *
 *   duplicate-option            the row has at least one duplicated option pair
 *   duplicate-option-in-keypair the correct answer falls inside such a pair
 *
 * The tags are additive metadata; the admin review surfaces already render
 * `review_flags_json`. No question text, option or answer is changed.
 *
 * Usage:
 *   node scripts/flag-duplicate-options.mjs --dry-run    # print intended flags (local read-only)
 *   node scripts/flag-duplicate-options.mjs --local      # apply to local D1
 *   node --env-file-if-exists=.dev.vars scripts/flag-duplicate-options.mjs --turso   # apply to Turso (production)
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createTursoClient, getTursoConfig, queryRows } from "./turso-lib.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SOURCE = JSON.parse(
  readFileSync(resolve(ROOT, "test-artifacts", "qa-locked-dups.decoded.json"), "utf8"),
);

const KEYPAIR_ROWS = new Set([
  "cuet-biology-pyq-set-14|q18",
  "cuet-biology-pyq-set-15|q15",
  "cuet-physics-pyq-set-1|q19",
]);

const flagsFor = (paperSlug, questionKey) => [
  "duplicate-option",
  ...(KEYPAIR_ROWS.has(`${paperSlug}|${questionKey}`) ? ["duplicate-option-in-keypair"] : []),
];

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const LOCAL = args.has("--local");
const TURSO = args.has("--turso");
if (!DRY_RUN && !LOCAL && !TURSO) {
  console.error("Usage: node scripts/flag-duplicate-options.mjs [--dry-run|--local|--turso]");
  process.exit(2);
}
if (TURSO && !(getTursoConfig()?.url && getTursoConfig()?.token)) {
  console.error("TURSO_DATABASE_URL / TURSO_AUTH_TOKEN missing (set them in .dev.vars).");
  process.exit(2);
}

const ROWS = SOURCE.map((row) => ({
  slug: row.paper_slug,
  key: row.question_key,
  flags: flagsFor(row.paper_slug, row.question_key),
}));

function localDatabasePath() {
  const dir = join(ROOT, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".sqlite")) continue;
    const db = new DatabaseSync(join(dir, name));
    try {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='practice_questions'")
        .get();
      if (row) return join(dir, name);
    } finally {
      db.close();
    }
  }
  throw new Error("Local D1 sqlite file not found (run npm run db:migrate:local first).");
}

function mergeFlags(existing, added) {
  try {
    const current = JSON.parse(String(existing ?? "[]"));
    const merged = new Set([...(Array.isArray(current) ? current : []), ...added]);
    return JSON.stringify([...merged]);
  } catch {
    return JSON.stringify(added);
  }
}

async function applyLocal() {
  const db = new DatabaseSync(localDatabasePath());
  try {
    for (const row of ROWS) {
      const existing = db
        .prepare("SELECT review_flags_json FROM practice_questions WHERE paper_slug = ? AND question_key = ?")
        .get(row.slug, row.key);
      const merged = mergeFlags(existing?.review_flags_json, row.flags);
      const result = db
        .prepare(
          "UPDATE practice_questions SET review_flags_json = ?, updated_at = CURRENT_TIMESTAMP WHERE paper_slug = ? AND question_key = ? AND deleted_at IS NULL",
        )
        .run(merged, row.slug, row.key);
      console.log(`  ${row.slug}/${row.key}: ${result.changes} row(s) -> ${merged}`);
    }
  } finally {
    db.close();
  }
}

async function applyRemote(client) {
  const transaction = await client.transaction("write");
  try {
    for (const row of ROWS) {
      const existing = await transaction.execute({
        sql: "SELECT review_flags_json FROM practice_questions WHERE paper_slug = ? AND question_key = ?",
        args: [row.slug, row.key],
      });
      const current = existing.rows?.[0]?.review_flags_json;
      const merged = mergeFlags(current, row.flags);
      const update = await transaction.execute({
        sql: "UPDATE practice_questions SET review_flags_json = ?, updated_at = CURRENT_TIMESTAMP WHERE paper_slug = ? AND question_key = ? AND deleted_at IS NULL",
        args: [merged, row.slug, row.key],
      });
      console.log(`  ${row.slug}/${row.key}: ${update.rowsAffected ?? update.changes} row(s) -> ${merged}`);
    }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback().catch(() => {});
    transaction.close();
    throw error;
  }
  transaction.close();
}

async function main() {
  for (const row of ROWS) {
    if (DRY_RUN) console.log(`  would flag ${row.slug}/${row.key}: ${row.flags.join(",")}`);
  }
  if (DRY_RUN) {
    console.log(`\nDry run complete (${ROWS.length} rows). Re-run with --local to apply to the local D1 copy.`);
    return;
  }
  if (LOCAL) {
    applyLocal();
    return;
  }
  const client = createTursoClient();
  console.log("Plan:\n" + ROWS.map((row) => `  ${row.slug}/${row.key}: ${row.flags.join(",")}`).join("\n"));
  await applyRemote(client);
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exit(1);
});
