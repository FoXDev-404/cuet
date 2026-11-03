#!/usr/bin/env node
/**
 * Generate per-question Open Graph images for indexable shared questions.
 *
 * Usage (from the repository root):
 *   node scripts/generate-question-og.mjs --local
 *   node scripts/generate-question-og.mjs --remote
 *   node scripts/generate-question-og.mjs --local --id=Ab3dE5fG7h,Kl9mN0pQ2r
 *   node scripts/generate-question-og.mjs --sample
 *
 * Images are written to public/og/questions/{publicId}.png and served as static
 * assets. The Worker never renders an OG image at request time. The same
 * eligibility rules as the public page are applied: published revision,
 * sharing/indexing flags, public reveal, rights confirmed, an explanation and
 * no membership in a currently published mock.
 *
 * Run this before `npm run deploy` when a question becomes indexable. The
 * script is idempotent and only needs write access to public/.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isValidPublicId } from "../src/lib/share/public-id.ts";
import { loadQuestionOgFonts, renderQuestionOgPng } from "./lib/question-og.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "og", "questions");
const SAMPLE_PATH = join(ROOT, ".wrangler", "question-og-sample.png");
const DB_NAME = "cuet-blueprint-db";
const WRANGLER_BIN = join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");

const args = new Set(process.argv.slice(2));
const local = args.has("--local");
const remote = args.has("--remote");
const sample = args.has("--sample");
const idArg = [...args].find((arg) => arg.startsWith("--id="))?.slice("--id=".length) ?? "";
const onlyIds = new Set(
  idArg
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

if (sample) {
  const fonts = loadQuestionOgFonts(ROOT);
  const png = await renderQuestionOgPng(
    {
      publicId: "Ab3dE5fG7h",
      text: "If $x^2 - 5x + 6 = 0$, what is the sum of the roots?",
      subjectName: "Mathematics",
      year: 2024,
    },
    fonts,
  );
  mkdirSync(dirname(SAMPLE_PATH), { recursive: true });
  writeFileSync(SAMPLE_PATH, png);
  console.log(`Wrote ${SAMPLE_PATH} (${Math.round(png.length / 1024)} KB).`);
  process.exit(0);
}

if (local === remote) {
  console.error("Choose exactly one target: --local or --remote.");
  process.exit(1);
}
if (onlyIds.size > 0) {
  for (const id of onlyIds) {
    if (!isValidPublicId(id)) {
      console.error(`Invalid public id: ${id}`);
      process.exit(1);
    }
  }
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

/** Follow each current head backwards through its lineage. */
const lineageSql = `
  WITH RECURSIVE chain(public_id, id, supersedes_id, depth) AS (
    SELECT qpi.public_id, q.id, q.supersedes_id, 0
    FROM question_public_ids qpi
    JOIN questions q ON q.id = qpi.current_question_id
    WHERE qpi.share_enabled = 1
      AND qpi.seo_indexable = 1
      AND qpi.reveal_policy = 'public'
      AND qpi.rights_ok = 1
    UNION ALL
    SELECT c.public_id, q.id, q.supersedes_id, c.depth + 1
    FROM questions q
    JOIN chain c ON q.id = c.supersedes_id
  )
  SELECT c.public_id, c.depth, q.id, q.text, q.text_hi, q.explanation,
         q.explanation_hi, q.status, q.deleted_at, q.year,
         s.name AS subject_name, s.slug AS subject_slug
  FROM chain c
  JOIN questions q ON q.id = c.id
  JOIN subjects s ON s.id = q.subject_id
  ORDER BY c.public_id, c.depth`;

console.log(`Target: ${remote ? "REMOTE" : "local D1"}`);
const [lineageResult] = d1Json(lineageSql);
const rows = lineageResult?.results ?? [];
if (!Array.isArray(rows)) throw new Error("Unexpected D1 result shape for the OG query.");

const lineages = new Map();
for (const row of rows) {
  if (onlyIds.size > 0 && !onlyIds.has(row.public_id)) continue;
  if (!lineages.has(row.public_id)) lineages.set(row.public_id, []);
  lineages.get(row.public_id).push(row);
}

const publishedByLineage = new Map();
const lineageIds = [];
for (const [publicId, lineage] of lineages) {
  lineage.sort((a, b) => Number(a.depth) - Number(b.depth));
  // A deleted head makes the public page 404 even if an older revision exists.
  if (lineage[0]?.deleted_at) continue;
  const published = lineage.find(
    (row) => row.status === "published" && !row.deleted_at,
  );
  if (!published) continue;
  if (!String(published.explanation ?? "").trim()) continue;
  const subjectName = String(published.subject_name ?? "").trim();
  if (!subjectName) continue;
  publishedByLineage.set(publicId, {
    publicId,
    text: String(published.text ?? ""),
    subjectName,
    year: published.year === null ? null : Number(published.year),
  });
  for (const row of lineage) lineageIds.push(Number(row.id));
}

/** Question ids that sit in a currently published mock are not indexable. */
const publishedMockIds = new Set();
for (let index = 0; index < lineageIds.length; index += 500) {
  const chunk = lineageIds.slice(index, index + 500);
  if (chunk.length === 0) continue;
  const [result] = d1Json(`
    SELECT DISTINCT mq.question_id
    FROM mock_questions mq
    JOIN mock_test_versions v ON v.id = mq.version_id
    JOIN mock_tests m ON m.id = v.mock_id AND m.current_version_id = v.id
    WHERE mq.question_id IN (${chunk.join(", ")})
      AND m.status = 'published'
      AND m.deleted_at IS NULL`);
  for (const row of result?.results ?? []) publishedMockIds.add(Number(row.question_id));
}

const eligible = [...publishedByLineage.values()].filter((question) => {
  const lineage = lineages.get(question.publicId) ?? [];
  return !lineage.some((row) => publishedMockIds.has(Number(row.id)));
});

console.log(
  `Read ${rows.length} lineage row(s); ${eligible.length} question(s) eligible for a per-question image.`,
);

if (eligible.length === 0) {
  console.log("No indexable questions; nothing to generate.");
  process.exit(0);
}

const fonts = loadQuestionOgFonts(ROOT);
mkdirSync(OUT_DIR, { recursive: true });
let written = 0;
for (const question of eligible) {
  const png = await renderQuestionOgPng(question, fonts);
  writeFileSync(join(OUT_DIR, `${question.publicId}.png`), png);
  written += 1;
  console.log(`  ${question.publicId}.png (${Math.round(png.length / 1024)} KB)`);
}
console.log(`\nWrote ${written} image(s) to ${OUT_DIR}.`);
