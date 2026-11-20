#!/usr/bin/env node
/**
 * BUG-011 — promote the 5-question English "mini mock" to the standard
 * 50-question format without touching version 1 or its existing attempts.
 *
 * Version 2 keeps the original five questions at positions 1-5 and adds 45
 * vetted English grammar/usage/vocabulary questions that are not used by any
 * other published mock. Version 1 is superseded, not deleted, so the six
 * submitted attempts still resolve their own questions and marks.
 *
 * Usage:
 *   node --env-file-if-exists=.dev.vars scripts/fix-english-mini-mock-v2.mjs --dry-run
 *   node --env-file-if-exists=.dev.vars scripts/fix-english-mini-mock-v2.mjs --turso
 *
 * `--dry-run` is read-only. `--turso` writes inside one transaction and writes
 * a JSON backup under test-artifacts/backups/ first. Set TURSO_DATABASE_URL to
 * a `file:` URL to exercise the same path against a disposable test database.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const APPLY = args.has("--turso");

if (DRY_RUN === APPLY) {
  console.error("Usage: node scripts/fix-english-mini-mock-v2.mjs [--dry-run|--turso]");
  process.exit(2);
}

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
const isFileDb = Boolean(url?.startsWith("file:"));
if (!url) {
  console.error("TURSO_DATABASE_URL is not set (use .dev.vars or the shell).");
  process.exit(2);
}
if (!isFileDb && !authToken) {
  console.error("TURSO_AUTH_TOKEN is not set (use .dev.vars or the shell).");
  process.exit(2);
}

const SLUG = "cuet-ug-english-grammar-mini-mock";
const NEW_TITLE = "CUET UG English - Grammar and Usage Mock";
const NEW_DURATION_MIN = 60;
const NEW_TOTAL_MARKS = 250;
const NEW_MARKING_SCHEME = '{"correct":5,"wrong":-1,"skipped":0}';
const NEW_INSTRUCTIONS =
  "This is a 60-minute English mock. Each question carries 5 marks; 1 mark is deducted for a wrong answer and unanswered questions score 0. Submit once to see your score and explanations.";

// 45 additions, grouped: grammar/usage, idioms, then vocabulary.
const ADDED_QUESTION_IDS = [
  // grammar and usage
  9, 2678, 1405, 2872, 2941, 2746, 2980, 3077, 3026, 4071, 3011,
  // idioms and expressions
  4191, 4193, 4013, 3005,
  // vocabulary: synonyms, antonyms, word meaning, foreign words
  345, 356, 359, 362, 364, 368, 404, 2672, 2721, 2734, 2744, 2768, 2776,
  2787, 2876, 2890, 2937, 2997, 3002, 3035, 3070, 4057, 4157, 4158,
  11095, 11100, 11236, 11345, 11388, 12417,
];

if (ADDED_QUESTION_IDS.length !== 45) {
  throw new Error(`Expected 45 additions, got ${ADDED_QUESTION_IDS.length}.`);
}
if (new Set(ADDED_QUESTION_IDS).size !== ADDED_QUESTION_IDS.length) {
  throw new Error("Duplicate question id in ADDED_QUESTION_IDS.");
}
if (JSON.parse(NEW_MARKING_SCHEME).correct * 50 !== NEW_TOTAL_MARKS) {
  throw new Error("NEW_TOTAL_MARKS does not match 50 questions at 5 marks each.");
}

const client = createClient({ url, authToken: authToken || undefined });

async function query(sql, params = []) {
  const result = await client.execute({ sql, args: params });
  return result.rows;
}

function optionObjects(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return Array.isArray(parsed) ? parsed : null;
}

function optionTexts(raw) {
  const parsed = optionObjects(raw);
  if (!parsed) return null;
  return parsed.map((option) => {
    if (typeof option === "string") return option.trim();
    if (option && typeof option.text === "string") return option.text.trim();
    return "";
  });
}

function signature(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inspectQuestion(question, expectedSubjectId) {
  const issues = [];
  if (Number(question.subject_id) !== Number(expectedSubjectId)) issues.push("not the mock subject");
  if (question.status !== "published") issues.push("not published");
  if (question.deleted_at) issues.push("soft-deleted");
  if (question.passage_id != null) issues.push("depends on a passage");
  if (question.image_url) issues.push("has a question image");
  if (
    question.explanation_image_url &&
    !String(question.explanation_image_alt ?? "").trim()
  ) {
    issues.push("explanation image has no alt text");
  }
  if (question.explanation == null || !String(question.explanation).trim()) issues.push("missing explanation");
  if (!String(question.text ?? "").trim()) issues.push("empty stem");
  let assets = [];
  try {
    assets = JSON.parse(question.assets_json ?? "[]");
  } catch {
    issues.push("invalid assets_json");
  }
  if (Array.isArray(assets) && assets.length > 0) issues.push("has question assets");
  const options = optionTexts(question.options);
  if (!options) {
    issues.push("invalid options JSON");
  } else {
    if (options.length !== 4) issues.push(`has ${options.length} options, expected 4`);
    if (options.some((text) => !text)) issues.push("has an empty option");
    // Compare literal text: punctuation-only variants are valid distractors
    // (for example a "correctly punctuated sentence" question).
    if (new Set(options.map((text) => text.trim())).size !== options.length) {
      issues.push("has duplicate option text");
    }
    const rawOptions = optionObjects(question.options);
    for (const [index, option] of (rawOptions ?? []).entries()) {
      if (
        option &&
        typeof option === "object" &&
        option.image_url &&
        !String(option.alt ?? "").trim()
      ) {
        issues.push(`option ${index + 1} has an image without alt text`);
      }
    }
    if (
      !Number.isInteger(Number(question.correct_option)) ||
      Number(question.correct_option) < 0 ||
      Number(question.correct_option) >= options.length
    ) {
      issues.push("answer index outside options");
    }
  }
  return issues;
}

async function loadState() {
  const mocks = await query(
    `SELECT id, subject_id, title, slug, type, duration_min, total_marks, marking_scheme,
            instructions, status, version, current_version_id, published_at, deleted_at
     FROM mock_tests WHERE slug = ?`,
    [SLUG],
  );
  if (mocks.length !== 1) {
    throw new Error(`Expected exactly one mock with slug ${SLUG}, found ${mocks.length}.`);
  }
  const mock = mocks[0];
  if (mock.deleted_at) throw new Error("Target mock is soft-deleted.");
  if (mock.status !== "published") throw new Error(`Target mock is ${mock.status}, not published.`);

  const versions = await query(
    `SELECT id, mock_id, version_no, duration_min, total_marks, marking_scheme, instructions,
            status, published_at, created_by, created_at
     FROM mock_test_versions WHERE mock_id = ? ORDER BY version_no`,
    [mock.id],
  );
  const currentVersion = versions.find((version) => Number(version.id) === Number(mock.current_version_id));
  if (!currentVersion) throw new Error("current_version_id does not resolve to a version.");
  if (currentVersion.status !== "published") {
    throw new Error(`Current version ${currentVersion.id} is ${currentVersion.status}, not published.`);
  }

  const currentLinks = await query(
    `SELECT position, section, question_id FROM mock_questions
     WHERE version_id = ? ORDER BY position`,
    [currentVersion.id],
  );

  const questionIds = [...currentLinks.map((row) => Number(row.question_id)), ...ADDED_QUESTION_IDS];
  const placeholders = questionIds.map(() => "?").join(",");
  const questionRows = await query(
    `SELECT id, subject_id, status, deleted_at, passage_id, image_url, image_alt,
            explanation_image_url, explanation_image_alt, assets_json,
            text, options, correct_option, explanation
     FROM questions WHERE id IN (${placeholders})`,
    questionIds,
  );
  const byId = new Map(questionRows.map((row) => [Number(row.id), row]));
  const missing = questionIds.filter((id) => !byId.has(id));
  if (missing.length > 0) throw new Error(`Missing question rows: ${missing.join(", ")}`);

  const attempts = await query(
    `SELECT version_id, status, COUNT(*) AS count FROM attempts
     WHERE mock_id = ? GROUP BY version_id, status ORDER BY version_id, status`,
    [mock.id],
  );

  return { mock, versions, currentVersion, currentLinks, questionIds, byId, attempts };
}

async function publishedQuestionUsage(ids) {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  return query(
    `SELECT DISTINCT mq.question_id
     FROM mock_questions mq
     JOIN mock_test_versions v ON v.id = mq.version_id AND v.status = 'published'
     WHERE mq.question_id IN (${placeholders})`,
    ids,
  );
}

async function nonStandardPublishedMocks() {
  return query(
    `SELECT mt.id, mt.title, COUNT(mq.question_id) AS questions
     FROM mock_tests mt
     JOIN mock_test_versions v ON v.mock_id = mt.id AND v.status = 'published'
     LEFT JOIN mock_questions mq ON mq.version_id = v.id
     WHERE mt.status = 'published' AND mt.deleted_at IS NULL
     GROUP BY mt.id
     HAVING questions <> 50
     ORDER BY mt.id`,
  );
}

function validate(state) {
  const { mock, versions, currentLinks, questionIds, byId } = state;
  const problems = [];

  if (currentLinks.length !== 5) {
    problems.push(`current version has ${currentLinks.length} questions, expected 5.`);
  }
  if (new Set(questionIds).size !== questionIds.length) {
    problems.push("the retained and added question ids overlap.");
  }
  if (questionIds.length !== 50) {
    problems.push(`planned version has ${questionIds.length} questions, expected 50.`);
  }
  if (versions.some((version) => Number(version.version_no) === 2)) {
    const existing = versions.find((version) => Number(version.version_no) === 2);
    problems.push(`version 2 already exists (#${existing.id}, ${existing.status}); apply is not repeatable.`);
  }

  const seen = new Map();
  for (const id of questionIds) {
    const question = byId.get(id);
    const issues = inspectQuestion(question, mock.subject_id);
    if (issues.length > 0) problems.push(`question #${id}: ${issues.join("; ")}`);
    const key = signature(question.text);
    if (!key) {
      problems.push(`question #${id}: empty text signature`);
    } else if (seen.has(key)) {
      problems.push(`questions #${seen.get(key)} and #${id} have the same stem.`);
    } else {
      seen.set(key, id);
    }
  }

  return problems;
}

async function main() {
  const state = await loadState();
  const problems = validate(state);

  const usage = await publishedQuestionUsage(ADDED_QUESTION_IDS);
  if (usage.length > 0) {
    problems.push(
      `added questions already used by a published version: ${usage
        .map((row) => row.question_id)
        .join(", ")}`,
    );
  }

  const nonStandard = await nonStandardPublishedMocks();
  const unexpected = nonStandard.filter((row) => Number(row.id) !== Number(state.mock.id));
  if (unexpected.length > 0) {
    problems.push(
      `other published mocks are not 50 questions: ${unexpected
        .map((row) => `#${row.id} (${row.questions})`)
        .join(", ")}`,
    );
  }

  const totalAttempts = state.attempts.reduce((sum, row) => sum + Number(row.count), 0);
  console.log("BUG-011 — English mini mock → 50-question v2");
  console.log(`Target: ${isFileDb ? "disposable file database" : "production Turso"}`);
  console.log(`Mock: #${state.mock.id} ${state.mock.slug}`);
  console.log(
    `Current: v${state.currentVersion.version_no} (#${state.currentVersion.id}), ` +
      `${state.currentLinks.length} questions, ${state.currentVersion.duration_min} min, ` +
      `${state.currentVersion.total_marks} marks, ${totalAttempts} attempts`,
  );
  if (state.attempts.length > 0) {
    const versionNoById = new Map(
      state.versions.map((version) => [Number(version.id), Number(version.version_no)]),
    );
    console.log(
      `Attempts by version: ${state.attempts
        .map(
          (row) =>
            `v${versionNoById.get(Number(row.version_id)) ?? "?"}/${row.status}=${row.count}`,
        )
        .join(", ")}`,
    );
  }
  console.log(
    `Plan: v2 = ${state.currentLinks.length} retained + ${ADDED_QUESTION_IDS.length} new = ` +
      `${state.questionIds.length} questions, ${NEW_DURATION_MIN} min, ${NEW_TOTAL_MARKS} marks`,
  );
  console.log(`Title: "${state.mock.title}" -> "${NEW_TITLE}"`);
  console.log(
    `v${state.currentVersion.version_no} is superseded, not deleted; attempts stay on it.`,
  );
  console.log(`Non-standard published mocks before: ${nonStandard.length === 0 ? "none" : nonStandard.map((row) => `#${row.id}=${row.questions}`).join(", ")}`);

  if (problems.length > 0) {
    console.error("\nValidation failed:");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Validation: ${state.questionIds.length}/${state.questionIds.length} questions pass; stems are distinct; additions are unused by published mocks.`);

  if (DRY_RUN) {
    console.log("\nDry run complete: no writes. Re-run with --turso to apply.");
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = join(ROOT, "test-artifacts", "backups");
  mkdirSync(backupDir, { recursive: true });
  const backupPath = join(backupDir, `english-mini-mock-v2-${stamp}.json`);
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        mock: state.mock,
        versions: state.versions,
        currentQuestions: state.currentLinks,
        attempts: state.attempts,
        questions: state.questionIds.map((id) => state.byId.get(id)),
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`\nBackup written: ${backupPath}`);

  const now = new Date().toISOString();
  const transaction = await client.transaction("write");
  let newVersionId;
  try {
    const inserted = await transaction.execute({
      // Question membership is frozen once a version is published, so the
      // version must be created as a draft, filled, then published.
      sql: `INSERT INTO mock_test_versions
              (mock_id, version_no, duration_min, total_marks, marking_scheme, instructions,
               status, published_at, created_by, created_at)
            VALUES (?, 2, ?, ?, ?, ?, 'draft', NULL, ?, ?)`,
      args: [
        state.mock.id,
        NEW_DURATION_MIN,
        NEW_TOTAL_MARKS,
        NEW_MARKING_SCHEME,
        NEW_INSTRUCTIONS,
        state.currentVersion.created_by ?? null,
        now,
      ],
    });
    newVersionId = Number(inserted.lastInsertRowid);
    if (!Number.isInteger(newVersionId) || newVersionId <= 0) {
      throw new Error("Could not resolve the new version id.");
    }

    const section = state.currentLinks[0]?.section || "English";
    const ordered = [
      ...state.currentLinks.map((row) => ({ questionId: Number(row.question_id), section: row.section })),
      ...ADDED_QUESTION_IDS.map((questionId) => ({ questionId, section })),
    ];
    for (const [index, item] of ordered.entries()) {
      await transaction.execute({
        sql: `INSERT INTO mock_questions (version_id, question_id, section, position)
              VALUES (?, ?, ?, ?)`,
        args: [newVersionId, item.questionId, item.section, index + 1],
      });
    }

    const published = await transaction.execute({
      sql: `UPDATE mock_test_versions SET status = 'published', published_at = ?
            WHERE id = ? AND status = 'draft'`,
      args: [now, newVersionId],
    });
    if (Number(published.rowsAffected) !== 1) {
      throw new Error("Could not publish the draft version.");
    }

    await transaction.execute({
      sql: `UPDATE mock_test_versions SET status = 'superseded'
            WHERE mock_id = ? AND status = 'published' AND id <> ?`,
      args: [state.mock.id, newVersionId],
    });
    await transaction.execute({
      sql: `UPDATE mock_tests
            SET title = ?, duration_min = ?, total_marks = ?, marking_scheme = ?,
                version = 2, current_version_id = ?, instructions = ?, updated_at = ?
            WHERE id = ?`,
      args: [
        NEW_TITLE,
        NEW_DURATION_MIN,
        NEW_TOTAL_MARKS,
        NEW_MARKING_SCHEME,
        newVersionId,
        NEW_INSTRUCTIONS,
        now,
        state.mock.id,
      ],
    });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  } finally {
    transaction.close();
  }

  const afterMock = (await query(
    `SELECT title, duration_min, total_marks, marking_scheme, version, current_version_id
     FROM mock_tests WHERE id = ?`,
    [state.mock.id],
  ))[0];
  const afterVersions = await query(
    `SELECT id, version_no, status, marking_scheme FROM mock_test_versions
     WHERE mock_id = ? ORDER BY version_no`,
    [state.mock.id],
  );
  const afterCounts = await query(
    `SELECT version_id, COUNT(*) AS questions FROM mock_questions
     WHERE version_id IN (${afterVersions.map(() => "?").join(",")})
     GROUP BY version_id`,
    afterVersions.map((row) => row.id),
  );
  const afterAttempts = await query(
    `SELECT version_id, status, COUNT(*) AS count FROM attempts
     WHERE mock_id = ? GROUP BY version_id, status ORDER BY version_id, status`,
    [state.mock.id],
  );
  const afterNonStandard = await nonStandardPublishedMocks();

  const versionNoById = new Map(
    afterVersions.map((version) => [Number(version.id), Number(version.version_no)]),
  );
  const questionCount = (versionId) =>
    Number(afterCounts.find((row) => Number(row.version_id) === Number(versionId))?.questions ?? 0);

  console.log("\nApplied. Verification:");
  console.log(`  mock: "${afterMock.title}", ${afterMock.duration_min} min, ${afterMock.total_marks} marks, legacy version=${afterMock.version}`);
  console.log(`  current_version_id=${afterMock.current_version_id}`);
  for (const version of afterVersions) {
    console.log(
      `  v${version.version_no} (#${version.id}): ${version.status}, ` +
        `${questionCount(version.id)} questions, ${version.marking_scheme}`,
    );
  }
  console.log(
    `  attempts: ${afterAttempts
      .map(
        (row) =>
          `v${versionNoById.get(Number(row.version_id)) ?? "?"}/${row.status}=${row.count}`,
      )
      .join(", ") || "none"}`,
  );
  console.log(`  non-standard published mocks after: ${afterNonStandard.length === 0 ? "none" : afterNonStandard.map((row) => `#${row.id}=${row.questions}`).join(", ")}`);

  if (
    Number(afterMock.current_version_id) !== newVersionId ||
    afterMock.title !== NEW_TITLE ||
    Number(afterMock.duration_min) !== NEW_DURATION_MIN ||
    Number(afterMock.total_marks) !== NEW_TOTAL_MARKS ||
    afterMock.marking_scheme !== NEW_MARKING_SCHEME ||
    questionCount(newVersionId) !== 50 ||
    afterNonStandard.length !== 0 ||
    totalAttempts !== afterAttempts.reduce((sum, row) => sum + Number(row.count), 0)
  ) {
    throw new Error("Post-apply verification failed.");
  }
  console.log("\nBUG-011 applied successfully.");
}

main()
  .catch((error) => {
    console.error(`\nFAILED: ${error?.message ?? error}`);
    process.exitCode = 1;
  })
  .finally(() => {
    client.close();
  });
