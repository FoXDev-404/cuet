#!/usr/bin/env node
/**
 * Seed the persistent local mock-bank fixture used by Playwright.
 *
 * The public API intentionally excludes imported practice papers
 * (`practice_paper_slug IS NOT NULL`). Without a standalone published mock the
 * attempt, API-contract and security specs skip themselves, so CI would report
 * a green run while silently covering less. This script creates (or refreshes)
 * one standalone mock with a handful of published questions.
 *
 * Local D1 only. Refuses --remote so the fixture can never appear on the public
 * site: `src/lib/fixtures.ts` hides it in production.
 *
 *   node scripts/seed-e2e-mock.mjs
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const SLUG = "e2e-local-fixture-mock";
const TITLE = "E2E Local Fixture Mock";
const SECTION = "General Test";
const QUESTION_COUNT = 5;
const MARKING_SCHEME = JSON.stringify({ correct: 5, wrong: -1, unanswered: 0 });
const INSTRUCTIONS = "Local Playwright fixture. Not part of the public catalogue.";

if (process.argv.includes("--remote")) {
  console.error("Refusing to seed the E2E fixture into a remote database.");
  process.exit(1);
}

const stateDir = resolve(process.cwd(), ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
if (!existsSync(stateDir)) {
  console.error("Local D1 state not found. Run `npm run db:migrate:local` first.");
  process.exit(1);
}

const sqliteFile = readdirSync(stateDir)
  .filter((name) => name.endsWith(".sqlite") && !name.includes("backup"))
  .map((name) => ({ name, size: statSync(join(stateDir, name)).size }))
  .sort((a, b) => b.size - a.size)[0]?.name;

if (!sqliteFile) {
  console.error("No local D1 SQLite file found. Run `npm run db:migrate:local` first.");
  process.exit(1);
}

const db = new DatabaseSync(join(stateDir, sqliteFile));
db.exec("PRAGMA foreign_keys = ON");

const columns = new Set(db.prepare("PRAGMA table_info(mock_tests)").all().map((row) => row.name));
if (!columns.has("practice_paper_slug") || !columns.has("current_version_id")) {
  console.error("Database schema is out of date. Run `npm run db:migrate:local` first.");
  db.close();
  process.exit(1);
}

const exam = db.prepare("SELECT id FROM exams ORDER BY id LIMIT 1").get();
if (!exam) {
  console.error("No exam row found. Run `npm run db:seed:local` or the migrations first.");
  db.close();
  process.exit(1);
}

const questions = db
  .prepare(
    `SELECT id, subject_id FROM questions
     WHERE status = 'published'
       AND deleted_at IS NULL
       AND explanation IS NOT NULL
       AND TRIM(explanation) <> ''
       AND text IS NOT NULL
       AND options IS NOT NULL
     ORDER BY id
     LIMIT ?`,
  )
  .all(QUESTION_COUNT);

if (questions.length === 0) {
  console.error("No publishable questions found. Import the local question fixtures first.");
  db.close();
  process.exit(1);
}

// The attempt engine derives the real deadline from the official CUET timing
// rule (question count x seconds per question), not from the stored
// duration_min projection. Keep the fixture's advertised duration identical to
// that rule so the public API and the started attempt cannot disagree.
const subject = db
  .prepare("SELECT name FROM subjects WHERE id = ?")
  .get(questions[0].subject_id);
const subjectName = String(subject?.name ?? "").toLowerCase();
const secondsPerQuestion =
  subjectName.includes("general") || subjectName.includes("aptitude") ? 60 : 72;
const durationMin = Math.max(1, Math.round((questions.length * secondsPerQuestion) / 60));

const totalMarks = questions.length * 5;
const now = new Date().toISOString();

db.exec("BEGIN IMMEDIATE");
try {
  const existing = db.prepare("SELECT id FROM mock_tests WHERE slug = ?").get(SLUG);
  let mockId;
  if (existing) {
    mockId = existing.id;
    db.prepare(
      `UPDATE mock_tests
       SET status = 'draft', deleted_at = NULL, practice_paper_slug = NULL,
           title = ?, exam_id = ?, subject_id = ?
       WHERE id = ?`,
    ).run(TITLE, exam.id, questions[0].subject_id, mockId);
  } else {
    const result = db
      .prepare(
        `INSERT INTO mock_tests
           (exam_id, subject_id, title, slug, type, duration_min, total_marks,
            marking_scheme, instructions, status, version, practice_paper_slug)
         VALUES (?, ?, ?, ?, 'subject', ?, ?, ?, ?, 'draft', 1, NULL)`,
      )
      .run(
        exam.id,
        questions[0].subject_id,
        TITLE,
        SLUG,
        durationMin,
        totalMarks,
        MARKING_SCHEME,
        INSTRUCTIONS,
      );
    mockId = Number(result.lastInsertRowid);
  }

  const nextVersion =
    (db
      .prepare("SELECT COALESCE(MAX(version_no), 0) + 1 AS next FROM mock_test_versions WHERE mock_id = ?")
      .get(mockId)?.next ?? 1);

  // Questions are inserted while the version is still a draft: the immutability
  // trigger freezes membership once a version is published.
  const version = db
    .prepare(
      `INSERT INTO mock_test_versions
         (mock_id, version_no, duration_min, total_marks, marking_scheme, instructions, status)
       VALUES (?, ?, ?, ?, ?, ?, 'draft')`,
    )
    .run(mockId, nextVersion, durationMin, totalMarks, MARKING_SCHEME, INSTRUCTIONS);
  const versionId = Number(version.lastInsertRowid);

  const insertQuestion = db.prepare(
    "INSERT INTO mock_questions (version_id, question_id, section, position) VALUES (?, ?, ?, ?)",
  );
  questions.forEach((question, index) => {
    insertQuestion.run(versionId, question.id, SECTION, index + 1);
  });

  db.prepare(
    "UPDATE mock_test_versions SET status = 'published', published_at = ? WHERE id = ?",
  ).run(now, versionId);
  db.prepare(
    "UPDATE mock_test_versions SET status = 'superseded' WHERE mock_id = ? AND id <> ? AND status = 'published'",
  ).run(mockId, versionId);
  db.prepare(
    `UPDATE mock_tests
     SET status = 'published', current_version_id = ?, version = ?, published_at = ?, deleted_at = NULL
     WHERE id = ?`,
  ).run(versionId, nextVersion, now, mockId);

  db.exec("COMMIT");
  console.log(
    `Seeded ${SLUG} (mock ${mockId}, version ${nextVersion}, ${questions.length} questions, ${durationMin} min).`,
  );
} catch (error) {
  db.exec("ROLLBACK");
  console.error("Failed to seed the E2E mock:", error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
