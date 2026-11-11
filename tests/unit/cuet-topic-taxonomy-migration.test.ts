import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const topicSeed = readFileSync(
  join(process.cwd(), "migrations/0024_seed_cuet_2026_topics.sql"),
  "utf8",
);

describe("CUET topic taxonomy migration", () => {
  it("seeds the official syllabus topics idempotently without guessing question tags", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE exams (id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, is_active INTEGER NOT NULL);
      CREATE TABLE subjects (
        id INTEGER PRIMARY KEY,
        exam_id INTEGER NOT NULL REFERENCES exams(id),
        slug TEXT NOT NULL UNIQUE,
        is_active INTEGER NOT NULL
      );
      CREATE TABLE topics (
        id INTEGER PRIMARY KEY,
        subject_id INTEGER NOT NULL REFERENCES subjects(id),
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        UNIQUE(subject_id, slug)
      );
      INSERT INTO exams (id, slug, is_active) VALUES (1, 'cuet-ug', 1);
      INSERT INTO subjects (id, exam_id, slug, is_active) VALUES
        (1, 1, 'english', 1),
        (2, 1, 'accountancy', 1),
        (3, 1, 'applied-mathematics', 1),
        (4, 1, 'biology', 1),
        (5, 1, 'general-test', 1),
        (6, 1, 'political-science', 1);
    `);

    db.exec(topicSeed);
    const firstCount = db.prepare("SELECT COUNT(*) AS count FROM topics").get() as { count: number };
    expect(firstCount.count).toBeGreaterThan(40);
    expect(
      (db.prepare("SELECT COUNT(*) AS count FROM topics WHERE subject_id = 1").get() as { count: number }).count,
    ).toBe(2);
    expect(
      (db.prepare("SELECT COUNT(*) AS count FROM topics WHERE subject_id = 6").get() as { count: number }).count,
    ).toBe(16);

    db.exec(topicSeed);
    const secondCount = db.prepare("SELECT COUNT(*) AS count FROM topics").get() as { count: number };
    expect(secondCount.count).toBe(firstCount.count);
    expect(topicSeed).not.toMatch(/UPDATE\s+questions|INSERT\s+INTO\s+questions/i);
    db.close();
  });
});
