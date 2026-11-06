#!/usr/bin/env node
/**
 * Import the refined previous-year practice library into D1.
 *
 * Usage (from the repository root):
 *   node scripts/import-practice-library.mjs --local
 *   node scripts/import-practice-library.mjs --remote
 *   node scripts/import-practice-library.mjs --dry-run
 *
 * The JSON files stay in the repo as the seed. Re-running the import replaces
 * every practice paper row for the slugs in index.json (including questions and
 * passages), so admin edits are reset to the seed.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPaper,
  buildSummary,
  createStoredKeys,
} from "../src/lib/practice-normalize.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX_FILE = join(ROOT, "src", "data", "local-papers", "index.json");
const KEYS_FILE = join(ROOT, "src", "data", "local-papers", "keys.json");
const PAPERS_DIR = join(ROOT, "public", "local-papers", "papers");
const OUT_DIR = join(ROOT, ".wrangler", "practice-import");
const DATABASE_ARG = (() => {
  const index = process.argv.indexOf("--database");
  return index >= 0 ? process.argv[index + 1] : null;
})();
const DB_NAME = DATABASE_ARG ?? "cuet-blueprint-db";
if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(DB_NAME)) {
  console.error(`Invalid D1 database name: ${DB_NAME}`);
  process.exit(1);
}
const CHUNK_BYTES = 1_500_000;

const args = new Set(process.argv.slice(2));
const remote = args.has("--remote");
const dryRun = args.has("--dry-run");
const target = remote ? "--remote" : "--local";

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function sql(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function json(value) {
  return sql(JSON.stringify(value ?? null));
}

const index = readJson(INDEX_FILE);
const keysData = readJson(KEYS_FILE);
const storedKeys = createStoredKeys(keysData);

const rawIndexPapers = index.papers ?? [];
const paperFiles = new Set(readdirSync(PAPERS_DIR).filter((name) => name.endsWith(".json")));

const warnings = [];
const summaries = [];
for (const raw of rawIndexPapers) {
  const summary = buildSummary(raw);
  if (!summary) {
    warnings.push(`Skipped index row without a slug: ${JSON.stringify(raw.title ?? "")}`);
    continue;
  }
  summaries.push(summary);
  if (!paperFiles.has(`${summary.slug}.json`)) {
    warnings.push(`Missing paper file for ${summary.slug}`);
  }
}

const subjects = new Map();
for (const summary of summaries) {
  subjects.set(summary.subject.slug, summary.subject);
}

const subjectSql = [];
for (const subject of subjects.values()) {
  const type = subject.slug === "general-test"
    ? "general"
    : ["english", "hindi"].includes(subject.slug)
      ? "language"
      : "domain";
  subjectSql.push(
    `INSERT INTO subjects (exam_id, name, slug, type, is_active, code)\n` +
      `VALUES ((SELECT id FROM exams WHERE slug = 'cuet-ug'), ${sql(subject.name)}, ${sql(subject.slug)}, ${sql(type)}, 1, ${sql(subject.code)})\n` +
      `ON CONFLICT(slug) DO NOTHING;`,
    `UPDATE subjects SET code = ${sql(subject.code)}\n` +
      `WHERE slug = ${sql(subject.slug)} AND (code IS NULL OR TRIM(code) = '');`,
  );
}

/** @type {{ slug: string, statements: string[], questions: number, scorable: number, assets: number }[]} */
const importedPapers = [];
for (const summary of summaries) {
  const file = join(PAPERS_DIR, `${summary.slug}.json`);
  let raw;
  try {
    raw = readJson(file);
  } catch {
    warnings.push(`Could not read ${summary.slug}.json`);
    continue;
  }

  const paper = buildPaper(raw, summary, storedKeys.get(summary.slug));
  if (!paper) {
    warnings.push(`Normalised paper is empty: ${summary.slug}`);
    continue;
  }

  const rawQuestions = new Map(
    (raw.exam?.questions ?? []).map((question) => [String(question.id ?? ""), question]),
  );

  const statements = [
    `DELETE FROM practice_questions WHERE paper_slug = ${sql(paper.slug)};`,
    `DELETE FROM practice_passages WHERE paper_slug = ${sql(paper.slug)};`,
    `INSERT INTO practice_papers (
       slug, title, meta_description, subject_id, year, exam_date, date_label, shift,
       duration_min, source_file, source_method, source_question_count,
       publication_status, review_required
     ) VALUES (
       ${sql(paper.slug)}, ${sql(paper.title)}, ${sql(summary.metaDescription)},
       (SELECT id FROM subjects WHERE slug = ${sql(paper.subject.slug)}),
       ${sql(paper.year)}, ${sql(paper.date)}, ${sql(paper.dateLabel)}, ${sql(paper.shift)},
       ${sql(paper.durationMinutes)}, ${sql(paper.sourceFile)}, ${sql(paper.sourceMethod)},
       ${sql(paper.sourceQuestionCount)}, ${sql(paper.publicationStatus)},
       ${sql(paper.reviewRequired)}
     )
     ON CONFLICT(slug) DO UPDATE SET
       title = excluded.title,
       meta_description = excluded.meta_description,
       subject_id = excluded.subject_id,
       year = excluded.year,
       exam_date = excluded.exam_date,
       date_label = excluded.date_label,
       shift = excluded.shift,
       duration_min = excluded.duration_min,
       source_file = excluded.source_file,
       source_method = excluded.source_method,
       source_question_count = excluded.source_question_count,
       publication_status = excluded.publication_status,
       review_required = excluded.review_required,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');`,
  ];

  const passages = new Map();
  for (const question of paper.questions) {
    if (question.passage) passages.set(question.passage.id, question.passage);
  }
  for (const passage of passages.values()) {
    statements.push(
      `INSERT INTO practice_passages (paper_slug, passage_key, title, body)\n` +
        `VALUES (${sql(paper.slug)}, ${sql(passage.id)}, ${sql(passage.title)}, ${sql(passage.content)});`,
    );
  }

  let assetCount = 0;
  let imageQuestionCount = 0;
  paper.questions.forEach((question, position) => {
    const rawQuestion = rawQuestions.get(question.id) ?? {};
    assetCount += question.assets.length;
    if (question.assets.length > 0) imageQuestionCount += 1;
    statements.push(
      `INSERT INTO practice_questions (
         paper_slug, question_key, source_question_no, position, stem, options_json,
         options_are_images, correct_option, explanation, passage_key, match_list_json,
         arrangement_json, assets_json, source_pages_json, review_status, review_flags_json
       ) VALUES (
         ${sql(paper.slug)}, ${sql(question.id)}, ${sql(question.number)}, ${position + 1},
         ${sql(question.stemEn)}, ${json(question.options)}, ${sql(question.optionsAreImages)},
         ${sql(question.correctAnswer)}, ${sql(question.explanation)},
         ${sql(question.passage?.id ?? null)}, ${json(question.matchList)},
         ${json(question.arrangementItems)}, ${json(question.assets)},
         ${json(Array.isArray(rawQuestion.sourcePages) ? rawQuestion.sourcePages : [])},
         ${sql(rawQuestion.reviewStatus ?? null)}, ${json(question.reviewFlags)}
       );`,
    );
  });

  importedPapers.push({
    slug: paper.slug,
    statements,
    questions: paper.questions.length,
    scorable: paper.scorableQuestionCount,
    assets: assetCount,
    imageQuestions: imageQuestionCount,
    indexQuestions: summary.recoveredQuestionCount,
    indexScorable: summary.scorableQuestionCount,
    indexPending: summary.pendingReviewCount,
    indexAssets: summary.assetCount,
    indexImageQuestions: summary.imageQuestionCount,
  });
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const totals = importedPapers.reduce(
  (acc, paper) => {
    acc.papers += 1;
    acc.questions += paper.questions;
    acc.scorable += paper.scorable;
    acc.assets += paper.assets;
    acc.imageQuestions += paper.imageQuestions;
    acc.indexQuestions += paper.indexQuestions;
    acc.indexScorable += paper.indexScorable;
    acc.indexAssets += paper.indexAssets;
    acc.indexImageQuestions += paper.indexImageQuestions;
    return acc;
  },
  {
    papers: 0,
    questions: 0,
    scorable: 0,
    assets: 0,
    imageQuestions: 0,
    indexQuestions: 0,
    indexScorable: 0,
    indexAssets: 0,
    indexImageQuestions: 0,
  },
);

const countMismatches = importedPapers.filter(
  (paper) =>
    paper.questions !== paper.indexQuestions ||
    paper.scorable !== paper.indexScorable ||
    paper.assets !== paper.indexAssets ||
    paper.imageQuestions !== paper.indexImageQuestions,
);

console.log("Practice library import");
console.log(`  target        : ${remote ? "remote" : "local"}${dryRun ? " (dry run)" : ""}`);
console.log(`  papers        : ${totals.papers} / ${summaries.length}`);
console.log(`  questions     : ${totals.questions} (index ${totals.indexQuestions})`);
console.log(`  scorable      : ${totals.scorable} (index ${totals.indexScorable})`);
console.log(`  pending       : ${totals.questions - totals.scorable}`);
console.log(`  assets        : ${totals.assets} (index ${totals.indexAssets})`);
console.log(`  image rows    : ${totals.imageQuestions} (index ${totals.indexImageQuestions})`);
console.log(`  subjects      : ${subjects.size}`);

if (countMismatches.length > 0) {
  console.log("\nPer-paper count differences (normalised rows vs index.json):");
  for (const paper of countMismatches.slice(0, 20)) {
    console.log(
      `  ${paper.slug}: q ${paper.questions}/${paper.indexQuestions}, keyed ${paper.scorable}/${paper.indexScorable}, assets ${paper.assets}/${paper.indexAssets}, image ${paper.imageQuestions}/${paper.indexImageQuestions}`,
    );
  }
  if (countMismatches.length > 20) {
    console.log(`  ...and ${countMismatches.length - 20} more`);
  }
}

if (warnings.length > 0) {
  console.log("\nWarnings:");
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (totals.questions === 0) {
  console.error("\nNothing to import.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// SQL files
// ---------------------------------------------------------------------------
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const chunks = [];
let current = subjectSql.length > 0 ? [...subjectSql] : [];
let currentBytes = current.reduce((sum, statement) => sum + statement.length, 0);
for (const paper of importedPapers) {
  const paperBytes = paper.statements.reduce((sum, statement) => sum + statement.length, 0);
  if (current.length > 0 && currentBytes + paperBytes > CHUNK_BYTES) {
    chunks.push(current);
    current = [];
    currentBytes = 0;
  }
  current.push(...paper.statements);
  currentBytes += paperBytes;
}
if (current.length > 0) chunks.push(current);

const files = [];
chunks.forEach((statements, index) => {
  const file = join(OUT_DIR, `practice-${String(index + 1).padStart(3, "0")}.sql`);
  writeFileSync(file, `${statements.join("\n")}\n`, "utf8");
  files.push(file);
});

console.log(`\nGenerated ${files.length} SQL file(s) in ${OUT_DIR}`);
if (dryRun) {
  console.log("Dry run: no D1 statements executed.");
  process.exit(0);
}

for (const [index, file] of files.entries()) {
  console.log(`\n[${index + 1}/${files.length}] ${file}`);
  const command = `npx wrangler d1 execute ${DB_NAME} ${target} --file="${file}"`;
  const result = spawnSync(command, {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`\nImport chunk failed with exit code ${result.status}.`);
    process.exit(result.status ?? 1);
  }
}

// ---------------------------------------------------------------------------
// Cache purge
// ---------------------------------------------------------------------------
// The site serves the practice library through a Workers KV cache (see
// src/lib/practice-cache.ts). A fresh import must not be masked by a cached
// copy, so drop the index and every cached paper before finishing.
const cacheKeys = [
  "cache:practice:index:v1",
  "cache:practice:subjects:v1",
  ...importedPapers.map((paper) => `cache:practice:paper:v1:${paper.slug}`),
];
const cacheKeyFile = join(OUT_DIR, "practice-cache-keys.txt");
writeFileSync(cacheKeyFile, `${cacheKeys.join("\n")}\n`, "utf8");
console.log(`\nPurging ${cacheKeys.length} practice cache key(s)...`);
const purge = spawnSync(
  `npx wrangler kv bulk delete "${cacheKeyFile}" --binding MEDIA_KV ${target}`,
  { cwd: ROOT, stdio: "inherit", shell: true },
);
if (purge.error) throw purge.error;
if (purge.status !== 0) {
  console.warn(
    "\nCache purge failed. The cached library will refresh on its own within 10 minutes.",
  );
}

console.log("\nImport complete.");
