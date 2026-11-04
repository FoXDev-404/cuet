#!/usr/bin/env node
/**
 * Import the previous-year practice library into the ranked mock engine.
 *
 * Usage (from the repository root, after `db:migrate:local`):
 *   node scripts/import-ranked-practice.mjs --local
 *   node scripts/import-ranked-practice.mjs --remote
 *   node scripts/import-ranked-practice.mjs --dry-run
 *
 * Every paper in src/data/local-papers/index.json becomes a published mock with
 * a published version, stored passages and questions, and mock_questions rows.
 * Questions whose printed key is missing are not imported: a ranked mock cannot
 * award or deduct marks without an authoritative key. The practice detail page
 * discloses how many questions were excluded for that reason.
 *
 * Re-running the import publishes a new version for each existing paper. Old
 * versions stay immutable so attempts keep pointing at the paper they were
 * served.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPaper,
  buildSummary,
  createStoredKeys,
  LOCAL_MARKING_SCHEME,
} from "../src/lib/practice-normalize.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX_FILE = join(ROOT, "src", "data", "local-papers", "index.json");
const KEYS_FILE = join(ROOT, "src", "data", "local-papers", "keys.json");
const PAPERS_DIR = join(ROOT, "public", "local-papers", "papers");
const OUT_DIR = join(ROOT, ".wrangler", "ranked-practice-import");
const DB_NAME = "cuet-blueprint-db";
const CHUNK_BYTES = 1_500_000;
const MARKING = {
  correct: LOCAL_MARKING_SCHEME.correct,
  wrong: -Math.abs(LOCAL_MARKING_SCHEME.wrong),
  skipped: LOCAL_MARKING_SCHEME.skipped,
};

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
const paperFiles = new Set(readdirSync(PAPERS_DIR).filter((name) => name.endsWith(".json")));

const warnings = [];
const summaries = [];
for (const raw of index.papers ?? []) {
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

function instructionsFor(count, durationMinutes) {
  return [
    `${count} questions · ${durationMinutes} minutes.`,
    `Marking: +${MARKING.correct} for a correct answer, ${MARKING.wrong} for a wrong answer, ${MARKING.skipped} for an unattempted question.`,
    "The countdown starts when you begin and the attempt submits automatically at zero.",
    "Correct options and explanations are shown after you submit.",
  ].join("\n");
}

function galleryAssets(question) {
  return question.assets
    .filter((asset) => asset.kind !== "explanation" && !asset.path.includes("-exp-"))
    .map((asset) => ({
      url: asset.path,
      alt: asset.alt || `${asset.kind} for question ${question.number}`,
      kind: asset.kind,
    }));
}

function primaryAsset(assets, options = []) {
  const optionUrls = new Set(options.map((o) => o.image_url).filter(Boolean));
  const available = assets.filter((asset) => !optionUrls.has(asset.url) && asset.kind !== "explanation" && !asset.url.includes("-exp-"));
  return (
    available.find((asset) => asset.kind === "figure") ??
    available.find((asset) => asset.kind === "table") ??
    available.find((asset) => asset.kind !== "options") ??
    null
  );
}

/** @type {{ slug: string, statements: string[], imported: number, excluded: number, assets: number, imageQuestions: number }[]} */
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

  const questions = paper.questions.filter((question) => question.scorable);
  const excluded = paper.questions.length - questions.length;
  if (questions.length === 0) {
    warnings.push(`Skipped ${summary.slug}: no question has an authoritative key.`);
    continue;
  }

  const slug = sql(paper.slug);
  const mockExpr = `(SELECT id FROM mock_tests WHERE slug = ${slug})`;
  const versionExpr =
    `(SELECT id FROM mock_test_versions WHERE mock_id = ${mockExpr} ` +
    `ORDER BY version_no DESC LIMIT 1)`;
  const subjectExpr = `(SELECT id FROM subjects WHERE slug = ${sql(paper.subject.slug)})`;
  const duration = paper.durationMinutes;
  const totalMarks = questions.length * MARKING.correct;
  const section = paper.subject.name;
  const statements = [];

  // A failed earlier run may have left a draft version behind. Draft rows are
  // the only ones the immutability triggers allow us to replace.
  statements.push(
    `DELETE FROM mock_questions WHERE version_id IN (` +
      `SELECT id FROM mock_test_versions WHERE mock_id = ${mockExpr} AND status = 'draft');`,
    `DELETE FROM mock_test_versions WHERE mock_id = ${mockExpr} AND status = 'draft';`,
  );

  statements.push(
    `INSERT INTO mock_tests (
       exam_id, subject_id, title, slug, type, duration_min, total_marks, marking_scheme,
       instructions, pyq_year, pyq_shift, status, practice_paper_slug, created_at
     ) VALUES (
       (SELECT id FROM exams WHERE slug = 'cuet-ug'), ${subjectExpr}, ${sql(paper.title)}, ${slug},
       'pyq', ${duration}, ${totalMarks}, ${sql(JSON.stringify(MARKING))},
       ${sql(instructionsFor(questions.length, duration))}, ${paper.year}, ${sql(paper.shift)},
       'draft', ${slug}, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     )
     ON CONFLICT(slug) DO UPDATE SET
       exam_id = excluded.exam_id,
       subject_id = excluded.subject_id,
       title = excluded.title,
       type = excluded.type,
       duration_min = excluded.duration_min,
       total_marks = excluded.total_marks,
       marking_scheme = excluded.marking_scheme,
       instructions = excluded.instructions,
       pyq_year = excluded.pyq_year,
       pyq_shift = excluded.pyq_shift,
       practice_paper_slug = excluded.practice_paper_slug,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');`,
  );

  statements.push(
    `INSERT INTO mock_test_versions (
       mock_id, version_no, duration_min, total_marks, marking_scheme, instructions, status
     ) VALUES (
       ${mockExpr},
       (SELECT COALESCE(MAX(version_no), 0) + 1 FROM mock_test_versions WHERE mock_id = ${mockExpr}),
       ${duration}, ${totalMarks}, ${sql(JSON.stringify(MARKING))},
       ${sql(instructionsFor(questions.length, duration))}, 'draft'
     );`,
  );

  const questionPosition = new Map(questions.map((question, index) => [question.id, index + 1]));
  let assetCount = 0;
  let imageQuestionCount = 0;

  const insertQuestion = (question, passageExpr) => {
    const assets = galleryAssets(question);
    const options = question.options.map((option) => ({
      text: option.text,
      image_url: option.image_url ?? null,
      alt: null,
    }));
    const primary = primaryAsset(assets, options);
    const correctOption = question.options.findIndex((option) => option.id === question.correctAnswer);
    if (correctOption < 0) {
      warnings.push(`${paper.slug}/${question.id}: correct option is not in the option list.`);
      return;
    }
    if (assets.length > 0) {
      assetCount += assets.length;
      imageQuestionCount += 1;
    }
    statements.push(
      `INSERT INTO questions (
         subject_id, passage_id, text, options, correct_option, explanation, year,
         image_url, image_alt, status, assets_json, created_at
       ) VALUES (
         ${subjectExpr}, ${passageExpr}, ${sql(question.stemEn || `Question ${question.number}`)},
         ${json(options)}, ${correctOption}, ${sql(question.explanation)}, ${paper.year},
         ${sql(primary?.url ?? null)}, ${sql(primary?.alt ?? null)}, 'published',
         ${json(assets)}, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       );
       INSERT INTO mock_questions (version_id, question_id, section, position)
       VALUES (${versionExpr}, last_insert_rowid(), ${sql(section)}, ${questionPosition.get(question.id)});`,
    );
  };

  const passages = new Map();
  const byPassage = new Map();
  const withoutPassage = [];
  for (const question of questions) {
    if (!question.passage) {
      withoutPassage.push(question);
      continue;
    }
    passages.set(question.passage.id, question.passage);
    const list = byPassage.get(question.passage.id) ?? [];
    list.push(question);
    byPassage.set(question.passage.id, list);
  }

  // Insert one passage, then every question that depends on it. `MAX(id)` stays
  // pinned to that passage until the next passage insert starts a new group.
  for (const [passageId, group] of byPassage) {
    const passage = passages.get(passageId);
    statements.push(
      `INSERT INTO passages (subject_id, body, image_url, image_alt, deleted_at)
       VALUES (${subjectExpr}, ${sql(passage.content)}, NULL, NULL, NULL);`,
    );
    const passageExpr = `(SELECT MAX(id) FROM passages WHERE subject_id = ${subjectExpr})`;
    for (const question of group) insertQuestion(question, passageExpr);
  }
  for (const question of withoutPassage) insertQuestion(question, "NULL");

  statements.push(
    `UPDATE mock_test_versions SET status = 'published',
       published_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ${versionExpr};`,
    `UPDATE mock_test_versions SET status = 'superseded'
     WHERE mock_id = ${mockExpr} AND status = 'published' AND id <> ${versionExpr};`,
    `UPDATE mock_tests SET
       current_version_id = ${versionExpr},
       status = 'published',
       version = (SELECT version_no FROM mock_test_versions WHERE id = ${versionExpr}),
       published_at = (SELECT published_at FROM mock_test_versions WHERE id = ${versionExpr}),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE slug = ${slug};`,
  );

  importedPapers.push({
    slug: paper.slug,
    statements,
    imported: questions.length,
    excluded,
    assets: assetCount,
    imageQuestions: imageQuestionCount,
  });
}

const totals = importedPapers.reduce(
  (acc, paper) => {
    acc.papers += 1;
    acc.questions += paper.imported;
    acc.excluded += paper.excluded;
    acc.assets += paper.assets;
    acc.imageQuestions += paper.imageQuestions;
    return acc;
  },
  { papers: 0, questions: 0, excluded: 0, assets: 0, imageQuestions: 0 },
);

console.log("Ranked practice import");
console.log(`  target        : ${remote ? "remote" : "local"}${dryRun ? " (dry run)" : ""}`);
console.log(`  papers        : ${totals.papers} / ${summaries.length}`);
console.log(`  questions     : ${totals.questions}`);
console.log(`  excluded      : ${totals.excluded} (no authoritative key)`);
console.log(`  assets        : ${totals.assets}`);
console.log(`  image rows    : ${totals.imageQuestions}`);
console.log(`  marking       : +${MARKING.correct} / ${MARKING.wrong} / ${MARKING.skipped}`);

if (warnings.length > 0) {
  console.log("\nWarnings:");
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (totals.papers === 0) {
  console.error("\nNothing to import.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// SQL files
// ---------------------------------------------------------------------------
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const chunks = [];
let current = [];
let currentBytes = 0;
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
  const file = join(OUT_DIR, `ranked-practice-${String(index + 1).padStart(3, "0")}.sql`);
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

console.log("\nImport complete.");
