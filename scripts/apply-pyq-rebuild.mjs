#!/usr/bin/env node
/**
 * Apply the approved PYQ rebuild plan.
 *
 * Reads `PYQ_REBUILD_PLAN.json`, the deduped cluster content and the recorded
 * deterministic repairs, then:
 *   1. builds one 50-question practice paper per set,
 *   2. builds its ranked mock (version + questions + mock_questions),
 *   3. after every set verifies, archives the 231 replaced papers and their
 *      mock wrappers and records 301 redirects.
 *
 * Usage:
 *   node scripts/apply-pyq-rebuild.mjs --emit          # write SQL batches only
 *   node scripts/apply-pyq-rebuild.mjs --local         # apply to local D1
 *   node --env-file-if-exists=.dev.vars scripts/apply-pyq-rebuild.mjs --turso
 *
 * Re-running is safe: every insert is keyed by the new slug / source_key, and a
 * complete set is never deleted. Only a partial set is cleaned up.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLAN_FILE = join(ROOT, "PYQ_REBUILD_PLAN.json");
const CLUSTERS_FILE = join(ROOT, "scratch", "clusters.json");
const ANOMALIES_FILE = join(ROOT, "scratch", "anomalies2.json");
const LOCAL_DB = join(
  ROOT,
  ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/9e86a3487f62f60f2005838556d2eb9f94df20a990ccf3e7e9e15550212e2901.sqlite",
);
const OUT_DIR = join(ROOT, ".wrangler", "pyq-rebuild-seed");
const BATCH_SETS = 5;

const args = new Set(process.argv.slice(2));
const emitOnly = args.has("--emit");
const local = args.has("--local");
const turso = args.has("--turso");
const skipArchive = args.has("--skip-archive");
const dryRun = args.has("--dry-run");
if ([local, turso].filter(Boolean).length > 1) throw new Error("Choose one target: --local or --turso.");

const plan = readFileSync(PLAN_FILE, "utf8");
const planData = JSON.parse(plan);
const clusters = JSON.parse(readFileSync(CLUSTERS_FILE, "utf8")).clusters;
const anomalies = JSON.parse(readFileSync(ANOMALIES_FILE, "utf8"));
const clusterById = new Map(clusters.map((cluster) => [cluster.cluster_id, cluster]));
const repairs = new Map(anomalies.repairs.map((row) => [`${row.paper}\u0000${row.q}`, row]));

const sourceDb = new DatabaseSync(LOCAL_DB, { readOnly: true });
const sourceQuestions = new Map(
  sourceDb
    .prepare("SELECT * FROM practice_questions")
    .all()
    .map((row) => [`${row.paper_slug}\u0000${row.question_key}`, row]),
);
const sourcePassages = new Map(
  sourceDb
    .prepare("SELECT * FROM practice_passages")
    .all()
    .map((row) => [`${row.paper_slug}\u0000${row.passage_key}`, row]),
);
const oldPapers = new Map(
  sourceDb.prepare("SELECT * FROM practice_papers").all().map((row) => [row.slug, row]),
);
const subjects = new Map(
  sourceDb.prepare("SELECT * FROM subjects").all().map((row) => [row.name, row]),
);
const oldMocks = new Map();
for (const row of sourceDb
  .prepare("SELECT * FROM mock_tests WHERE practice_paper_slug IS NOT NULL")
  .all()) {
  oldMocks.set(row.practice_paper_slug, row);
}
sourceDb.close();

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------
function sql(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replace(/'/g, "''")}'`;
}
const json = (value) => sql(JSON.stringify(value ?? null));

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
function displayDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return String(value);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function optionJson(options) {
  return JSON.stringify(
    options.map((option) => {
      const entry = { id: String(option.id ?? "").toUpperCase(), text: String(option.text ?? "") };
      if (option.image_url) entry.image_url = option.image_url;
      return entry;
    }),
  );
}

function rankedOptions(options) {
  return options.map((option) => ({
    text: String(option.text ?? ""),
    image_url: option.image_url ?? null,
    alt: option.alt ?? null,
  }));
}

function rankedAssets(assets) {
  return assets
    .filter((asset) => asset && asset.path && asset.kind !== "explanation" && !asset.path.includes("-exp-"))
    .map((asset) => ({
      url: asset.path,
      alt: asset.alt || `${asset.kind || "image"} for this question`,
      kind: asset.kind || "image",
    }));
}

function primaryAsset(assets, options, stem) {
  const optionUrls = new Set(options.map((option) => option.image_url).filter(Boolean));
  const available = assets.filter((asset) => {
    if (optionUrls.has(asset.url)) return false;
    if (asset.kind === "explanation" || asset.url.includes("-exp-")) return false;
    const file = asset.url.split("?")[0].split("#")[0].split("/").pop();
    if (file && stem.includes(file)) return false;
    return true;
  });
  return (
    available.find((asset) => asset.kind === "figure") ??
    available.find((asset) => asset.kind === "table") ??
    available.find((asset) => asset.kind !== "options") ??
    null
  );
}

// ---------------------------------------------------------------------------
// Build every set
// ---------------------------------------------------------------------------
const issues = [];
const builtSets = [];

function resolveContent(question) {
  const key = `${question.source_paper_slug}\u0000${question.source_question_key}`;
  const row = sourceQuestions.get(key);
  if (!row) {
    issues.push(`${key}: source practice question missing`);
    return null;
  }
  const cluster = clusterById.get(question.cluster_id);
  if (!cluster) {
    issues.push(`${key}: cluster ${question.cluster_id} missing`);
    return null;
  }
  const rep = cluster.rep;
  const sameRep = rep.paper_slug === question.source_paper_slug && rep.question_key === question.source_question_key;
  const repair = sameRep ? repairs.get(key) : null;
  if (!sameRep && repairs.has(`${rep.paper_slug}\u0000${rep.question_key}`)) {
    issues.push(`${key}: repair exists on a different cluster member (${rep.paper_slug}/${rep.question_key})`);
  }

  let options;
  try {
    options = JSON.parse(row.options_json || "[]");
  } catch {
    issues.push(`${key}: options_json is not valid JSON`);
    return null;
  }
  if (repair) options = repair.cleanOptions;
  const stem = repair ? repair.cleanStem : row.stem;
  const answer = String(question.correct_option || row.correct_option || "").toUpperCase();
  let cleanOptions = options.map((option) => ({
    id: String(option.id ?? "").toUpperCase(),
    text: String(option.text ?? ""),
    ...(option.image_url ? { image_url: option.image_url } : {}),
  }));

  let assets = [];
  try {
    assets = JSON.parse(row.assets_json || "[]");
  } catch {
    issues.push(`${key}: assets_json is not valid JSON`);
  }

  // Some OCR papers print the four choices as one labelled A-D crop instead of
  // four readable option rows. The player shows that crop ("Printed answer
  // choices") above the buttons, so the buttons only need a stable label; the
  // key still points at the printed letter. No option content is invented.
  const composite = assets.find(
    (asset) =>
      asset &&
      asset.kind === "options" &&
      typeof asset.path === "string" &&
      !asset.path.includes("-exp-"),
  );
  const optionsAreBlank = cleanOptions.every((option) => !option.text.trim() && !option.image_url);
  const optionsAreImages = Boolean(Number(row.options_are_images)) || optionsAreBlank;
  if (optionsAreBlank) {
    if (composite) {
      cleanOptions = cleanOptions.map((option) => ({ ...option, text: `Option ${option.id}` }));
    } else {
      issues.push(`${key}: blank options without a printed-choices crop`);
    }
  }

  if (!stem || !stem.trim()) issues.push(`${key}: empty stem`);
  if (cleanOptions.length < 2) issues.push(`${key}: fewer than 2 options`);
  if (!cleanOptions.some((option) => option.id === answer)) {
    issues.push(`${key}: answer ${answer} is not one of ${cleanOptions.map((option) => option.id).join(",")}`);
  }
  if (cleanOptions.some((option) => option.id === answer && !option.text && !option.image_url)) {
    issues.push(`${key}: answer ${answer} has neither text nor an image`);
  }

  return {
    key,
    stem,
    options: cleanOptions,
    answer,
    explanation: row.explanation,
    explanationSource: row.explanation_source || "none",
    explanationStatus: row.explanation_status || "unreviewed",
    reviewedBy: row.reviewed_by ?? null,
    reviewedAt: row.reviewed_at ?? null,
    passageKey: row.passage_key,
    matchListJson: row.match_list_json,
    arrangementJson: row.arrangement_json || "[]",
    assets,
    assetsJson: row.assets_json || "[]",
    optionsAreImages: optionsAreImages ? 1 : 0,
    reviewFlagsJson: row.review_flags_json || "[]",
    sourcePagesJson: row.source_pages_json || "[]",
    sanitised: Boolean(repair),
  };
}

for (const set of planData.sets) {
  const subject = subjects.get(set.subject);
  if (!subject) {
    issues.push(`${set.set_slug}: unknown subject ${set.subject}`);
    continue;
  }
  if (set.questions.length !== 50) issues.push(`${set.set_slug}: ${set.questions.length} questions`);

  const reduced = set.source_kind === "reduced";
  const oldPaper = reduced ? oldPapers.get(set.source_paper_slug) : null;
  if (reduced && !oldPaper) issues.push(`${set.set_slug}: reduced source paper missing`);

  const years = set.questions.map((question) => question.source_year).filter((year) => Number.isFinite(year));
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const dateLabel = reduced
    ? oldPaper?.date_label || displayDate(oldPaper?.exam_date) || String(maxYear)
    : minYear === maxYear
      ? String(minYear)
      : `${minYear}\u2013${maxYear}`;

  const passageKeyBySource = new Map();
  const passageRows = [];
  for (const question of set.questions) {
    if (!question.passage_key) continue;
    const sourceKey = `${question.source_paper_slug}\u0000${question.passage_key}`;
    if (passageKeyBySource.has(sourceKey)) continue;
    const sourcePassage = sourcePassages.get(sourceKey);
    if (!sourcePassage) {
      issues.push(`${set.set_slug}: passage ${sourceKey} missing`);
      continue;
    }
    const localKey = `p${String(passageKeyBySource.size + 1).padStart(2, "0")}`;
    passageKeyBySource.set(sourceKey, localKey);
    passageRows.push({
      key: localKey,
      sourceKey,
      title: sourcePassage.title || "Reading passage",
      body: sourcePassage.body,
    });
  }

  const questions = [];
  for (const question of set.questions) {
    const content = resolveContent(question);
    if (!content) continue;
    const sourcePassageKey = question.passage_key
      ? passageKeyBySource.get(`${question.source_paper_slug}\u0000${question.passage_key}`)
      : null;
    const section = question.section ?? set.subject;
    questions.push({ plan: question, content, passageKey: sourcePassageKey, section });
  }
  if (questions.length !== 50) issues.push(`${set.set_slug}: resolved ${questions.length} questions`);

  const usedPassages = passageRows.filter((passage) =>
    questions.some((question) => question.passageKey === passage.key),
  );

  const instructions = [];
  instructions.push("50 questions \u00b7 60 minutes.");
  instructions.push("Marking: +5 for a correct answer, -1 for a wrong answer, 0 for an unattempted question.");
  if (reduced && oldPaper) {
    const omitted = Math.max(0, Number(oldPaper.source_question_count || oldPaper.question_count || 0) - 50);
    instructions.push(
      `Reduced from the original ${oldPaper.source_question_count || set.questions.length + omitted}-question paper; ${omitted} questions omitted.`,
    );
  } else {
    const paperCount = new Set(set.questions.map((question) => question.source_paper_slug)).size;
    instructions.push(
      `50 questions pooled from ${paperCount} CUET previous-year papers; each question keeps its original source tag.`,
    );
  }
  instructions.push("The countdown starts when you begin and the attempt submits automatically at zero.");
  instructions.push("Correct options and explanations are shown after you submit.");

  const statements = [];
  const slug = sql(set.set_slug);
  const incomplete = `(SELECT COUNT(*) FROM practice_questions WHERE paper_slug = ${slug}) <> 50`;
  statements.push(
    `DELETE FROM mock_questions WHERE version_id IN (SELECT v.id FROM mock_test_versions v JOIN mock_tests m ON m.id = v.mock_id WHERE m.slug = ${slug}) AND ${incomplete};`,
    `DELETE FROM mock_test_versions WHERE mock_id IN (SELECT id FROM mock_tests WHERE slug = ${slug}) AND ${incomplete};`,
    `DELETE FROM mock_tests WHERE slug = ${slug} AND ${incomplete};`,
    `DELETE FROM questions WHERE source_set_slug = ${slug} AND ${incomplete};`,
    `DELETE FROM passages WHERE source_key LIKE ${sql(`${set.set_slug}|%`)} AND ${incomplete};`,
    `DELETE FROM practice_questions WHERE paper_slug = ${slug} AND ${incomplete};`,
    `DELETE FROM practice_passages WHERE paper_slug = ${slug} AND ${incomplete};`,
    `DELETE FROM practice_papers WHERE slug = ${slug} AND ${incomplete};`,
  );

  statements.push(
    `INSERT INTO practice_papers (
       slug, title, meta_description, subject_id, year, exam_date, date_label, shift,
       duration_min, source_file, source_method, source_question_count, publication_status,
       review_required, source_type, rights_status, rights_note, verified_by, verified_at,
       language, duration_locked, created_at
     ) VALUES (
       ${slug}, ${sql(set.title)}, '', ${subject.id}, ${maxYear},
       ${reduced ? sql(oldPaper?.exam_date ?? null) : "NULL"}, ${sql(dateLabel)},
       ${reduced ? sql(oldPaper?.shift ?? null) : "NULL"}, 60, NULL,
       ${sql(reduced ? "pyq_rebuild_reduced" : "pyq_rebuild_pooled")}, 50, 'published', 0,
       'official_public', 'unknown',
       ${sql("Questions retain their original CUET UG paper source tags.")},
       'pyq-rebuild-v1', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
       ${sql(set.language)}, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     ) ON CONFLICT(slug) DO NOTHING;`,
  );

  for (const passage of usedPassages) {
    statements.push(
      `INSERT INTO practice_passages (paper_slug, passage_key, title, body)
       VALUES (${slug}, ${sql(passage.key)}, ${sql(passage.title)}, ${sql(passage.body)})
       ON CONFLICT(paper_slug, passage_key) DO NOTHING;`,
    );
  }

  for (const [index, question] of questions.entries()) {
    const position = index + 1;
    const qkey = `q${String(position).padStart(2, "0")}`;
    const { plan: source, content, passageKey } = question;
    statements.push(
      `INSERT INTO practice_questions (
         paper_slug, question_key, source_question_no, position, stem, options_json,
         options_are_images, correct_option, explanation, passage_key, match_list_json,
         arrangement_json, assets_json, source_pages_json, review_flags_json,
         explanation_source, explanation_status, reviewed_by, reviewed_at,
         source_year, source_date, source_shift, source_paper_id
       ) VALUES (
         ${slug}, ${sql(qkey)}, ${source.source_question_no}, ${position},
         ${sql(content.stem)}, ${sql(optionJson(content.options))},
         ${content.optionsAreImages}, ${sql(content.answer)}, ${sql(content.explanation)},
         ${sql(passageKey)}, ${sql(content.matchListJson)}, ${sql(content.arrangementJson)},
         ${sql(content.assetsJson)}, ${sql(content.sourcePagesJson)}, ${sql(content.reviewFlagsJson)},
         ${sql(content.explanationSource)}, ${sql(content.explanationStatus)},
         ${sql(content.reviewedBy)}, ${sql(content.reviewedAt)},
         ${source.source_year}, ${sql(source.source_date)}, ${sql(source.source_shift)}, ${source.source_paper_id}
       ) ON CONFLICT(paper_slug, question_key) DO NOTHING;`,
      `UPDATE practice_questions
       SET explanation_source = ${sql(content.explanationSource)},
           explanation_status = ${sql(content.explanationStatus)},
           reviewed_by = ${sql(content.reviewedBy)},
           reviewed_at = ${sql(content.reviewedAt)}
       WHERE paper_slug = ${slug} AND question_key = ${sql(qkey)};`,
    );
  }

  if (reduced && oldPaper) {
    const originalCount = Number(oldPaper.source_question_count || 0) || 50;
    statements.push(
      `UPDATE practice_papers SET source_question_count = ${originalCount}
       WHERE slug = ${slug} AND source_question_count <> ${originalCount};`,
    );
  }

  statements.push(
    `INSERT INTO mock_tests (
       exam_id, subject_id, title, slug, type, duration_min, total_marks, marking_scheme,
       instructions, pyq_year, pyq_shift, status, practice_paper_slug, created_at
     ) VALUES (
       (SELECT id FROM exams WHERE slug = 'cuet-ug'), ${subject.id}, ${sql(set.title)}, ${slug},
       'pyq', 60, 250, ${sql(JSON.stringify({ correct: 5, wrong: -1, skipped: 0 }))},
       ${sql(instructions.join("\n"))}, ${maxYear},
       ${reduced ? sql(oldPaper?.shift ?? null) : "NULL"}, 'draft', ${slug},
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     ) ON CONFLICT(slug) DO NOTHING;`,
    `INSERT INTO mock_test_versions (
       mock_id, version_no, duration_min, total_marks, marking_scheme, instructions, status, published_at
     ) SELECT id, 1, 60, 250, ${sql(JSON.stringify({ correct: 5, wrong: -1, skipped: 0 }))},
              ${sql(instructions.join("\n"))}, 'draft', NULL
       FROM mock_tests WHERE slug = ${slug}
     ON CONFLICT(mock_id, version_no) DO NOTHING;`,
  );

  for (const passage of usedPassages) {
    statements.push(
      `INSERT INTO passages (subject_id, body, source_key)
       VALUES (${subject.id}, ${sql(passage.body)}, ${sql(`${set.set_slug}|${passage.key}`)})
       ON CONFLICT(subject_id, source_key) WHERE source_key IS NOT NULL DO NOTHING;`,
    );
  }

  for (const [index, question] of questions.entries()) {
    const position = index + 1;
    const { plan: source, content, passageKey, section } = question;
    const ranked = rankedOptions(content.options);
    const assets = rankedAssets(content.assets);
    const primary = primaryAsset(assets, ranked, content.stem);
    const cleanStem = content.stem || `Question ${position}`;
    const passageExpr = passageKey
      ? `(SELECT id FROM passages WHERE subject_id = ${subject.id} AND source_key = ${sql(`${set.set_slug}|${passageKey}`)})`
      : "NULL";
    const sourceKey = `${set.set_slug}|q${String(position).padStart(2, "0")}`;
    const correctIndex = content.options.findIndex((option) => option.id === content.answer);
    if (correctIndex < 0) {
      issues.push(`${set.set_slug}/${position}: correct option index not found`);
      continue;
    }
    statements.push(
      `INSERT INTO questions (
         subject_id, passage_id, text, options, correct_option, explanation, year,
         image_url, image_alt, status, assets_json,
         explanation_source, explanation_status, reviewed_by, reviewed_at,
         source_year, source_date, source_shift, source_question_no, source_paper_id,
         source_set_slug, source_key, created_at
       ) VALUES (
         ${subject.id}, ${passageExpr}, ${sql(cleanStem)}, ${json(ranked)}, ${correctIndex},
         ${sql(content.explanation)}, ${source.source_year}, ${sql(primary?.url ?? null)},
         ${sql(primary?.alt ?? null)}, 'draft', ${json(assets)},
         ${sql(content.explanationSource)}, ${sql(content.explanationStatus)},
         ${sql(content.reviewedBy)}, ${sql(content.reviewedAt)},
         ${source.source_year}, ${sql(source.source_date)}, ${sql(source.source_shift)},
         ${source.source_question_no}, ${source.source_paper_id}, ${slug}, ${sql(sourceKey)},
         strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       ) ON CONFLICT(source_key) WHERE source_key IS NOT NULL DO NOTHING;`,
      `UPDATE questions
       SET explanation_source = ${sql(content.explanationSource)},
           explanation_status = ${sql(content.explanationStatus)},
           reviewed_by = ${sql(content.reviewedBy)},
           reviewed_at = ${sql(content.reviewedAt)}
       WHERE source_key = ${sql(sourceKey)};`,
      `INSERT INTO mock_questions (version_id, question_id, section, position)
       SELECT v.id, q.id, ${sql(section)}, ${position}
       FROM mock_test_versions v
       JOIN mock_tests m ON m.id = v.mock_id
       JOIN questions q ON q.source_key = ${sql(sourceKey)}
       WHERE m.slug = ${slug} AND v.version_no = 1
         AND NOT EXISTS (
           SELECT 1 FROM mock_questions existing
           WHERE existing.version_id = v.id AND existing.question_id = q.id
         )
       ON CONFLICT(version_id, question_id) DO NOTHING;`,
    );
  }

  statements.push(
    `UPDATE questions SET status = 'published'
     WHERE source_set_slug = ${slug} AND status = 'draft';`,
    `UPDATE mock_test_versions
     SET status = 'published', published_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE mock_id = (SELECT id FROM mock_tests WHERE slug = ${slug})
       AND version_no = 1 AND status = 'draft';`,
    `UPDATE mock_tests
     SET status = 'published', current_version_id = (SELECT id FROM mock_test_versions WHERE mock_id = mock_tests.id AND version_no = 1),
         version = 1, published_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE slug = ${slug} AND status = 'draft';`,
  );

  builtSets.push({
    slug: set.set_slug,
    subject: set.subject,
    language: set.language,
    year: maxYear,
    dateLabel,
    sourceKind: reduced ? "reduced" : "pooled",
    sourcePapers: [...new Set(set.questions.map((question) => question.source_paper_slug))],
    questionCount: questions.length,
    passageCount: usedPassages.length,
    sanitised: questions.filter((question) => question.content.sanitised).length,
    statements,
  });
}

// ---------------------------------------------------------------------------
// Archive + redirects (only after all set rows verify)
// ---------------------------------------------------------------------------
const archiveStatements = [];
const redirects = [];
for (const paper of planData.short_papers) {
  const targetMock = paper.replaced_by;
  archiveStatements.push(
    `UPDATE practice_papers SET is_archived = 1, replaced_by = ${sql(paper.redirect_to)},
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE slug = ${sql(paper.old_slug)} AND is_archived = 0;`,
    `UPDATE mock_tests SET status = 'archived', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE practice_paper_slug = ${sql(paper.old_slug)} AND status = 'published';`,
    `INSERT INTO slug_redirects (old_slug, entity_type, entity_id, target_path, created_at)
     VALUES (${sql(paper.old_slug)}, 'mock',
             COALESCE((SELECT id FROM mock_tests WHERE slug = ${sql(targetMock)}), 0),
             ${targetMock ? "NULL" : sql(paper.redirect_to)},
             strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     ON CONFLICT(old_slug) DO NOTHING;`,
  );
  redirects.push({
    old_slug: paper.old_slug,
    to: targetMock ? `/mock/${targetMock}` : paper.redirect_to,
    kind: targetMock ? "mock" : "subject_hub",
  });
}
for (const paper of planData.overlong_papers) {
  archiveStatements.push(
    `UPDATE practice_papers SET is_archived = 1, replaced_by = ${sql(paper.new_set_url)},
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE slug = ${sql(paper.old_slug)} AND is_archived = 0;`,
    `UPDATE mock_tests SET status = 'archived', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE practice_paper_slug = ${sql(paper.old_slug)} AND status = 'published';`,
    `INSERT INTO slug_redirects (old_slug, entity_type, entity_id, target_path, created_at)
     VALUES (${sql(paper.old_slug)}, 'mock',
             COALESCE((SELECT id FROM mock_tests WHERE slug = ${sql(paper.new_set_slug)}), 0),
             NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     ON CONFLICT(old_slug) DO NOTHING;`,
  );
  redirects.push({ old_slug: paper.old_slug, to: `/mock/${paper.new_set_slug}`, kind: "mock" });
}

// ---------------------------------------------------------------------------
// Validation before any write
// ---------------------------------------------------------------------------
const totalQuestions = builtSets.reduce((sum, set) => sum + set.questionCount, 0);
const totalPassages = builtSets.reduce((sum, set) => sum + set.passageCount, 0);
if (builtSets.length !== 118) issues.push(`built ${builtSets.length} sets, expected 118`);
if (totalQuestions !== 5900) issues.push(`built ${totalQuestions} questions, expected 5900`);
if (totalPassages !== 26) issues.push(`built ${totalPassages} passages, expected 26`);
if (redirects.length !== 231) issues.push(`built ${redirects.length} redirects, expected 231`);
for (const set of builtSets) {
  if (set.questionCount !== 50) issues.push(`${set.slug}: ${set.questionCount} questions`);
}

console.log("PYQ rebuild seed");
console.log(`  sets       : ${builtSets.length}`);
console.log(`  questions  : ${totalQuestions}`);
console.log(`  passages   : ${totalPassages}`);
console.log(`  redirects  : ${redirects.length}`);
console.log(`  sanitised  : ${builtSets.reduce((sum, set) => sum + set.sanitised, 0)}`);
if (issues.length > 0) {
  console.error(`\n${issues.length} validation issue(s):`);
  for (const issue of issues.slice(0, 40)) console.error(`  - ${issue}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Emit SQL batches
// ---------------------------------------------------------------------------
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
const sqlFiles = [];
for (let offset = 0; offset < builtSets.length; offset += BATCH_SETS) {
  const batch = builtSets.slice(offset, offset + BATCH_SETS);
  const name = `sets-${String(offset / BATCH_SETS + 1).padStart(3, "0")}.sql`;
  const file = join(OUT_DIR, name);
  const lines = [`-- PYQ rebuild batch ${offset / BATCH_SETS + 1}: sets ${offset + 1}-${offset + batch.length}`];
  for (const set of batch) {
    lines.push(`-- ${set.slug} (${set.subject}, ${set.questionCount} questions, ${set.sourceKind})`);
    lines.push(...set.statements, "");
  }
  writeFileSync(file, `${lines.join("\n")}\n`, "utf8");
  sqlFiles.push({ name, sets: batch.map((set) => set.slug), bytes: Buffer.byteLength(lines.join("\n")) });
}
writeFileSync(
  join(OUT_DIR, "archive.sql"),
  `${["-- Archive the 231 replaced papers and mock wrappers; 301 redirects.", ...archiveStatements, ""].join("\n")}\n`,
  "utf8",
);
writeFileSync(
  join(OUT_DIR, "manifest.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sets: builtSets.map(({ statements, ...set }) => set),
      redirects,
      sqlFiles,
      archiveSqlBytes: Buffer.byteLength(archiveStatements.join("\n")),
    },
    null,
    2,
  ),
);
console.log(`\nEmitted ${sqlFiles.length} batch file(s) + archive.sql in ${OUT_DIR}`);
if (emitOnly || dryRun) process.exit(0);

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------
async function applyLocal() {
  const db = new DatabaseSync(LOCAL_DB);
  const counts = [];
  for (const [index, set] of builtSets.entries()) {
    db.exec("BEGIN");
    try {
      for (const statement of set.statements) db.exec(statement);
      const practice = db
        .prepare("SELECT COUNT(*) AS n FROM practice_questions WHERE paper_slug = ?")
        .get(set.slug).n;
      const ranked = db
        .prepare(
          `SELECT COUNT(*) AS n FROM mock_questions mq
           JOIN mock_test_versions v ON v.id = mq.version_id
           JOIN mock_tests m ON m.id = v.mock_id
           WHERE m.slug = ?`,
        )
        .get(set.slug).n;
      const versions = db
        .prepare(
          `SELECT COUNT(*) AS n FROM mock_test_versions v JOIN mock_tests m ON m.id = v.mock_id WHERE m.slug = ?`,
        )
        .get(set.slug).n;
      if (practice !== 50 || ranked !== 50 || versions !== 1) {
        throw new Error(`${set.slug}: practice=${practice} ranked=${ranked} versions=${versions}`);
      }
      db.exec("COMMIT");
      counts.push({ slug: set.slug, practice, ranked, versions });
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    if ((index + 1) % 10 === 0 || index === builtSets.length - 1) {
      console.log(`  applied ${index + 1}/${builtSets.length} sets`);
    }
  }
  if (!skipArchive) {
    db.exec("BEGIN");
    try {
      for (const statement of archiveStatements) db.exec(statement);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    console.log(`  archived ${planData.totals.short_papers_archived + planData.totals.overlong_reduced} papers, ${redirects.length} redirects`);
  }
  db.close();
  return counts;
}

async function applyTurso() {
  const { createTursoClient } = await import("./turso-lib.mjs");
  const client = createTursoClient();
  const counts = [];
  for (const [index, set] of builtSets.entries()) {
    const payload = set.statements.map((statement) => ({ sql: statement, args: [] }));
    await client.batch(payload, "deferred");
    const check = await client.execute({
      sql: `SELECT
              (SELECT COUNT(*) FROM practice_questions WHERE paper_slug = ?) AS practice,
              (SELECT COUNT(*) FROM mock_questions mq
                 JOIN mock_test_versions v ON v.id = mq.version_id
                 JOIN mock_tests m ON m.id = v.mock_id
                 WHERE m.slug = ?) AS ranked`,
      args: [set.slug, set.slug],
    });
    const row = check.rows[0];
    const practice = Number(row?.[0] ?? row?.practice ?? 0);
    const ranked = Number(row?.[1] ?? row?.ranked ?? 0);
    if (practice !== 50 || ranked !== 50) {
      throw new Error(`${set.slug}: practice=${practice} ranked=${ranked}`);
    }
    counts.push({ slug: set.slug, practice, ranked });
    if ((index + 1) % 10 === 0 || index === builtSets.length - 1) {
      console.log(`  applied ${index + 1}/${builtSets.length} sets`);
    }
  }
  if (!skipArchive) {
    for (let offset = 0; offset < archiveStatements.length; offset += 50) {
      const payload = archiveStatements.slice(offset, offset + 50).map((statement) => ({ sql: statement, args: [] }));
      await client.batch(payload, "deferred");
    }
    console.log(`  archived ${planData.totals.short_papers_archived + planData.totals.overlong_reduced} papers, ${redirects.length} redirects`);
  }
  return counts;
}

if (local) {
  console.log("\nApplying to local D1...");
  const counts = await applyLocal();
  writeFileSync(join(OUT_DIR, "applied-local.json"), JSON.stringify({ counts }, null, 2));
  console.log("Local apply complete.");
} else if (turso) {
  console.log("\nApplying to Turso...");
  const counts = await applyTurso();
  writeFileSync(join(OUT_DIR, "applied-turso.json"), JSON.stringify({ counts }, null, 2));
  console.log("Turso apply complete.");
}
