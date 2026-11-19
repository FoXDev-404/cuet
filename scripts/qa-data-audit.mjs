#!/usr/bin/env node
/**
 * A4 data-integrity audit (local D1 only).
 *
 * Reads every paper, ranked set and question from the **local** D1 database and
 * writes two artifacts:
 *   test-artifacts/data-audit.csv        one row per finding
 *   test-artifacts/data-audit-summary.md per-check and per-subject tallies
 *
 * This script performs only SELECTs against the local D1 (`--local`). It never
 * runs against --remote/Turso and never writes to any database.
 *
 * Usage: node scripts/qa-data-audit.mjs
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WRANGLER_BIN = join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
const OUT_DIR = join(ROOT, "test-artifacts");

function d1All(sql) {
  const output = execFileSync(
    process.execPath,
    [WRANGLER_BIN, "d1", "execute", "cuet-blueprint-db", "--local", "--json", "--command", sql],
    { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 },
  );
  const start = output.indexOf("[");
  if (start === -1) {
    throw new Error(`D1 command produced no JSON for: ${sql.slice(0, 120)}`);
  }
  const parsed = JSON.parse(output.slice(start));
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!first?.success) {
    throw new Error(`D1 command failed for: ${sql.slice(0, 120)}`);
  }
  return first.results ?? [];
}

function normalizeStem(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\$\$?|\\[a-z]+\s*(\{[^}]*\})?/gi, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashOf(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex").slice(0, 16);
}

function parseJson(value, fallback = null) {
  try {
    return JSON.parse(String(value ?? ""));
  } catch {
    return fallback;
  }
}

const findings = [];
function issue(check, scope, subject, identifier, detail, severity = "P2") {
  findings.push({ check, scope, subject, identifier, detail, severity });
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function groupBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

console.log("Querying local D1 (read-only)...");

const subjects = new Map(
  d1All("SELECT id, slug, name FROM subjects").map((row) => [row.id, row]),
);
const subjectSlug = (id) => subjects.get(id)?.slug ?? `subject-${id}`;

// ---------------------------------------------------------------- papers
const papers = d1All(
  `SELECT id, slug, title, subject_id, year, language, is_archived,
          duration_locked, duration_min, source_question_count, replaced_by
   FROM practice_papers`,
);
const paperQuestionCounts = new Map(
  d1All("SELECT paper_slug, COUNT(*) AS cnt FROM practice_questions WHERE deleted_at IS NULL GROUP BY paper_slug")
    .map((row) => [row.paper_slug, Number(row.cnt)]),
);
const paperSlugs = new Set(papers.map((row) => row.slug));

for (const paper of papers) {
  const count = paperQuestionCounts.get(paper.slug) ?? 0;
  const locked = Number(paper.duration_locked) === 1;
  const subject = subjectSlug(paper.subject_id);
  if (Number(paper.is_archived) === 1) {
    if (!paper.replaced_by?.trim()) {
      issue("archived_replaced_by", "practice_paper", subject, paper.slug,
        `archived paper has an empty replaced_by target`, "P1");
    } else {
      const path = paper.replaced_by.trim();
      const segments = path.split("/").filter(Boolean);
      const CATEGORIES = new Set([
        "language-pyqs",
        "domain-subject-pyqs",
        "general-aptitude-test-pyqs",
      ]);
      const isSubjectHub =
        segments.length === 3 &&
        segments[0] === "cuet-ug-previous-year-question-papers" &&
        CATEGORIES.has(segments[1]);
      const tail = segments[segments.length - 1];
      if (!isSubjectHub && tail) {
        const target = papers.find((row) => row.slug === tail);
        if (!target) {
          issue("archived_replaced_by", "practice_paper", subject, paper.slug,
            `replaced_by points at unknown paper slug in ${path}`, "P1");
        } else if (Number(target.is_archived) === 1) {
          issue("archived_replaced_by", "practice_paper", subject, paper.slug,
            `replaced_by points at archived paper ${tail}`, "P1");
        } else if (Number(target.duration_locked) === 1) {
          const targetCount = paperQuestionCounts.get(tail) ?? 0;
          if (targetCount !== 50) {
            issue("archived_replaced_by", "practice_paper", subject, paper.slug,
              `replacement set ${tail} contains ${targetCount} questions`, "P1");
          }
        }
      }
    }
    continue;
  }
  if (locked && count !== 50) {
    issue("paper_question_count", "practice_paper", subject, paper.slug,
      `rebuilt 50-question set contains ${count} questions`, "P1");
  } else if (count === 0) {
    issue("paper_question_count", "practice_paper", subject, paper.slug,
      "published paper has zero questions", "P1");
  } else if (!locked && count < 50) {
    issue("paper_question_count", "practice_paper", subject, paper.slug,
      `${count} questions (official/unknown set, below the 50-question reference)`, "P2");
  }
  // NOTE: source_question_count records the original paper's pool size, which
  // is intentionally larger than the rebuilt set's playable count. It is not a
  // defect and is reported nowhere.
}

// ---------------------------------------------------- practice questions
console.log("Validating practice questions...");
const practiceQuestions = d1All(
  `SELECT id, paper_slug, question_key, stem, options_json, correct_option, explanation,
          passage_key, source_year, source_date, source_shift, options_are_images, assets_json
   FROM practice_questions WHERE deleted_at IS NULL`,
);

for (const q of practiceQuestions) {
  const paper = papers.find((row) => row.slug === q.paper_slug);
  const subject = paper ? subjectSlug(paper.subject_id) : "unknown";
  const options = parseJson(q.options_json);
  if (!Array.isArray(options)) {
    issue("options_json", "practice_question", subject, `${q.paper_slug}/${q.question_key}`,
      "options_json is not a JSON array", "P1");
    continue;
  }
  if (options.length !== 4) {
    issue("option_count", "practice_question", subject, `${q.paper_slug}/${q.question_key}`,
      `${options.length} options`, "P2");
  }
  const optionsAreImages = Number(q.options_are_images) === 1;
  const texts = options.map((opt) => String(opt?.text ?? "").trim().toLowerCase());
  const imageOnly = options.map((opt) => Boolean(opt?.image_url ?? opt?.image ?? opt?.imageAsset));
  if (!optionsAreImages) {
    for (let i = 0; i < texts.length; i += 1) {
      if (!texts[i] && !imageOnly[i]) {
        issue("empty_option", "practice_question", subject, `${q.paper_slug}/${q.question_key}`,
          `option ${optId(i)} has neither text nor an image`, "P1");
      }
    }
  }
  if (!optionsAreImages) {
    const seen = new Map();
    for (const text of texts) {
      if (!text) continue;
      seen.set(text, (seen.get(text) ?? 0) + 1);
    }
    for (const [text, count] of seen) {
      if (count > 1) {
        issue("duplicate_option", "practice_question", subject, `${q.paper_slug}/${q.question_key}`,
          `duplicate option text "${text.slice(0, 60)}" (x${count})`, "P2");
      }
    }
  }
  const correct = String(q.correct_option ?? "").trim().toUpperCase();
  const ids = options.map((opt) => String(opt?.id ?? "").trim().toUpperCase());
  if (!ids.includes(correct)) {
    issue("correct_option", "practice_question", subject, `${q.paper_slug}/${q.question_key}`,
      `correct_option "${correct}" does not match any option id`, "P1");
  }
  if (!String(q.explanation ?? "").trim()) {
    issue("missing_explanation", "practice_question", subject, `${q.paper_slug}/${q.question_key}`,
      "empty explanation", "P2");
  }
}

function optId(index) {
  return String.fromCharCode(65 + index);
}

function signatureOf(stem, optionsValue, assetsValue, passageValue) {
  const optionText = Array.isArray(optionsValue)
    ? optionsValue.map((opt) => String(opt?.text ?? "")).join(" ")
    : String(optionsValue ?? "");
  // Table/figure assets distinguish match-list questions whose stem and
  // generic "(A)-..." options are identical across different tables.
  const assets = parseJson(assetsValue);
  const assetText = Array.isArray(assets)
    ? assets.map((asset) => String(asset?.path ?? asset?.url ?? asset?.id ?? "")).join(" ")
    : String(assetsValue ?? "");
  // Passage linkage distinguishes list items that share a boilerplate stem
  // ("4. tertiary") but belong to different passages.
  const passageText = passageValue == null ? "" : String(passageValue);
  return hashOf(
    `${normalizeStem(String(stem ?? ""))}|${normalizeStem(optionText).slice(0, 300)}|${assetText}|${passageText}`,
  );
}

// exact + near duplicates within a paper (text alone is not enough — match-list
// questions share a boilerplate stem, so the option payload is part of the key)
const byPaper = groupBy(practiceQuestions, (row) => row.paper_slug);
for (const [slug, rows] of byPaper) {
  const paper = papers.find((row) => row.slug === slug);
  const subject = paper ? subjectSlug(paper.subject_id) : "unknown";
  const exact = groupBy(rows, (row) => signatureOf(row.stem, row.options_json, row.assets_json, row.passage_key));
  for (const [hash, group] of exact) {
    if (group.length > 1) {
      issue("duplicate_within_paper", "practice_question", subject, slug,
        `exact duplicate (text+options+assets) x${group.length} (questions ${group.map((row) => row.question_key).join(", ")})`, "P1");
    }
  }
  const prefix = groupBy(rows, (row) => {
    const stemPrefix = normalizeStem(String(row.stem)).slice(0, 80);
    const optionsKey = signatureOf("", row.options_json, row.assets_json, row.passage_key).slice(0, 10);
    return `${stemPrefix}|${optionsKey}`;
  });
  for (const [hash, group] of prefix) {
    if (group.length > 1) {
      issue("near_duplicate_within_paper", "practice_question", subject, slug,
        `near-duplicate opening x${group.length} (questions ${group.map((row) => row.question_key).join(", ")})`, "P2");
    }
  }
}

// cross-paper exact duplicates (PYQs are expected to repeat across years)
const exactBySubject = groupBy(
  practiceQuestions.map((row) => {
    const paper = papers.find((p) => p.slug === row.paper_slug);
    return { ...row, subject: paper ? subjectSlug(paper.subject_id) : "unknown" };
  }),
  (row) => `${row.subject}|${signatureOf(row.stem, row.options_json, row.assets_json, row.passage_key)}`,
);
for (const [key, group] of exactBySubject) {
  if (group.length > 1) {
    const papersInGroup = new Set(group.map((row) => row.paper_slug));
    if (papersInGroup.size > 1) {
      const subject = key.split("|")[0];
      issue("duplicate_across_papers", "practice_question", subject,
        [...papersInGroup].slice(0, 6).join(","),
        `same question appears in ${papersInGroup.size} papers (x${group.length} copies)`, "P3");
    }
  }
}

// passage linkage (practice)
console.log("Validating passages...");
const practicePassageKeys = new Set(
  d1All("SELECT passage_key FROM practice_passages WHERE deleted_at IS NULL")
    .map((row) => row.passage_key),
);
const orphanedPractice = practiceQuestions.filter(
  (row) => row.passage_key && row.passage_key.trim() && !practicePassageKeys.has(row.passage_key),
);
for (const row of orphanedPractice) {
  const paper = papers.find((p) => p.slug === row.paper_slug);
  issue("passage_orphan", "practice_question", paper ? subjectSlug(paper.subject_id) : "unknown",
    `${row.paper_slug}/${row.question_key}`, `passage_key "${row.passage_key}" has no passage row`, "P1");
}
const emptyPassages = d1All(
  "SELECT id, passage_key FROM practice_passages WHERE deleted_at IS NULL AND TRIM(COALESCE(body,'')) = ''",
);
for (const row of emptyPassages) {
  issue("empty_passage", "practice_passage", "unknown", String(row.id), `empty passage body (${row.passage_key})`, "P2");
}

// ranked-question passages
const passageIds = new Set(
  d1All("SELECT id FROM passages WHERE deleted_at IS NULL").map((row) => Number(row.id)),
);
const rankedPassageOrphans = d1All(
  "SELECT id FROM questions WHERE deleted_at IS NULL AND passage_id IS NOT NULL AND passage_id NOT IN (SELECT id FROM passages WHERE deleted_at IS NULL)",
);
for (const row of rankedPassageOrphans) {
  issue("passage_orphan", "ranked_question", "unknown", String(row.id), "passage_id references a missing passage", "P1");
}

// ------------------------------------------------------- ranked questions
console.log("Validating ranked questions...");
const rankedQuestions = d1All(
  `SELECT q.id, q.subject_id, q.text, q.options, q.correct_option, q.explanation,
          q.source_year, q.source_paper_id, q.source_set_slug, q.passage_id, q.source_key,
          q.assets_json
   FROM questions q WHERE deleted_at IS NULL`,
);

const translationRe = /[ऀ-ॿ]/;

for (const q of rankedQuestions) {
  const subject = subjectSlug(q.subject_id);
  const options = parseJson(q.options);
  if (!Array.isArray(options)) {
    issue("options_json", "ranked_question", subject, String(q.id), "options is not a JSON array", "P1");
    continue;
  }
  if (options.length !== 4) {
    issue("option_count", "ranked_question", subject, String(q.id), `${options.length} options`, "P2");
  }
  const optionsAreImages = false; // ranked options carry explicit image_url per option when blank
  const texts = options.map((opt) => String(opt?.text ?? "").trim().toLowerCase());
  for (let i = 0; i < texts.length; i += 1) {
    const hasImage = Boolean(opt_image(options[i]));
    if (!texts[i] && !hasImage) {
      issue("empty_option", "ranked_question", subject, String(q.id), `option ${i} has neither text nor an image`, "P1");
    }
  }
  const seenTexts = new Map();
  for (const text of texts) {
    if (!text) continue;
    seenTexts.set(text, (seenTexts.get(text) ?? 0) + 1);
  }
  if ([...seenTexts.values()].some((count) => count > 1)) {
    issue("duplicate_option", "ranked_question", subject, String(q.id), "duplicate option text", "P2");
  }
  const correctIndex = Number(q.correct_option);
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
    issue("correct_option", "ranked_question", subject, String(q.id),
      `correct_option "${q.correct_option}" is out of range`, "P1");
  }
  if (!String(q.explanation ?? "").trim()) {
    issue("missing_explanation", "ranked_question", subject, String(q.id), "empty explanation", "P2");
  }
  if (translationRe.test(String(q.text ?? "")) && subject !== "hindi") {
    issue("mixed_script", "ranked_question", subject, String(q.id), "Devanagari characters in a non-Hindi question", "P3");
  }
  if (!q.source_set_slug) {
    issue("source_tag", "ranked_question", subject, String(q.id), "no source_set_slug (legacy seed question)", "P3");
  } else if (q.source_year == null || q.source_paper_id == null) {
    issue("source_tag", "ranked_question", subject, String(q.id), "source_set_slug set but year/paper tag missing", "P2");
  }
}

function opt_image(option) {
  return option?.image_url ?? option?.image ?? option?.imageAsset ?? null;
}

const wrongSubject = d1All(
  `SELECT COUNT(*) AS cnt FROM questions q
   JOIN practice_papers p ON p.id = q.source_paper_id
   WHERE q.deleted_at IS NULL AND q.source_paper_id IS NOT NULL
     AND q.subject_id != p.subject_id`,
)[0]?.cnt;
if (Number(wrongSubject) > 0) {
  issue("wrong_subject", "ranked_question", "unknown", "aggregate",
    `${wrongSubject} ranked questions disagree with their source paper's subject`, "P1");
}

// ranked duplicates within a set (same set slug)
const rankedBySet = groupBy(
  rankedQuestions.filter((row) => row.source_set_slug),
  (row) => row.source_set_slug,
);
for (const [setSlug, rows] of rankedBySet) {
  const exact = groupBy(rows, (row) => signatureOf(row.text, row.options, row.assets_json, row.passage_id));
  for (const group of exact.values()) {
    if (group.length > 1) {
      issue("duplicate_within_set", "ranked_question", "unknown", setSlug,
        `exact duplicate (text+options) x${group.length} (ids ${group.map((row) => row.id).join(", ")})`, "P1");
    }
  }
}

// ------------------------------------------------------------ mock tests
console.log("Validating mock versions...");
const redirectedSlugs = new Set(
  d1All("SELECT DISTINCT old_slug FROM slug_redirects").map((row) => row.old_slug),
);
const versions = d1All(
  `SELECT v.id, v.mock_id, v.version_no, v.duration_min, v.total_marks, v.status,
          m.title, m.slug,
          (SELECT COUNT(*) FROM mock_questions mq WHERE mq.version_id = v.id) AS qcount
   FROM mock_test_versions v JOIN mock_tests m ON m.id = v.mock_id`,
);
for (const v of versions) {
  const fixture = /e2e|fixture/i.test(`${v.title} ${v.slug}`);
  const redirectStub = redirectedSlugs.has(v.slug);
  const qcount = Number(v.qcount);
  if (redirectStub) continue; // archived URL kept 301 -> replacement set; content no longer renderable
  if (v.status === "published" && !fixture && qcount === 0) {
    issue("version_question_count", "mock_version", "unknown", `${v.slug} v${v.version_no}`,
      "published version has zero questions", "P1");
  } else if (v.status === "published" && !fixture && qcount !== 50) {
    issue("version_question_count", "mock_version", "unknown", `${v.slug} v${v.version_no}`,
      `${qcount} questions (expected 50)`, "P2");
  }
}

// duplicate slugs
for (const table of ["practice_papers", "mock_tests"]) {
  const rows = d1All(
    `SELECT slug, COUNT(*) AS cnt FROM ${table} WHERE deleted_at IS NULL GROUP BY slug HAVING cnt > 1`,
  );
  for (const row of rows) {
    issue("duplicate_slug", table, "unknown", row.slug, `slug shared by ${row.cnt} rows`, "P1");
  }
}

// mocks whose questions reference missing ranked questions
const danglingMockQuestions = d1All(
  `SELECT COUNT(*) AS cnt FROM mock_questions mq
   LEFT JOIN questions q ON q.id = mq.question_id
   WHERE q.id IS NULL`,
)[0]?.cnt;
if (Number(danglingMockQuestions) > 0) {
  issue("dangling_mock_question", "mock_questions", "unknown", "aggregate",
    `${danglingMockQuestions} mock_questions rows reference missing questions`, "P1");
}

// duplicate positions inside a version
const dupPositions = d1All(
  `SELECT version_id, COUNT(*) AS cnt FROM mock_questions GROUP BY version_id, position HAVING cnt > 1`,
);
for (const row of dupPositions) {
  issue("duplicate_position", "mock_questions", "unknown", String(row.version_id),
    "version has two questions on the same position", "P1");
}

// ------------------------------------------------------------- summarize
const byCheck = groupBy(findings, (row) => row.check);
const summaryLines = [];
summaryLines.push("# Data integrity audit — local D1");
summaryLines.push("");
summaryLines.push(`Run: ${new Date().toISOString()}`);
summaryLines.push("");
summaryLines.push("| Check | Rows | Severity |");
summaryLines.push("| --- | --- | --- |");
const severityOf = (rows) => rows.some((row) => row.severity === "P1") ? "P1" : rows.some((row) => row.severity === "P2") ? "P2" : "P3";
for (const [check, rows] of [...byCheck.entries()].sort()) {
  summaryLines.push(`| ${check} | ${rows.length} | ${severityOf(rows)} |`);
}
summaryLines.push("");
summaryLines.push("## Practice papers per subject");
summaryLines.push("");
summaryLines.push("| Subject | Papers | Archived | Locked (60 min) | Total practice questions | Empty explanations |");
summaryLines.push("| --- | --- | --- | --- | --- | --- |");
const practiceBySubject = groupBy(papers, (row) => subjectSlug(row.subject_id));
for (const [subject, subjectPapers] of [...practiceBySubject.entries()].sort()) {
  const slugs = new Set(subjectPapers.map((row) => row.slug));
  const questions = practiceQuestions.filter((row) => slugs.has(row.paper_slug));
  const emptyExplanations = questions.filter((row) => !String(row.explanation ?? "").trim()).length;
  summaryLines.push(
    `| ${subject} | ${subjectPapers.length} | ${subjectPapers.filter((row) => Number(row.is_archived) === 1).length} | ${subjectPapers.filter((row) => Number(row.duration_locked) === 1).length} | ${questions.length} | ${emptyExplanations} |`,
  );
}
summaryLines.push("");
summaryLines.push("## Ranked questions per subject");
summaryLines.push("");
summaryLines.push("| Subject | Questions | Empty explanations |");
summaryLines.push("| --- | --- | --- |");
const rankedBySubject = groupBy(rankedQuestions, (row) => subjectSlug(row.subject_id));
for (const [subject, rows] of [...rankedBySubject.entries()].sort()) {
  summaryLines.push(`| ${subject} | ${rows.length} | ${rows.filter((row) => !String(row.explanation ?? "").trim()).length} |`);
}
summaryLines.push("");
summaryLines.push("## Notes & limitations");
summaryLines.push("");
summaryLines.push("- Cross-paper exact duplicates of PYQs are expected (the same paper reappears across years); they are reported as P3 information.");
summaryLines.push("- Near-duplicates use a normalized 80-character stem prefix; full fuzzy matching was not run at 13k-row scale.");
summaryLines.push("- Mixed Devanagari in non-Hindi questions is a heuristic hint, not proof of a mis-tag.");
summaryLines.push("- Explanation gaps are P2 data debt (content), not functional defects.");
summaryLines.push("- Sources: local D1 only (`wrangler d1 execute --local --json`). Production Turso was not queried.");

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  join(OUT_DIR, "data-audit.csv"),
  [
    "check,scope,subject,identifier,detail,severity",
    ...findings.map((row) =>
      [row.check, row.scope, row.subject, row.identifier, row.detail, row.severity]
        .map(csvEscape)
        .join(","),
    ),
  ].join("\n") + "\n",
);
writeFileSync(join(OUT_DIR, "data-audit-summary.md"), summaryLines.join("\n") + "\n");
console.log(`Findings: ${findings.length}`);
console.log(`Wrote ${join(OUT_DIR, "data-audit.csv")} and ${join(OUT_DIR, "data-audit-summary.md")}`);
