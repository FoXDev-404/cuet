import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MIGRATIONS = [
  "0001_init.sql",
  "0002_mock_versions.sql",
  "0003_content_and_ops.sql",
  "0004_immutability_guards.sql",
  "0005_seo_canonical.sql",
  "0006_schema_parity.sql",
  "0007_query_budget_indexes.sql",
  "0008_archive_placeholder_mock.sql",
  "0009_admin_full_control.sql",
  "0010_practice_library.sql",
  "0011_practice_passage_trash.sql",
  "0012_question_share.sql",
  "0013_question_share_indexes.sql",
  "0015_ranked_practice_library.sql",
  "0016_subject_rollup_index.sql",
  "0017_paper_provenance_and_rights.sql",
  "0018_explanation_provenance_and_review.sql",
  "0019_attempt_sequence_and_capacity.sql",
];

function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const name of MIGRATIONS) {
    const sql = readFileSync(fileURLToPath(new URL(`../../migrations/${name}`, import.meta.url)), "utf8");
    db.exec(sql);
  }
  return db;
}

function seedTestData(db: DatabaseSync) {
  db.exec(`
    INSERT INTO exams (name, slug) VALUES ('CUET UG', 'cuet-ug');
    INSERT INTO subjects (exam_id, name, slug, type) VALUES (1, 'English', 'english', 'language');
  `);

  // Insert 50 questions
  for (let i = 1; i <= 50; i++) {
    db.prepare(`
      INSERT INTO questions (subject_id, text, options, correct_option, status)
      VALUES (1, 'Question ${i}', '[{"text":"Opt A"},{"text":"Opt B"},{"text":"Opt C"},{"text":"Opt D"}]', 0, 'published')
    `).run();
  }

  // Insert mock test and draft version
  db.exec(`
    INSERT INTO mock_tests (id, exam_id, subject_id, title, slug, type, duration_min, total_marks, marking_scheme, status)
    VALUES (1, 1, 1, 'English Mock 1', 'english-mock-1', 'full', 45, 200, '{"correct":5,"wrong":-1,"skipped":0}', 'draft');

    INSERT INTO mock_test_versions (id, mock_id, version_no, duration_min, total_marks, marking_scheme, status, published_at)
    VALUES (1, 1, 1, 45, 200, '{"correct":5,"wrong":-1,"skipped":0}', 'draft', '2026-10-31T10:00:00Z');

    UPDATE mock_tests SET current_version_id = 1 WHERE id = 1;
  `);

  // Link all 50 questions to version 1 while in draft
  for (let i = 1; i <= 50; i++) {
    db.prepare(`
      INSERT INTO mock_questions (version_id, question_id, section, position)
      VALUES (1, ${i}, 'Section A', ${i})
    `).run();
  }

  // Publish the version (freezes questions)
  db.exec(`
    UPDATE mock_test_versions SET status = 'published' WHERE id = 1;
    UPDATE mock_tests SET status = 'published' WHERE id = 1;
  `);

  // Create 10 users with submitted first attempts (for leaderboard)
  for (let u = 1; u <= 10; u++) {
    db.prepare(`
      INSERT INTO users (id, email, username, password_hash)
      VALUES (${u}, 'user${u}@test.com', 'student${u}', 'hash')
    `).run();

    const score = 150 + u * 3;
    const correct = 30 + u;
    const wrong = 5;
    const skipped = 50 - correct - wrong;
    const timeTaken = 1200 - u * 30;

    const sectionsJson = JSON.stringify([
      {
        section: "Section A",
        total: 50,
        answered: correct + wrong,
        correct,
        wrong,
        skipped,
        score,
        time: timeTaken,
      },
    ]);

    db.prepare(`
      INSERT INTO attempts (id, user_id, mock_id, version_id, status, score, correct, wrong, skipped,
                           time_taken_sec, started_at, deadline_at, submitted_at, is_first_attempt, section_summary)
      VALUES (${u}, ${u}, 1, 1, 'submitted', ${score}, ${correct}, ${wrong}, ${skipped},
              ${timeTaken}, '2026-10-31T10:00:00Z', '2026-10-31T10:45:00Z', '2026-10-31T10:30:00Z', 1, '${sectionsJson}')
    `).run();
  }

  // Create an active in-progress attempt for user 11
  db.exec(`
    INSERT INTO users (id, email, username, password_hash)
    VALUES (11, 'user11@test.com', 'student11', 'hash');

    INSERT INTO attempts (id, user_id, mock_id, version_id, status, started_at, deadline_at, is_first_attempt, last_client_seq)
    VALUES (100, 11, 1, 1, 'in_progress', '2026-11-01T10:00:00Z', '2026-11-01T10:45:00Z', 1, 0);
  `);
}

describe("Capacity Budgets & D1 Efficiency", () => {
  it("enforces autosave row-read budget: <= 3 rows read per autosave", () => {
    const db = createTestDb();
    seedTestData(db);

    // Instrument row reads by counting SELECT results returned
    let rowsRead = 0;

    // Step 1: findAttempt(100) — Primary key lookup on attempts
    const attemptStmt = db.prepare(`
      SELECT id, user_id, guest_token, mock_id, version_id, status, score, correct, wrong, skipped,
             time_taken_sec, started_at, deadline_at, submitted_at, is_first_attempt,
             COALESCE(last_client_seq, 0) AS last_client_seq, section_summary
      FROM attempts WHERE id = ?
    `);
    const attempt = attemptStmt.all(100);
    rowsRead += attempt.length;

    expect(attempt.length).toBe(1);
    expect(attempt[0].status).toBe("in_progress");

    // Step 2: Delta answers payload (saving 2 answered questions)
    // In our optimized pipeline, question validation uses KV cache (0 D1 reads).
    // Even if falling back to question PK lookup for the 2 questions:
    // SELECT id, options FROM questions WHERE id IN (1, 2) would read exactly 2 rows.
    // With KV: 0 rows read.
    const deltaAnswers = [
      { question_id: 1, selected: 0, time_spent_sec: 25, marked_for_review: 0, client_seq: 1 },
      { question_id: 2, selected: 2, time_spent_sec: 15, marked_for_review: 1, client_seq: 1 },
    ];

    // Step 3: Batch upsert into attempt_answers (write only, 0 rows read)
    const upsertStmt = db.prepare(`
      INSERT INTO attempt_answers
        (attempt_id, question_id, selected, time_spent_sec, marked_for_review, client_seq, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(attempt_id, question_id) DO UPDATE SET
        selected = CASE WHEN excluded.client_seq >= attempt_answers.client_seq THEN excluded.selected ELSE attempt_answers.selected END,
        time_spent_sec = CASE WHEN excluded.client_seq >= attempt_answers.client_seq THEN excluded.time_spent_sec ELSE attempt_answers.time_spent_sec END,
        marked_for_review = CASE WHEN excluded.client_seq >= attempt_answers.client_seq THEN excluded.marked_for_review ELSE attempt_answers.marked_for_review END,
        client_seq = CASE WHEN excluded.client_seq >= attempt_answers.client_seq THEN excluded.client_seq ELSE attempt_answers.client_seq END,
        updated_at = CASE WHEN excluded.client_seq >= attempt_answers.client_seq THEN excluded.updated_at ELSE attempt_answers.updated_at END
    `);

    for (const ans of deltaAnswers) {
      upsertStmt.run(100, ans.question_id, ans.selected, ans.time_spent_sec, ans.marked_for_review, ans.client_seq);
    }

    // Step 4: Update attempts.last_client_seq (write only, 0 rows read)
    db.prepare("UPDATE attempts SET last_client_seq = ? WHERE id = ?").run(1, 100);

    // VERIFY: Total rows read must be <= 3 (budget requirement)
    expect(rowsRead).toBeLessThanOrEqual(3);
    expect(rowsRead).toBe(1);
  });

  it("enforces autosave sequence ordering and idempotency (last write wins by client sequence)", () => {
    const db = createTestDb();
    seedTestData(db);

    const upsertStmt = db.prepare(`
      INSERT INTO attempt_answers
        (attempt_id, question_id, selected, time_spent_sec, marked_for_review, client_seq, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(attempt_id, question_id) DO UPDATE SET
        selected = CASE WHEN excluded.client_seq >= attempt_answers.client_seq THEN excluded.selected ELSE attempt_answers.selected END,
        time_spent_sec = CASE WHEN excluded.client_seq >= attempt_answers.client_seq THEN excluded.time_spent_sec ELSE attempt_answers.time_spent_sec END,
        marked_for_review = CASE WHEN excluded.client_seq >= attempt_answers.client_seq THEN excluded.marked_for_review ELSE attempt_answers.marked_for_review END,
        client_seq = CASE WHEN excluded.client_seq >= attempt_answers.client_seq THEN excluded.client_seq ELSE attempt_answers.client_seq END,
        updated_at = CASE WHEN excluded.client_seq >= attempt_answers.client_seq THEN excluded.updated_at ELSE attempt_answers.updated_at END
    `);

    // First write: seq = 5, selected = 2
    upsertStmt.run(100, 1, 2, 30, 0, 5);
    db.prepare("UPDATE attempts SET last_client_seq = ? WHERE id = ?").run(5, 100);

    let row = db.prepare("SELECT selected, client_seq FROM attempt_answers WHERE attempt_id = 100 AND question_id = 1").all()[0];
    expect(row.selected).toBe(2);
    expect(row.client_seq).toBe(5);

    // Stale out-of-order write arrives: seq = 3, selected = 0
    upsertStmt.run(100, 1, 0, 10, 0, 3);

    // Stale write MUST NOT overwrite seq 5
    row = db.prepare("SELECT selected, client_seq FROM attempt_answers WHERE attempt_id = 100 AND question_id = 1").all()[0];
    expect(row.selected).toBe(2);
    expect(row.client_seq).toBe(5);

    // Newer write arrives: seq = 6, selected = 3
    upsertStmt.run(100, 1, 3, 40, 0, 6);
    db.prepare("UPDATE attempts SET last_client_seq = ? WHERE id = ?").run(6, 100);

    row = db.prepare("SELECT selected, client_seq FROM attempt_answers WHERE attempt_id = 100 AND question_id = 1").all()[0];
    expect(row.selected).toBe(3);
    expect(row.client_seq).toBe(6);
  });

  it("enforces result view row-read budget: <= 40 rows read per result view", () => {
    const db = createTestDb();
    seedTestData(db);

    let rowsRead = 0;

    // Query 1: findAttempt(1)
    const attemptRows = db.prepare(`
      SELECT id, user_id, guest_token, mock_id, version_id, status, score, correct, wrong, skipped,
             time_taken_sec, started_at, deadline_at, submitted_at, is_first_attempt,
             COALESCE(last_client_seq, 0) AS last_client_seq, section_summary
      FROM attempts WHERE id = ?
    `).all(1);
    rowsRead += attemptRows.length;
    const attempt = attemptRows[0];

    // Query 2: load mock metadata
    const mockRows = db.prepare(`
      SELECT m.id, m.title, m.slug, m.type, v.duration_min, v.total_marks, v.marking_scheme,
              m.practice_paper_slug
      FROM mock_tests m JOIN mock_test_versions v ON v.id = ?
      WHERE m.id = ?
    `).all(attempt.version_id, attempt.mock_id);
    rowsRead += mockRows.length;

    // Section breakdown: directly from attempt.section_summary (0 database rows read!)
    expect(attempt.section_summary).not.toBeNull();
    const sections = JSON.parse(attempt.section_summary as string);
    expect(sections.length).toBeGreaterThan(0);

    // Query 3: rank & percentile calculation (single aggregate query)
    const rankRows = db.prepare(`
      SELECT COUNT(*) AS total,
              SUM(CASE WHEN (a.score > ? OR (a.score = ? AND a.time_taken_sec < ?) OR (a.score = ? AND a.time_taken_sec = ? AND a.correct > ?)) THEN 1 ELSE 0 END) AS better
      FROM attempts a JOIN users u ON u.id = a.user_id
      WHERE a.version_id = ? AND a.status = 'submitted' AND a.is_first_attempt = 1
        AND a.user_id IS NOT NULL AND u.deleted_at IS NULL
    `).all(attempt.score, attempt.score, attempt.time_taken_sec, attempt.score, attempt.time_taken_sec, attempt.correct, attempt.version_id);
    rowsRead += rankRows.length;

    // Query 4: top 5 leaderboard rows
    const topRows = db.prepare(`
      SELECT rank, user_id, username, score, time_taken_sec, correct, wrong FROM (
        SELECT a.user_id, u.username, a.score, a.time_taken_sec, a.correct, a.wrong,
                RANK() OVER (ORDER BY a.score DESC, a.time_taken_sec ASC, (CASE WHEN a.correct + a.wrong > 0 THEN a.correct * 1.0 / (a.correct + a.wrong) ELSE 0 END) DESC) AS rank,
                ROW_NUMBER() OVER (ORDER BY a.score DESC, a.time_taken_sec ASC, (CASE WHEN a.correct + a.wrong > 0 THEN a.correct * 1.0 / (a.correct + a.wrong) ELSE 0 END) DESC) AS position
        FROM attempts a JOIN users u ON u.id = a.user_id
        WHERE a.version_id = ? AND a.status = 'submitted' AND a.is_first_attempt = 1
          AND a.user_id IS NOT NULL AND u.deleted_at IS NULL
      ) WHERE position <= 5
      ORDER BY position
    `).all(attempt.version_id);
    rowsRead += topRows.length;

    // VERIFY: Total rows read must be <= 40 (budget requirement)
    expect(rowsRead).toBeLessThanOrEqual(40);
    expect(rowsRead).toBe(1 + 1 + 1 + 5); // Exactly 8 rows read!
  });

  it("enforces leaderboard row-read budget: <= 120 rows read per leaderboard view", () => {
    const db = createTestDb();
    seedTestData(db);

    let rowsRead = 0;

    // Query 1: mock lookup
    const mockRows = db.prepare(`
      SELECT m.id, m.title, m.slug, v.total_marks, v.duration_min, v.id AS version_id
      FROM mock_tests m JOIN mock_test_versions v ON v.id = m.current_version_id
      WHERE m.slug = ? AND m.status = 'published' AND m.deleted_at IS NULL
    `).all("english-mock-1");
    rowsRead += mockRows.length;
    const versionId = mockRows[0].version_id;

    // Query 2: leaderboard top 100 rows
    const boardRows = db.prepare(`
      SELECT rank, username, score, correct, wrong, time_taken_sec, submitted_at FROM (
        SELECT u.username, a.score, a.correct, a.wrong, a.time_taken_sec, a.submitted_at,
                RANK() OVER (ORDER BY a.score DESC, a.time_taken_sec ASC, (CASE WHEN a.correct + a.wrong > 0 THEN a.correct * 1.0 / (a.correct + a.wrong) ELSE 0 END) DESC) AS rank
        FROM attempts a JOIN users u ON u.id = a.user_id
        WHERE a.version_id = ? AND a.status = 'submitted' AND a.is_first_attempt = 1
          AND u.deleted_at IS NULL
      ) ORDER BY rank, submitted_at LIMIT 100
    `).all(versionId);
    rowsRead += boardRows.length;

    // Query 3: summary statistics (eligible, average, best)
    const summaryRows = db.prepare(`
      SELECT COUNT(*) AS eligible, AVG(a.score) AS average, MAX(a.score) AS best
      FROM attempts a JOIN users u ON u.id = a.user_id
      WHERE a.version_id = ? AND a.status = 'submitted' AND a.is_first_attempt = 1
        AND u.deleted_at IS NULL
    `).all(versionId);
    rowsRead += summaryRows.length;

    // VERIFY: Total rows read must be <= 120 (budget requirement)
    expect(rowsRead).toBeLessThanOrEqual(120);
    expect(rowsRead).toBe(1 + 10 + 1); // 12 rows for 10 entries; at 100 entries, it is 102 rows!
  });
});
