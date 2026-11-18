import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { MIN_LISTED_QUESTIONS } from "../../src/lib/local-papers";
import {
  parsePracticeTopicCsv,
  planPracticeTopicUpdates,
  PRACTICE_TOPIC_MIN_QUESTIONS,
  practiceTopicCountSql,
  type PracticeTopicContext,
} from "../../src/lib/practice-topics";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

function context(overrides: Partial<PracticeTopicContext> = {}): PracticeTopicContext {
  return {
    papers: new Map([["chemistry-2026-06-06-shift-1", { subjectId: 3 }]]),
    questionKeys: new Map([
      ["chemistry-2026-06-06-shift-1", new Set(["q01", "q02"])],
    ]),
    topics: new Map([
      ["3:chemical-bonding", { id: 41, subjectId: 3 }],
      ["3:thermodynamics", { id: 42, subjectId: 3 }],
    ]),
    ...overrides,
  };
}

describe("practice topic CSV", () => {
  it("parses a header, comments and duplicate identical rows", () => {
    const parsed = parsePracticeTopicCsv(
      [
        "\uFEFF# editor mapping",
        "paper_slug,question_key,topic_slug",
        "chemistry-2026-06-06-shift-1,q01,chemical-bonding",
        "chemistry-2026-06-06-shift-1,q01,chemical-bonding",
        "",
        "chemistry-2026-06-06-shift-1,q02,thermodynamics",
      ].join("\r\n"),
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toEqual([
      {
        paperSlug: "chemistry-2026-06-06-shift-1",
        questionKey: "q01",
        topicSlug: "chemical-bonding",
      },
      {
        paperSlug: "chemistry-2026-06-06-shift-1",
        questionKey: "q02",
        topicSlug: "thermodynamics",
      },
    ]);
  });

  it("reports bad columns, bad slugs and conflicting tags", () => {
    const parsed = parsePracticeTopicCsv(
      [
        "chemistry-2026-06-06-shift-1,q01",
        "Chemistry Paper,q01,chemical-bonding",
        "chemistry-2026-06-06-shift-1,q01,chemical-bonding",
        "chemistry-2026-06-06-shift-1,q01,thermodynamics",
      ].join("\n"),
    );

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.errors).toEqual([
      "line 1: expected paper_slug,question_key,topic_slug",
      'line 2: invalid paper slug "Chemistry Paper"',
      'line 4: chemistry-2026-06-06-shift-1/q01 is mapped to both "chemical-bonding" and "thermodynamics"',
    ]);
  });
});

describe("practice topic planning", () => {
  it("accepts tags that match the paper subject", () => {
    const planned = planPracticeTopicUpdates(
      [
        {
          paperSlug: "chemistry-2026-06-06-shift-1",
          questionKey: "q02",
          topicSlug: "thermodynamics",
        },
      ],
      context(),
    );

    expect(planned.errors).toEqual([]);
    expect(planned.updates).toEqual([
      {
        paperSlug: "chemistry-2026-06-06-shift-1",
        questionKey: "q02",
        topicSlug: "thermodynamics",
        topicId: 42,
      },
    ]);
  });

  it("rejects unknown papers, keys and cross-subject topics", () => {
    const planned = planPracticeTopicUpdates(
      [
        { paperSlug: "missing-paper", questionKey: "q01", topicSlug: "chemical-bonding" },
        {
          paperSlug: "chemistry-2026-06-06-shift-1",
          questionKey: "q99",
          topicSlug: "chemical-bonding",
        },
        {
          paperSlug: "chemistry-2026-06-06-shift-1",
          questionKey: "q01",
          topicSlug: "reading-comprehension",
        },
      ],
      context(),
    );

    expect(planned.updates).toEqual([]);
    expect(planned.errors).toEqual([
      "missing-paper: no published practice paper with this slug",
      "chemistry-2026-06-06-shift-1/q99: no live question with this key",
      'chemistry-2026-06-06-shift-1/q01: topic "reading-comprehension" does not belong to this paper\'s subject',
    ]);
  });
});

describe("practice topic aggregation", () => {
  it("keeps the public count in sync with the listing gate", () => {
    expect(PRACTICE_TOPIC_MIN_QUESTIONS).toBe(MIN_LISTED_QUESTIONS);
  });

  it("counts only live, published, 30+ question papers with a valid topic", () => {
    const sql = practiceTopicCountSql("t.id");
    expect(sql).toContain("practice_questions");
    expect(sql).toContain("practice_papers");
    expect(sql).toContain("pq.topic_id = t.id");
    expect(sql).toContain("pq.deleted_at IS NULL");
    expect(sql).toContain("pp.publication_status = 'published'");
    expect(sql).toContain("pp.is_archived = 0");
    expect(sql).toContain("tt.subject_id = pp.subject_id");
    expect(sql).toContain(`>= ${PRACTICE_TOPIC_MIN_QUESTIONS}`);
  });

  it("runs the gate against the database at the 30-question boundary", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE topics (id INTEGER PRIMARY KEY, slug TEXT, subject_id INTEGER, deleted_at TEXT);
      CREATE TABLE practice_papers (slug TEXT PRIMARY KEY, subject_id INTEGER, publication_status TEXT, is_archived INTEGER NOT NULL DEFAULT 0, deleted_at TEXT);
      CREATE TABLE practice_questions (id INTEGER PRIMARY KEY, paper_slug TEXT, question_key TEXT, topic_id INTEGER, deleted_at TEXT);
      INSERT INTO topics VALUES (41, 'chemical-bonding', 3, NULL);
      INSERT INTO practice_papers VALUES ('chemistry-sample', 3, 'published', 0, NULL);
    `);
    const insert = db.prepare(
      "INSERT INTO practice_questions (paper_slug, question_key, topic_id) VALUES ('chemistry-sample', ?, 41)",
    );
    for (let index = 1; index <= PRACTICE_TOPIC_MIN_QUESTIONS; index += 1) {
      insert.run(`q${String(index).padStart(2, "0")}`);
    }
    const count = db.prepare(
      `SELECT ${practiceTopicCountSql("t.id")} AS count FROM topics t WHERE t.id = 41`,
    );

    const lastKey = `q${String(PRACTICE_TOPIC_MIN_QUESTIONS).padStart(2, "0")}`;
    expect(count.get()).toMatchObject({ count: PRACTICE_TOPIC_MIN_QUESTIONS });

    db.prepare("UPDATE practice_questions SET deleted_at = '2026-01-01' WHERE question_key = ?").run(lastKey);
    expect(count.get()).toMatchObject({ count: 0 });
    db.close();
  });

  it("wires the local fallback into the topic page, hubs and sitemap", () => {
    const topicPage = read("src/pages/cuet-mock-test/[subject]/[topic].astro");
    expect(topicPage).toContain("practiceTopicCountSql");
    expect(topicPage).toContain("practice_questions");
    expect(topicPage).toContain("practice_papers");
    expect(topicPage).toContain("const papers = [...practicePapers, ...timedPapers]");

    for (const page of [
      "src/pages/cuet-mock-test/[slug].astro",
      "src/pages/cuet-ug-syllabus/[subject].astro",
      "src/pages/sitemap.xml.ts",
    ]) {
      expect(read(page), page).toContain("practiceTopicCountSql");
    }
  });

  it("ships the migration and the repeatable import script", () => {
    const migration = read("migrations/0027_practice_question_topics.sql");
    expect(migration).toContain("ALTER TABLE practice_questions ADD COLUMN topic_id");
    expect(migration).toContain("idx_practice_questions_topic");

    const script = read("scripts/tag-practice-questions.mjs");
    expect(script).toContain("parsePracticeTopicCsv");
    expect(script).toContain("planPracticeTopicUpdates");
    expect(script).toContain("--apply");
    expect(script).toContain("--remote");
    expect(script).toContain("--turso");
    expect(script).toContain("createTursoClient");
    expect(script).toContain("transaction(\"write\")");
  });
});
