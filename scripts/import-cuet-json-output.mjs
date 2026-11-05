#!/usr/bin/env node
/**
 * Convert the PaddleOCR-VL "CUET_JSON_OUTPUT" dataset into the refined
 * previous-year practice library used by the mock engine.
 *
 * Usage:
 *   node scripts/import-cuet-json-output.mjs --dataset /path/to/CUET_JSON_OUTPUT
 *   node scripts/import-cuet-json-output.mjs --dataset ... --dry-run
 *   node scripts/import-cuet-json-output.mjs --dataset ... --only psychology-2024-07-19-shift-1
 *
 * What it does
 *   - Reads papers/*.normalized.json from the OCR bundle.
 *   - Keeps only questions with a printed, option-valid answer and playable
 *     text/options. Unkeyed questions are counted and reported, never imported:
 *     the ranked engine cannot award marks without an authoritative key.
 *   - Writes public/local-papers/papers/<slug>.json (no answer key inside),
 *     merges answers/explanations into src/data/local-papers/keys.json and
 *     appends summaries to src/data/local-papers/index.json.
 *   - Copies only question-linked, non-decorative image assets into
 *     public/local-papers/assets/<slug>/ and rewrites their paths.
 *   - Never overwrites an existing library paper. The existing 214-paper
 *     library stays the source of truth for its own slugs.
 *
 * The bundle itself (papers, raw OCR, full asset set) is archival input and is
 * not committed; commit the generated refined library instead.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX_FILE = join(ROOT, "src", "data", "local-papers", "index.json");
const KEYS_FILE = join(ROOT, "src", "data", "local-papers", "keys.json");
const PAPERS_DIR = join(ROOT, "public", "local-papers", "papers");
const ASSETS_DIR = join(ROOT, "public", "local-papers", "assets");
const REPORT_FILE = join(ROOT, "docs", "dataset-import-report.json");
const REPORT_MD = join(ROOT, "docs", "DATASET_IMPORT_2026-11-06.md");

const SOURCE_METHOD =
  "PaddleOCR-VL 1.6 text and layout export; exact printed-page crops for diagrams and tables.";
const MIN_SCORABLE = 2;

/**
 * A printed key is necessary but not sufficient. These OCR flags mean the
 * question itself is structurally broken (missing options, unresolved option
 * references, unreadable text) or the answer is provably inconsistent.
 * Explanations are not imported by default: the OCR bundle's explanations are
 * model-generated prose, not printed source text, and they showed cross-question
 * contamination in spot checks. Use --with-explanations only after review.
 */
const BLOCKING_FLAGS = new Set([
  "answer_not_in_options",
  "empty_option_text",
  "empty_question_text",
  "markdown_mismatch",
  "missing_options",
  "possible_ocr_garbage",
  "too_few_options",
  "unreferenced_numbered_items",
  "unresolved_option_ref",
]);


const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const dryRun = flag("--dry-run");
const withExplanations = flag("--with-explanations");
const datasetDir = resolve(value("--dataset") ?? process.env.CUET_DATASET_DIR ?? join(ROOT, "tools", "ocr", "CUET_JSON_OUTPUT"));
const only = value("--only") ? new Set([value("--only")]) : null;

const { calculateMockDuration } = await import(
  pathToFileURL(join(ROOT, "src", "lib", "exam-timing.ts")).href
);

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  if (dryRun) return;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function hashFile(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function displayDate(date) {
  if (!date) return "";
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day || month < 1 || month > 12) return date;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function parseDate(text) {
  const match = String(text ?? "").match(/(20\d{2})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function normalizeShift(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const match = raw.match(/(\d+)/);
  return match ? `Shift ${match[1]}` : raw.replace(/^shift\s*:?\s*/i, "Shift ");
}

function cleanText(value) {
  return typeof value === "string" ? value.replace(/\r/g, "").trim() : "";
}

function collapseBlankLines(text) {
  return text.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}

function dedupeConsecutiveLines(text) {
  const lines = text.split("\n");
  const output = [];
  let previous = "";
  for (const line of lines) {
    const key = line.replace(/\s+/g, " ").trim().toLowerCase();
    if (key && key === previous) continue;
    output.push(line);
    if (key) previous = key;
  }
  return output.join("\n");
}

function stripBrokenImages(html) {
  return html
    .replace(/<div[^>]*>\s*<img[^>]*src=["']imgs\/[^"']*["'][^>]*>\s*<\/div>/gi, "")
    .replace(/<img[^>]*src=["']imgs\/[^"']*["'][^>]*>/gi, "");
}

function cleanTableHtml(html) {
  return stripBrokenImages(String(html ?? ""))
    .replace(/<!--\s*PAGE\s*\d+\s*-->/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .trim();
}

/**
 * PaddleOCR often repeats a paragraph twice (page overlap) and appends the
 * source question id. Remove both without touching legitimate repeated labels.
 */
function cleanQuestionText(raw) {
  let text = stripBrokenImages(cleanText(raw));
  text = text.replace(/<!--\s*PAGE\s*\d+\s*-->/gi, "");
  text = text.replace(/\n+\s*Question Id\s*:\s*\d+[\s\S]{0,300}$/i, "");
  text = text.replace(/\n+\s*\d{10,}\.\d+\s*$/g, "");
  text = dedupeConsecutiveLines(text);
  return collapseBlankLines(text);
}

function cleanExplanation(raw) {
  let text = stripBrokenImages(cleanText(raw));
  text = text.replace(/<!--\s*PAGE\s*\d+\s*-->/gi, "");
  text = text.replace(/\n+\s*Question Id\s*:\s*\d+[\s\S]{0,300}$/i, "");
  text = dedupeConsecutiveLines(text);
  text = collapseBlankLines(text);
  if (!text) return null;
  if (/^(not available|no explanation|n\/a)\.?$/i.test(text)) return null;
  return text;
}

function normalizeOptionText(value) {
  return collapseBlankLines(cleanText(value).replace(/[ \t]+/g, " "));
}

function stemWithTables(question) {
  const tables = (question.tables ?? [])
    .map((table) => cleanTableHtml(table?.html))
    .filter(Boolean);
  let text = cleanQuestionText(question.questionText);
  let tableIndex = 0;
  text = text.replace(/\[TABLE\]/gi, () => {
    const next = tables[tableIndex];
    tableIndex += 1;
    return next ? `\n\n${next}\n\n` : "";
  });
  if (tableIndex < tables.length) {
    text += `\n\n${tables.slice(tableIndex).join("\n\n")}`;
  }
  return collapseBlankLines(text);
}

/**
 * PaddleOCR sometimes repeats the option list inside questionText as well as
 * emitting structured options. Cutting the trailing duplicate keeps the stem
 * readable and prevents the rendered card from showing the same choices twice.
 */
function stripTrailingOptions(stem, options) {
  if (options.length < 2 || options.some((option) => option.text.length <= 8)) return stem;
  const lower = stem.toLowerCase();
  const positions = options.map((option) => lower.lastIndexOf(option.text.toLowerCase()));
  if (positions.some((position) => position < 0)) return stem;
  const first = Math.min(...positions);
  if (first < lower.length * 0.25) return stem;

  let cut = stem.lastIndexOf("\n", first);
  cut = cut >= 0 ? cut + 1 : first;
  // Prefer starting at the printed option label (A. / (A) / A)) when it sits
  // immediately before the option text.
  const before = stem.slice(Math.max(0, first - 12), first);
  const label = before.match(/(?:^|\s)(?:\(?[A-D]\)?[.)]\s*)$/);
  if (label) cut = Math.max(0, first - label[0].length);

  const tail = stem.slice(cut).toLowerCase();
  let cursor = 0;
  for (const option of options) {
    const at = tail.indexOf(option.text.toLowerCase(), cursor);
    if (at < 0) return stem;
    cursor = at + option.text.length;
  }
  const candidate = stem.slice(0, cut).trimEnd();
  return candidate.length >= 20 ? collapseBlankLines(candidate) : stem;
}

function normalizeAnswerKey(question, optionKeys) {
  const raw = cleanText(question.correctAnswer).toUpperCase();
  if (!raw) return null;
  const letters = raw.match(/[A-F]/g);
  if (!letters) return null;
  for (const letter of letters) {
    if (optionKeys.has(letter)) return letter;
  }
  return null;
}

function isDecorative(asset) {
  const flags = asset?.reviewFlags ?? [];
  if (flags.some((flag) => /header_image|footer_image|decorative/i.test(String(flag)))) return true;
  return false;
}

function assetKind(asset) {
  const source = String(asset?.sourceType ?? "").toLowerCase();
  const type = String(asset?.type ?? "").toLowerCase();
  if (source === "option_crop" || type === "option") return "options";
  if (source === "figure_crop" || type === "figure") return "figure";
  if (type === "table") return "table";
  return "image";
}

const SUBJECT_CODES = {
  accountancy: "ACC",
  agriculture: "AGR",
  anthropology: "ANT",
  "applied-mathematics": "APM",
  biology: "BIO",
  "business-studies": "BST",
  chemistry: "CHE",
  "computer-science": "CS",
  cucet: "CUCET",
  economics: "ECO",
  "engineering-graphics": "ENG",
  english: "ENG",
  entrepreneurship: "ENT",
  "environmental-science": "EVS",
  "fine-arts": "FA",
  "general-test": "GT",
  geography: "GEO",
  hindi: "HIN",
  history: "HIS",
  "home-science": "HSC",
  "knowledge-tradition-and-practices-india": "KTPI",
  "legal-studies": "LEG",
  "mass-media": "MM",
  mathematics: "MAT",
  "performing-arts": "PA",
  "physical-education": "PE",
  physics: "PHY",
  "political-science": "POL",
  "political-science-and-sociology": "PSS",
  psychology: "PSY",
  sociology: "SOC",
};

function subjectCode(slug, name) {
  if (SUBJECT_CODES[slug]) return SUBJECT_CODES[slug];
  const initials = name
    .split(/\s+/)
    .filter((word) => !/^(and|of|the|&)$/i.test(word))
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return (initials || slug.slice(0, 3)).slice(0, 5);
}

const existingIndex = readJson(INDEX_FILE);
const existingPapers = new Map((existingIndex.papers ?? []).map((paper) => [paper.slug, paper]));
const keyBundle = readJson(KEYS_FILE);
const keyPapers = keyBundle.papers ?? {};
const existingSubjects = new Map();
for (const paper of existingIndex.papers ?? []) {
  if (paper.subject?.slug) existingSubjects.set(paper.subject.slug, paper.subject);
}

const hashToPublicPath = new Map();
function indexExistingAssets(dir = ASSETS_DIR) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      indexExistingAssets(full);
      continue;
    }
    if (!/\.(?:png|jpe?g|webp|gif)$/i.test(entry)) continue;
    try {
      hashToPublicPath.set(hashFile(full), `/local-papers/assets/${full.slice(ASSETS_DIR.length + 1).split("\\").join("/")}`);
    } catch {
      // Unreadable existing asset: leave it out of the dedupe index.
    }
  }
}
indexExistingAssets();

const paperDir = join(datasetDir, "papers");
if (!existsSync(paperDir)) {
  console.error(`Dataset papers directory not found: ${paperDir}`);
  process.exit(1);
}
const report = {
  generatedAt: new Date().toISOString(),
  dataset: datasetDir,
  policy: {
    minScorable: MIN_SCORABLE,
    scorableOnly: true,
    overlapsSkipped: true,
  },
  totals: {
    questionsInBundle: 0,
    papersScanned: 0,
    papersAdded: 0,
    papersSkipped: 0,
    papersOverlapping: 0,
    questionsScanned: 0,
    questionsAdded: 0,
    questionsSkippedUnkeyed: 0,
    questionsSkippedInvalid: 0,
    duplicateQuestions: 0,
    explanationsImported: 0,
    assetsCopied: 0,
    assetBytes: 0,
    assetsDeduped: 0,
    assetsMissing: 0,
  },
  added: [],
  skipped: [],
  overlapping: [],
};

try {
  const manifest = readJson(join(datasetDir, "manifest.json"));
  report.totals.questionsInBundle = Number(manifest?.statistics?.totalQuestions) || 0;
} catch {
  report.totals.questionsInBundle = 0;
}

const seenStems = new Map();
const generatedPapers = [];
const generatedKeys = {};
const generatedSummaries = [];
const generatedAssetPaths = new Set();

function copyAsset(asset, paperSlug, paperDirName) {
  const storagePath = String(asset?.storagePath ?? "");
  if (!storagePath) return null;
  const source = join(datasetDir, storagePath);
  if (!existsSync(source)) {
    report.totals.assetsMissing += 1;
    return null;
  }
  const bufferHash = hashFile(source);
  const existingPath = hashToPublicPath.get(bufferHash);
  if (existingPath) {
    report.totals.assetsDeduped += 1;
    return existingPath;
  }
  const sourceName = basename(storagePath);
  const destDir = join(ASSETS_DIR, paperSlug);
  let destName = sourceName;
  let dest = join(destDir, destName);
  if (existsSync(dest)) {
    destName = `${String(asset.id ?? "asset").replace(/[^a-z0-9_-]+/gi, "-")}-${sourceName}`;
    dest = join(destDir, destName);
  }
  if (!dryRun) {
    mkdirSync(destDir, { recursive: true });
    copyFileSync(source, dest);
  }
  const publicPath = `/local-papers/assets/${paperSlug}/${destName}`;
  hashToPublicPath.set(bufferHash, publicPath);
  const bytes = statSync(source).size;
  report.totals.assetsCopied += 1;
  report.totals.assetBytes += bytes;
  generatedAssetPaths.add(publicPath);
  return publicPath;
}

const files = readdirSync(paperDir)
  .filter((name) => name.endsWith(".normalized.json"))
  .sort();

for (const file of files) {
  const datasetPaper = readJson(join(paperDir, file));
  const paperBase = file.replace(/\.normalized\.json$/, "");
  const paperSlug = slugify(paperBase);
  if (only && !only.has(paperSlug)) continue;
  report.totals.papersScanned += 1;

  const exam = datasetPaper.exam ?? {};
  const subjectName = cleanText(exam.subject) || "CUET";
  const subjectSlug = slugify(subjectName);
  const questions = Array.isArray(datasetPaper.questions) ? datasetPaper.questions : [];
  const answered = questions.filter((question) => Boolean(cleanText(question.correctAnswer)));

  const overlap = existingPapers.get(paperSlug);
  if (overlap) {
    report.totals.papersOverlapping += 1;
    report.overlapping.push({
      slug: paperSlug,
      title: overlap.title,
      datasetQuestions: questions.length,
      datasetAnswers: answered.length,
      libraryQuestions: overlap.questionCount ?? null,
      libraryScorable: overlap.scorableQuestionCount ?? null,
    });
    continue;
  }

  const date = cleanText(exam.date) || parseDate(paperBase);
  const year = Number(exam.year) || (date ? Number(date.slice(0, 4)) : null);
  const shift = normalizeShift(exam.shift);
  const dateLabel = displayDate(date) || (year ? String(year) : "");
  const examLabel = subjectSlug === "cucet" ? "CUCET UG" : "CUET UG";
  const title = `${examLabel} ${subjectName} ${dateLabel}${shift ? ` ${shift}` : ""} Previous Year Paper`.replace(/\s+/g, " ").trim();

  const assetsById = new Map((datasetPaper.assets ?? []).map((asset) => [String(asset.id), asset]));
  const optionsAreImages = false;
  const usedStems = new Set();
  const outputQuestions = [];
  const outputKeys = {};
  let skippedUnkeyed = 0;
  let skippedInvalid = 0;
  let duplicates = 0;
  let imageQuestionCount = 0;
  let assetCount = 0;
  let questionNumber = 0;

  const passages = new Map();
  for (const passage of datasetPaper.passages ?? []) {
    const id = cleanText(passage.id);
    const content = Array.isArray(passage.content) ? passage.content.map(cleanText).filter(Boolean).join("\n\n") : cleanText(passage.content);
    if (!id || !content) continue;
    passages.set(id, {
      id,
      title: cleanText(passage.title) || "Reading passage",
      contentEn: stripBrokenImages(content),
    });
  }

  for (const question of questions) {
    report.totals.questionsScanned += 1;
    if (!cleanText(question.correctAnswer)) {
      skippedUnkeyed += 1;
      continue;
    }
    const questionFlags = (question.reviewFlags ?? []).map((flag) => cleanText(flag)).filter(Boolean);
    if (questionFlags.some((flag) => BLOCKING_FLAGS.has(flag))) {
      skippedInvalid += 1;
      continue;
    }
    const rawOptions = Array.isArray(question.options) ? question.options : [];
    const options = [];
    const usedKeys = new Set();
    const seenOptionTexts = new Set();
    let duplicateOptionText = false;
    for (const [optionIndex, option] of rawOptions.entries()) {
      const keyMatch = cleanText(option.key).toUpperCase().match(/[A-F]/);
      const key = keyMatch?.[0] ?? String.fromCharCode(65 + optionIndex);
      if (usedKeys.has(key)) continue;
      usedKeys.add(key);
      const text = normalizeOptionText(option.text);
      if (!text) continue;
      const textKey = text.toLowerCase().replace(/\s+/g, " ");
      if (seenOptionTexts.has(textKey)) {
        duplicateOptionText = true;
        break;
      }
      seenOptionTexts.add(textKey);
      options.push({ id: key, text });
    }
    if (options.length < 2 || duplicateOptionText) {
      skippedInvalid += 1;
      continue;
    }
    const answer = normalizeAnswerKey(question, usedKeys);
    if (!answer) {
      skippedInvalid += 1;
      continue;
    }
    const stem = stripTrailingOptions(stemWithTables(question), options);
    if (!stem) {
      skippedInvalid += 1;
      continue;
    }
    const questionAssets = [];
    const seenAssets = new Set();
    for (const assetId of question.assetIds ?? []) {
      const asset = assetsById.get(String(assetId));
      if (!asset || isDecorative(asset)) continue;
      const publicPath = copyAsset(asset, paperSlug, paperBase);
      if (!publicPath) continue;
      if (seenAssets.has(publicPath)) continue;
      seenAssets.add(publicPath);
      questionAssets.push({
        id: String(asset.id ?? publicPath),
        kind: assetKind(asset),
        path: publicPath,
        page: Number(asset.sourcePage) || null,
        alt: cleanText(asset.caption) || cleanText(asset.description) || `${assetKind(asset)} for question ${question.questionNumber ?? outputQuestions.length + 1}`,
      });
    }
    if (questionFlags.includes("asset_requires_visual_review") && questionAssets.length === 0) {
      skippedInvalid += 1;
      continue;
    }

    const stemKey = createHash("sha1")
      .update(`${subjectSlug}:${stem.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`)
      .digest("hex");
    if (usedStems.has(stemKey)) {
      duplicates += 1;
      continue;
    }
    const crossPaperKey = `${subjectSlug}:${stemKey}`;
    if (seenStems.has(crossPaperKey)) {
      duplicates += 1;
      continue;
    }
    usedStems.add(stemKey);
    seenStems.set(crossPaperKey, paperSlug);

    if (questionAssets.length > 0) {
      imageQuestionCount += 1;
      assetCount += questionAssets.length;
    }

    questionNumber += 1;
    const qid = `q${String(questionNumber).padStart(2, "0")}`;
    const explanation = withExplanations ? cleanExplanation(question.explanation) : null;
    if (explanation) report.totals.explanationsImported += 1;
    const reviewFlags = [
      ...new Set([
        ...questionFlags,
        ...(explanation ? [] : ["missing_explanation"]),
      ]),
    ];
    outputQuestions.push({
      id: qid,
      sourceQuestionNo: Number(question.questionNumber) || questionNumber,
      stemEn: stem,
      optionsEn: options.map((option) => ({ id: option.id, text: option.text })),
      optionsAreImages,
      correctAnswer: null,
      explanationEn: null,
      passageId: cleanText(question.passageId) || null,
      reviewStatus: cleanText(question.textVerificationStatus) || cleanText(question.verificationStatus) || "needs_review",
      reviewFlags,
      sourcePages: Array.isArray(question.sourcePages) ? question.sourcePages : [],
      assets: questionAssets,
    });
    outputKeys[qid] = { a: answer, ...(explanation ? { e: explanation } : {}) };
  }

  const scorable = outputQuestions.length;
  if (scorable < MIN_SCORABLE) {
    report.totals.papersSkipped += 1;
    report.totals.questionsSkippedUnkeyed += skippedUnkeyed;
    report.totals.questionsSkippedInvalid += skippedInvalid;
    report.totals.duplicateQuestions += duplicates;
    report.skipped.push({
      slug: paperSlug,
      subject: subjectName,
      year,
      reason:
        scorable === 0
          ? answered.length === 0
            ? "no printed answers"
            : "no question passed validation"
          : `fewer than ${MIN_SCORABLE} scorable questions`,
      questions: questions.length,
      answers: answered.length,
      scorable,
    });
    continue;
  }

  const sourceQuestionCount = Number(exam.totalQuestions) || Math.max(...questions.map((question) => Number(question.questionNumber) || 0), scorable);
  const durationMinutes = calculateMockDuration(scorable, subjectName).durationMinutes;
  const metaDescription =
    `Practise the ${title} as a timed, ranked mock: ${scorable} questions, ${scorable} scored, ` +
    `+5/-1 marking and a post-submit review.`;

  const paperFile = {
    exam: {
      id: `local-${paperSlug}`,
      slug: paperSlug,
      title,
      subject: subjectName,
      subjectId: `local-${subjectSlug}`,
      subjectCode: subjectCode(subjectSlug, subjectName),
      year: year ?? 0,
      examDate: date,
      shift,
      sourceFile: /\.pdf$/i.test(String(exam.sourceFile ?? "")) ? String(exam.sourceFile) : `${exam.sourceFile ?? paperBase}.pdf`,
      sourceMethod: SOURCE_METHOD,
      questionCount: scorable,
      sourceQuestionCount,
      publicationStatus: "published",
      reviewRequired: true,
      passages: [...passages.values()],
      questions: outputQuestions,
    },
  };

  const subject =
    existingSubjects.get(subjectSlug) ?? {
      id: `local-${subjectSlug}`,
      name: subjectName,
      slug: subjectSlug,
      code: subjectCode(subjectSlug, subjectName),
    };

  const summary = {
    id: `local-${paperSlug}`,
    slug: paperSlug,
    title,
    metaDescription,
    subject,
    year: year ?? 0,
    date,
    dateLabel,
    shift,
    durationMinutes,
    sourceFile: paperFile.exam.sourceFile,
    sourceMethod: SOURCE_METHOD,
    questionCount: scorable,
    sourceQuestionCount,
    scorableQuestionCount: scorable,
    pendingReviewCount: 0,
    imageQuestionCount,
    assetCount,
    attemptCount: 0,
    publicationStatus: "published",
    reviewRequired: true,
  };

  generatedPapers.push({ slug: paperSlug, file: paperFile });
  generatedKeys[paperSlug] = outputKeys;
  generatedSummaries.push(summary);
  report.totals.papersAdded += 1;
  report.totals.questionsAdded += scorable;
  report.totals.questionsSkippedUnkeyed += skippedUnkeyed;
  report.totals.questionsSkippedInvalid += skippedInvalid;
  report.totals.duplicateQuestions += duplicates;
  report.added.push({
    slug: paperSlug,
    title,
    subject: subjectName,
    year,
    questions: scorable,
    sourceQuestions: sourceQuestionCount,
    unkeyedExcluded: skippedUnkeyed,
    invalidExcluded: skippedInvalid,
    duplicateExcluded: duplicates,
    imageQuestions: imageQuestionCount,
    assets: assetCount,
    durationMinutes,
  });
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------
if (!dryRun) {
  for (const { slug, file } of generatedPapers) {
    writeJson(join(PAPERS_DIR, `${slug}.json`), file);
  }
  const nextKeys = { ...keyBundle, papers: { ...keyPapers, ...generatedKeys } };
  writeJson(KEYS_FILE, nextKeys);
  const nextIndex = {
    ...existingIndex,
    papers: [...(existingIndex.papers ?? []), ...generatedSummaries],
  };
  writeJson(INDEX_FILE, nextIndex);
  writeJson(REPORT_FILE, report);

  const addedRows = report.added
    .map(
      (row) =>
        `| ${row.subject} | [${row.slug}](/mock-tests/${row.slug}) | ${row.year ?? ""} | ${row.questions} | ${row.imageQuestions} | ${row.assets} | ${row.durationMinutes} |`,
    )
    .join("\n");
  const skippedRows = report.skipped
    .map((row) => `| ${row.subject} | ${row.slug} | ${row.questions} | ${row.answers} | ${row.reason} |`)
    .join("\n");
  const markdown = `# CUET question-paper dataset import — ${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Calcutta" })}

Source: PaddleOCR-VL 1.6 \`CUET_JSON_OUTPUT\` bundle (180 papers, 8,366 extracted questions).

## Policy

- Only questions with a printed answer that exists among the printed options are imported
  into the playable library; unkeyed questions stay in the OCR bundle for editorial review.
- Structurally broken OCR rows (missing/unresolved options, unreadable text, markdown
  mismatch, visual question with no usable asset) are rejected.
- Explanations are **not** imported by default: the bundle's explanations are
  model-generated prose and spot checks found cross-question contamination. The answer
  key is printed source data; the explanation is an editorial task. Pass
  \`--with-explanations\` only after a reviewer has cleared a batch.
- At least ${MIN_SCORABLE} scorable questions are required for a paper to become a mock.
- Existing library papers are never overwritten; overlapping slugs keep the curated copy.
- Public paper JSON never contains \`correctAnswer\` or \`explanation\`; keys stay in
  \`src/data/local-papers/keys.json\` and D1.
- Only question-linked, non-decorative image assets are copied.

## Result

| Metric | Count |
| --- | ---: |
| Questions in OCR bundle | ${report.totals.questionsInBundle || "—"} |
| Papers scanned | ${report.totals.papersScanned} |
| Papers added | ${report.totals.papersAdded} |
| Papers skipped (quality) | ${report.totals.papersSkipped} |
| Existing paper overlaps kept | ${report.totals.papersOverlapping} |
| Questions considered (new papers) | ${report.totals.questionsScanned} |
| Scorable questions added | ${report.totals.questionsAdded} |
| Unkeyed questions excluded | ${report.totals.questionsSkippedUnkeyed} |
| Invalid / non-playable questions excluded | ${report.totals.questionsSkippedInvalid} |
| Duplicate questions excluded | ${report.totals.duplicateQuestions} |
| Explanations imported | ${report.totals.explanationsImported} |
| Image assets copied | ${report.totals.assetsCopied} |
| Image asset bytes | ${(report.totals.assetBytes / 1e6).toFixed(1)} MB |
| Assets deduplicated against library | ${report.totals.assetsDeduped} |

## Papers added

| Subject | Slug | Year | Scorable Q | Image Q | Assets | Minutes |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
${addedRows || "| — | — | — | — | — | — | — |"}

## Papers skipped

| Subject | Slug | Extracted Q | Printed answers | Reason |
| --- | --- | ---: | ---: | --- |
${skippedRows || "| — | — | — | — | — |"}

## Overlaps already in the curated library

${report.overlapping.map((row) => `- \`${row.slug}\` (${row.datasetAnswers} printed answers in this bundle vs ${row.libraryScorable} scorable in the library)`).join("\n") || "- None"}

## Next steps

1. \`npm run db:migrate:local\`
2. \`node scripts/import-practice-library.mjs --local\`
3. \`node scripts/import-ranked-practice.mjs --local\`
4. Spot-check \`/mock-tests\` and the new subject pages, then rebuild.

Unkeyed papers remain candidates for the editorial review queue. They are deliberately
not playable because the server cannot award or deduct marks without an authoritative key.
`;
  writeFileSync(REPORT_MD, markdown, "utf8");
}

console.log(`CUET JSON dataset import${dryRun ? " (dry run)" : ""}`);
console.log(`  dataset        : ${datasetDir}`);
console.log(`  papers scanned : ${report.totals.papersScanned}`);
console.log(`  papers added   : ${report.totals.papersAdded}`);
console.log(`  skipped        : ${report.totals.papersSkipped} (quality) + ${report.totals.papersOverlapping} (existing)`);
console.log(`  questions added: ${report.totals.questionsAdded}`);
console.log(`  unkeyed        : ${report.totals.questionsSkippedUnkeyed}`);
console.log(`  invalid        : ${report.totals.questionsSkippedInvalid}`);
console.log(`  duplicates     : ${report.totals.duplicateQuestions}`);
console.log(`  explanations   : ${report.totals.explanationsImported}${withExplanations ? "" : " (disabled; review required)"}`);
console.log(`  assets         : ${report.totals.assetsCopied} copied, ${report.totals.assetsDeduped} deduped, ${(report.totals.assetBytes / 1e6).toFixed(1)} MB`);
if (dryRun) console.log("\nDry run: no files written.");
