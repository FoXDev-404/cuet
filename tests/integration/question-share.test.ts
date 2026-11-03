import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createStatementSql,
  moveStatementSql,
  planPublicIdBackfill,
  type BackfillQuestion,
} from "../../src/lib/share/backfill";
import { generatePublicId } from "../../src/lib/share/public-id";

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
];

function migrate(names: string[] = MIGRATIONS): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const name of names) {
    const sql = readFileSync(
      fileURLToPath(new URL(`../../migrations/${name}`, import.meta.url)),
      "utf8",
    );
    db.exec(sql);
  }
  return db;
}

function seedSubject(db: DatabaseSync): number {
  db.exec(`
    INSERT INTO exams (name, slug) VALUES ('CUET UG', 'cuet-ug');
    INSERT INTO subjects (exam_id, name, slug, type) VALUES (1, 'English', 'english', 'language');
  `);
  return 1;
}

function insertQuestion(
  db: DatabaseSync,
  input: {
    text: string;
    status?: "draft" | "in_review" | "published";
    supersedes?: number | null;
    year?: number | null;
    explanation?: string | null;
    deleted?: boolean;
  },
): number {
  const result = db
    .prepare(
      `INSERT INTO questions
         (subject_id, text, options, correct_option, explanation, year, status, supersedes_id, deleted_at)
       VALUES (1, ?, '[{"text":"A"},{"text":"B"}]', 0, ?, ?, ?, ?,
               ?)`,
    )
    .run(
      input.text,
      input.explanation === undefined ? "Original explanation." : input.explanation,
      input.year ?? null,
      input.status ?? "published",
      input.supersedes ?? null,
      input.deleted ? "2026-11-02T00:00:00.000Z" : null,
    );
  return Number(result.lastInsertRowid);
}

function mappings(db: DatabaseSync): Array<{ public_id: string; current_question_id: number }> {
  return db
    .prepare("SELECT public_id, current_question_id FROM question_public_ids ORDER BY public_id")
    .all() as Array<{ public_id: string; current_question_id: number }>;
}

function planFor(db: DatabaseSync, questions: BackfillQuestion[]) {
  return planPublicIdBackfill(
    questions,
    mappings(db) as Array<{ public_id: string; current_question_id: number }>,
    generatePublicId,
  );
}

describe("question share migration", () => {
  it("creates the public id and share event tables on an empty database", () => {
    const db = migrate();
    const tables = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all() as Array<{ name: string }>
    ).map((row) => row.name);
    expect(tables).toContain("question_public_ids");
    expect(tables).toContain("share_events");

    const columns = (
      db.prepare("PRAGMA table_info(question_public_ids)").all() as Array<{ name: string }>
    ).map((row) => row.name);
    expect(columns).toEqual([
      "public_id",
      "current_question_id",
      "share_enabled",
      "reveal_policy",
      "seo_indexable",
      "rights_ok",
      "created_at",
    ]);

    const indexes = (
      db.prepare("PRAGMA index_list(question_public_ids)").all() as Array<{ name: string }>
    ).map((row) => row.name);
    expect(indexes).toContain("uq_qpid_current");

    const mockIndexes = (
      db.prepare("PRAGMA index_list(mock_questions)").all() as Array<{ name: string }>
    ).map((row) => row.name);
    expect(mockIndexes).toContain("idx_mq_question");

    const triggers = (
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'").all() as Array<{
        name: string;
      }>
    ).map((row) => row.name);
    expect(triggers).toContain("trg_question_public_id_move");
  });

  it("backfills one unique id per lineage head and keeps PYQ rows off by default", () => {
    const db = migrate();
    seedSubject(db);
    const original = insertQuestion(db, { text: "Original current question?" });
    const q1 = insertQuestion(db, { text: "Old revision?", status: "published" });
    const q2 = insertQuestion(db, {
      text: "Newest revision?",
      status: "draft",
      supersedes: q1,
    });
    const pyq = insertQuestion(db, {
      text: "Previous-year question?",
      year: 2024,
      explanation: "Printed key.",
    });
    const deleted = insertQuestion(db, {
      text: "Deleted question?",
      deleted: true,
    });

    const questions: BackfillQuestion[] = db
      .prepare("SELECT id, supersedes_id, deleted_at, year FROM questions ORDER BY id")
      .all() as BackfillQuestion[];
    const plan = planFor(db, questions);

    expect(plan.conflicts).toEqual([]);
    expect(plan.move).toEqual([]);
    expect(plan.create.map((entry) => entry.questionId).sort((a, b) => a - b)).toEqual(
      [original, q2, pyq].sort((a, b) => a - b),
    );
    expect(plan.create.find((entry) => entry.questionId === q2)?.shareEnabled).toBe(1);
    expect(plan.create.find((entry) => entry.questionId === pyq)?.shareEnabled).toBe(0);
    expect(plan.create.some((entry) => entry.questionId === deleted)).toBe(false);
    expect(new Set(plan.create.map((entry) => entry.publicId)).size).toBe(plan.create.length);

    db.exec(createStatementSql(plan));
    const rows = mappings(db);
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => /^[0-9A-Za-z]{10}$/.test(row.public_id))).toBe(true);
    expect(rows.some((row) => row.current_question_id === q1)).toBe(false);
  });

  it("moves the pointer atomically when a revision row is inserted", () => {
    const db = migrate();
    seedSubject(db);
    const q1 = insertQuestion(db, { text: "First version?" });
    const publicId = generatePublicId();
    db.prepare(
      `INSERT INTO question_public_ids (public_id, current_question_id, share_enabled)
       VALUES (?, ?, 1)`,
    ).run(publicId, q1);

    const q2 = insertQuestion(db, { text: "Second version?", supersedes: q1 });
    expect(mappings(db)).toEqual([{ public_id: publicId, current_question_id: q2 }]);

    const q3 = insertQuestion(db, { text: "Third version?", supersedes: q2 });
    expect(mappings(db)).toEqual([{ public_id: publicId, current_question_id: q3 }]);
  });

  it("moves an existing mapping to the latest non-deleted head during backfill", () => {
    const db = migrate();
    seedSubject(db);
    const q1 = insertQuestion(db, { text: "Old version?" });
    const q2 = insertQuestion(db, { text: "Current draft?", status: "draft", supersedes: q1 });
    const publicId = generatePublicId();
    db.prepare(
      `INSERT INTO question_public_ids (public_id, current_question_id, share_enabled)
       VALUES (?, ?, 1)`,
    ).run(publicId, q1);

    const questions: BackfillQuestion[] = db
      .prepare("SELECT id, supersedes_id, deleted_at, year FROM questions ORDER BY id")
      .all() as BackfillQuestion[];
    const plan = planFor(db, questions);
    expect(plan.create).toEqual([]);
    expect(plan.move).toEqual([{ publicId, questionId: q2 }]);

    db.exec(moveStatementSql(plan));
    expect(mappings(db)).toEqual([{ public_id: publicId, current_question_id: q2 }]);
  });

  it("never creates an id for a fully deleted lineage and enforces one id per question", () => {
    const db = migrate();
    seedSubject(db);
    const deleted = insertQuestion(db, { text: "Only a deleted row?", deleted: true });
    const questions: BackfillQuestion[] = db
      .prepare("SELECT id, supersedes_id, deleted_at, year FROM questions ORDER BY id")
      .all() as BackfillQuestion[];
    expect(planFor(db, questions).create).toEqual([]);

    const live = insertQuestion(db, { text: "Live question?" });
    const first = generatePublicId();
    db.prepare(
      `INSERT INTO question_public_ids (public_id, current_question_id) VALUES (?, ?)`,
    ).run(first, live);
    expect(() =>
      db
        .prepare(
          `INSERT INTO question_public_ids (public_id, current_question_id) VALUES (?, ?)`,
        )
        .run(generatePublicId(), live),
    ).toThrow(/UNIQUE constraint failed/);
    expect(deleted).toBeGreaterThan(0);
  });

  it("validates reveal and share event values at the database boundary", () => {
    const db = migrate();
    seedSubject(db);
    const questionId = insertQuestion(db, { text: "Reveal policy question?" });

    expect(() =>
      db
        .prepare(
          `INSERT INTO question_public_ids (public_id, current_question_id, reveal_policy)
           VALUES (?, ?, 'always')`,
        )
        .run(generatePublicId(), questionId),
    ).toThrow(/CHECK constraint failed/);

    expect(() =>
      db
        .prepare(
          `INSERT INTO share_events (public_id, context, channel) VALUES (?, 'result', 'copy')`,
        )
        .run(generatePublicId()),
    ).toThrow(/CHECK constraint failed/);

    db.prepare(
      `INSERT INTO share_events (public_id, context, channel) VALUES (?, 'solutions', 'copy')`,
    ).run(generatePublicId());
    expect(
      (db.prepare("SELECT COUNT(*) AS count FROM share_events").get() as { count: number }).count,
    ).toBe(1);
  });
});
