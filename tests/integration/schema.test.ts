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
  "0020_exam_info_seed.sql",
];

function apply(db: DatabaseSync, names: string[]): void {
  for (const name of names) {
    const sql = readFileSync(fileURLToPath(new URL(`../../migrations/${name}`, import.meta.url)), "utf8");
    db.exec(sql);
  }
}

function migrate(names: string[] = MIGRATIONS): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  apply(db, names);
  return db;
}

function seed(db: DatabaseSync): {
  mockId: number;
  versionId: number;
  questionId: number;
  userId: number;
} {
  db.exec(`
    INSERT INTO exams (name, slug) VALUES ('CUET UG', 'cuet-ug');
    INSERT INTO subjects (exam_id, name, slug, type) VALUES (1, 'English', 'english', 'language');
    INSERT INTO questions (subject_id, text, options, correct_option, status)
      VALUES (1, 'Question one?', '[{"text":"A"},{"text":"B"}]', 0, 'published');
    INSERT INTO mock_tests
      (exam_id, subject_id, title, slug, type, duration_min, total_marks, marking_scheme, status)
      VALUES (1, 1, 'Sample Paper', 'sample-paper', 'full', 60, 100, '{"correct":4,"wrong":-1,"skipped":0}', 'draft');
    INSERT INTO mock_test_versions
      (mock_id, version_no, duration_min, total_marks, marking_scheme, status)
      VALUES (1, 1, 60, 100, '{"correct":4,"wrong":-1,"skipped":0}', 'draft');
    INSERT INTO mock_questions (version_id, question_id, section, position)
      VALUES (1, 1, 'English', 1);
    INSERT INTO users (username, email, password_hash) VALUES ('student', 'student@example.com', 'x');
  `);
  return { mockId: 1, versionId: 1, questionId: 1, userId: 1 };
}

function publish(db: DatabaseSync, versionId: number): void {
  db.exec(`UPDATE mock_test_versions SET status = 'published' WHERE id = ${versionId}`);
  db.exec(`UPDATE mock_tests SET status = 'published', current_version_id = ${versionId} WHERE id = 1`);
}

function blueprintContract(): Map<string, string[]> {
  const markdown = readFileSync(
    fileURLToPath(new URL("../../docs/CUET_MOCK_TEST_BLUEPRINT_v2.md", import.meta.url)),
    "utf8",
  );
  const section = markdown.indexOf("### 5.2");
  const fenceStart = markdown.indexOf("```sql", section);
  const fenceEnd = markdown.indexOf("```", fenceStart + 6);
  if (section < 0 || fenceStart < 0 || fenceEnd < 0) {
    throw new Error("Could not find the blueprint section 5.2 SQL block");
  }
  const reference = new DatabaseSync(":memory:");
  reference.exec(markdown.slice(fenceStart + 6, fenceEnd));

  const tables = reference
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[];
  const contract = new Map<string, string[]>();
  for (const { name } of tables) {
    const columns = reference.prepare(`PRAGMA table_info("${name}")`).all() as { name: string }[];
    contract.set(name, columns.map((column) => column.name));
  }
  return contract;
}

describe("blueprint v2 migration contract", () => {
  it("applies every migration to an empty database and keeps the blueprint tables and columns", () => {
    const db = migrate();
    const contract = blueprintContract();
    expect(contract.size).toBe(27);

    const actualTables = new Set(
      (
        db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
          .all() as { name: string }[]
      ).map((table) => table.name),
    );

    for (const [table, expectedColumns] of contract) {
      expect(actualTables.has(table)).toBe(true);
      const actualColumns = new Set(
        (db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map(
          (column) => column.name,
        ),
      );
      for (const column of expectedColumns) {
        expect(actualColumns.has(column)).toBe(true);
      }
    }

    const statusIndex = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_mocks_status'")
      .get() as { sql: string };
    expect(statusIndex.sql).toMatch(/\(status, type\)/);

    const leaderboardIndex = db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_attempts_leaderboard'",
      )
      .get() as { sql: string };
    expect(leaderboardIndex.sql).toMatch(/\(version_id, score DESC, time_taken_sec ASC\)/);
  });

  it("migrates a populated legacy database without changing stored scores", () => {
    const db = migrate(["0001_init.sql"]);
    db.exec(`
      INSERT INTO exams (name, slug) VALUES ('CUET UG', 'cuet-ug');
      INSERT INTO subjects (exam_id, name, slug, type) VALUES (1, 'English', 'english', 'language');
      INSERT INTO questions (subject_id, text, options, correct_option, status)
        VALUES (1, 'Legacy question?', '[{"text":"A"},{"text":"B"}]', 0, 'published');
      INSERT INTO mock_tests
        (exam_id, subject_id, title, slug, type, duration_min, total_marks, marking_scheme,
         status, version, published_at)
        VALUES (1, 1, 'Legacy Paper', 'legacy-paper', 'full', 60, 100,
                '{"correct":4,"wrong":-1,"skipped":0}', 'published', 2,
                '2026-01-01T00:00:00.000Z');
      INSERT INTO mock_tests
        (exam_id, subject_id, title, slug, type, duration_min, total_marks, marking_scheme,
         pyq_year, pyq_shift, status, published_at)
        VALUES (1, 1, 'Legacy PYQ 2022', 'legacy-pyq-2022', 'pyq', 45, 50,
                '{"correct":4,"wrong":-1,"skipped":0}', 2022, 'Shift 1', 'published',
                '2026-01-02T00:00:00.000Z');
      INSERT INTO mock_questions (mock_id, question_id, section, position)
        VALUES (1, 1, 'English', 1);
      INSERT INTO users (username, email, password_hash)
        VALUES ('legacy', 'legacy@example.com', 'x');
      INSERT INTO attempts
        (user_id, mock_id, status, score, correct, wrong, skipped, time_taken_sec,
         started_at, deadline_at, submitted_at, is_first_attempt)
        VALUES (1, 1, 'submitted', 73.5, 19, 2, 1, 1800,
                '2026-01-01T00:00:00.000Z', '2026-01-01T01:00:00.000Z',
                '2026-01-01T00:30:00.000Z', 1);
      INSERT INTO attempt_answers
        (attempt_id, question_id, selected, time_spent_sec, marked_for_review, is_correct)
        VALUES (1, 1, 0, 42, 1, 1);
    `);

    apply(db, MIGRATIONS.slice(1));

    const version = db
      .prepare("SELECT id, version_no, status FROM mock_test_versions WHERE mock_id = 1")
      .get() as { id: number; version_no: number; status: string };
    expect(version.version_no).toBe(2);
    expect(version.status).toBe("published");

    const mock = db
      .prepare("SELECT current_version_id FROM mock_tests WHERE id = 1")
      .get() as { current_version_id: number };
    expect(mock.current_version_id).toBe(version.id);

    const attempt = db
      .prepare(
        "SELECT version_id, status, score, correct, wrong, skipped, time_taken_sec, is_first_attempt FROM attempts WHERE id = 1",
      )
      .get() as {
      version_id: number;
      status: string;
      score: number;
      correct: number;
      wrong: number;
      skipped: number;
      time_taken_sec: number;
      is_first_attempt: number;
    };
    expect(attempt).toMatchObject({
      version_id: version.id,
      status: "submitted",
      score: 73.5,
      correct: 19,
      wrong: 2,
      skipped: 1,
      time_taken_sec: 1800,
      is_first_attempt: 1,
    });

    const answer = db
      .prepare(
        "SELECT selected, time_spent_sec, marked_for_review, is_correct FROM attempt_answers WHERE attempt_id = 1",
      )
      .get() as {
      selected: number;
      time_spent_sec: number;
      marked_for_review: number;
      is_correct: number;
    };
    expect(answer).toMatchObject({
      selected: 0,
      time_spent_sec: 42,
      marked_for_review: 1,
      is_correct: 1,
    });

    const current = db
      .prepare("SELECT version_id, question_id FROM mock_questions_current WHERE mock_id = 1")
      .get() as { version_id: number; question_id: number };
    expect(current).toMatchObject({ version_id: version.id, question_id: 1 });

    const pyq = db
      .prepare("SELECT id, year, shift, title FROM pyq_papers WHERE year = 2022")
      .get() as { id: number; year: number; shift: string; title: string };
    expect(pyq).toMatchObject({ year: 2022, shift: "Shift 1", title: "Legacy PYQ 2022" });

    const pyqMock = db
      .prepare("SELECT pyq_paper_id FROM mock_tests WHERE id = 2")
      .get() as { pyq_paper_id: number };
    expect(pyqMock.pyq_paper_id).toBe(pyq.id);

    const seo = db.prepare("PRAGMA table_info(page_seo)").all() as { name: string }[];
    expect(seo.map((column) => column.name)).toContain("canonical_url");
  });
});

describe("blueprint v2 database invariants", () => {
  it("freezes a published version and its question membership", () => {
    const db = migrate();
    const { versionId, questionId } = seed(db);
    publish(db, versionId);

    expect(() =>
      db.exec(`UPDATE mock_test_versions SET duration_min = 999 WHERE id = ${versionId}`),
    ).toThrow(/immutable/i);
    expect(() => db.exec(`DELETE FROM mock_test_versions WHERE id = ${versionId}`)).toThrow(
      /cannot be deleted/i,
    );
    expect(() =>
      db.exec(`INSERT INTO mock_questions (version_id, question_id, section, position) VALUES (${versionId}, 1, 'English', 2)`),
    ).toThrow(/frozen/i);
    expect(() =>
      db.exec(`UPDATE mock_questions SET position = 3 WHERE version_id = ${versionId}`),
    ).toThrow(/frozen/i);
    expect(() =>
      db.exec(`DELETE FROM mock_questions WHERE version_id = ${versionId}`),
    ).toThrow(/frozen/i);

    // Published question content is frozen, but a soft delete is still allowed.
    expect(() => db.exec(`UPDATE questions SET text = 'Rewritten' WHERE id = ${questionId}`)).toThrow(
      /immutable/i,
    );
    expect(() => db.exec(`UPDATE questions SET correct_option = 1 WHERE id = ${questionId}`)).toThrow(
      /immutable/i,
    );
    expect(() =>
      db.exec(`UPDATE questions SET deleted_at = '2026-10-31T00:00:00.000Z' WHERE id = ${questionId}`),
    ).not.toThrow();
  });

  it("allows publishing a correction and superseding the old version", () => {
    const db = migrate();
    const { versionId, questionId } = seed(db);
    publish(db, versionId);

    db.exec(`
      INSERT INTO mock_test_versions
        (mock_id, version_no, duration_min, total_marks, marking_scheme, status)
        VALUES (1, 2, 60, 100, '{"correct":4,"wrong":-1,"skipped":0}', 'draft');
      INSERT INTO mock_questions (version_id, question_id, section, position)
        VALUES (2, ${questionId}, 'English', 1);
      UPDATE mock_test_versions SET status = 'superseded' WHERE id = ${versionId};
      UPDATE mock_test_versions SET status = 'published' WHERE id = 2;
      UPDATE mock_tests SET current_version_id = 2 WHERE id = 1;
    `);

    expect(() =>
      db.exec(`UPDATE mock_test_versions SET total_marks = 50 WHERE id = 1`),
    ).toThrow(/immutable/i);
    expect(() =>
      db.exec(`UPDATE mock_test_versions SET status = 'published' WHERE id = 1`),
    ).toThrow(/immutable/i);

    const rows = db.prepare("SELECT status FROM mock_test_versions ORDER BY id").all() as {
      status: string;
    }[];
    expect(rows.map((row) => row.status)).toEqual(["superseded", "published"]);
  });

  it("enforces one ranked first attempt per user and mock", () => {
    const db = migrate();
    const { versionId, userId } = seed(db);
    publish(db, versionId);

    const insert = (first: number) =>
      db.exec(`
        INSERT INTO attempts
          (user_id, mock_id, version_id, status, score, correct, wrong, skipped, time_taken_sec,
           started_at, deadline_at, submitted_at, is_first_attempt)
        VALUES (${userId}, 1, ${versionId}, 'submitted', 10, 3, 1, 0, 60,
                '2026-10-31T00:00:00.000Z', '2026-10-31T01:00:00.000Z',
                '2026-10-31T00:30:00.000Z', ${first})
      `);

    insert(1);
    expect(() => insert(1)).toThrow(/UNIQUE/i);
    expect(() => insert(0)).not.toThrow();
  });
});
