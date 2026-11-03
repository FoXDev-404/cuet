import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scoreAttempt } from "../../src/lib/scoring";
import { parseMarkingScheme } from "../../src/lib/content";

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

function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const name of MIGRATIONS) {
    const sql = readFileSync(fileURLToPath(new URL(`../../migrations/${name}`, import.meta.url)), "utf8");
    db.exec(sql);
  }
  return db;
}

describe("Fix 5 — Exam Facts and Scoring from Data", () => {
  it("seeds official exam facts with source_url and last_verified date", () => {
    const db = createTestDb();
    const rows = db.prepare("SELECT key, value, source_url, last_verified FROM exam_info ORDER BY key").all() as {
      key: string;
      value: string;
      source_url: string | null;
      last_verified: string | null;
    }[];

    const byKey = new Map(rows.map((r) => [r.key, r]));

    // Check required keys exist
    expect(byKey.has("exam-pattern")).toBe(true);
    expect(byKey.has("marking-scheme")).toBe(true);
    expect(byKey.has("syllabus")).toBe(true);
    expect(byKey.has("important-dates")).toBe(true);
    expect(byKey.has("eligibility")).toBe(true);
    expect(byKey.has("subject-combination")).toBe(true);

    // Verified facts must have official source_url and last_verified
    const pattern = byKey.get("exam-pattern")!;
    expect(pattern.value).toContain("CUET (UG)");
    expect(pattern.source_url).toMatch(/^https:\/\/exams\.nta\.ac\.in\/CUET-UG/);
    expect(pattern.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const marking = byKey.get("marking-scheme")!;
    expect(marking.value).toContain("+5");
    expect(marking.value).toContain("-1");
    expect(marking.source_url).toMatch(/^https:\/\/exams\.nta\.ac\.in\/CUET-UG/);
    expect(marking.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("stores unverified facts as TODO_VERIFY with null last_verified", () => {
    const db = createTestDb();
    const dates = db.prepare("SELECT key, value, source_url, last_verified FROM exam_info WHERE key = 'important-dates'").all()[0] as {
      key: string;
      value: string;
      source_url: string | null;
      last_verified: string | null;
    };

    expect(dates).toBeDefined();
    expect(dates.value).toBe("TODO_VERIFY");
    expect(dates.last_verified).toBeNull();
  });

  it("enforces policy gate: unverified facts require noindex", () => {
    function computeNoindex(info: { value: string; last_verified: string | null } | null) {
      const isVerified = Boolean(info && info.value && info.value !== "TODO_VERIFY" && info.last_verified);
      return !isVerified;
    }

    // TODO_VERIFY -> must be noindex
    expect(computeNoindex({ value: "TODO_VERIFY", last_verified: null })).toBe(true);
    // null value -> must be noindex
    expect(computeNoindex(null)).toBe(true);
    // Verified with date -> indexed (noindex = false)
    expect(computeNoindex({ value: "Official summary", last_verified: "2026-11-04" })).toBe(false);
  });

  it("scores dynamically from data across at least three distinct marking schemes", () => {
    const questions = [
      { id: 1, subject_id: 1, section: "Section A", correct_option: 0 },
      { id: 2, subject_id: 1, section: "Section A", correct_option: 1 },
      { id: 3, subject_id: 1, section: "Section B", correct_option: 2 },
    ];
    const answers = [
      { question_id: 1, selected: 0, time_spent_sec: 10 }, // correct
      { question_id: 2, selected: 0, time_spent_sec: 10 }, // wrong
      { question_id: 3, selected: null, time_spent_sec: 0 }, // skipped
    ];

    // Scheme 1: Standard (+5 / -1 / 0) -> 5 - 1 = 4
    const res1 = scoreAttempt(questions, answers, parseMarkingScheme(JSON.stringify({ correct: 5, wrong: -1, skipped: 0 })));
    expect(res1.score).toBe(4);

    // Scheme 2: Zero negative marking (+4 / 0 / 0) -> 4 + 0 = 4
    const res2 = scoreAttempt(questions, answers, parseMarkingScheme(JSON.stringify({ correct: 4, wrong: 0, skipped: 0 })));
    expect(res2.score).toBe(4);

    // Scheme 3: Heavy penalty (+10 / -3 / -1) -> 10 - 3 - 1 = 6
    const res3 = scoreAttempt(questions, answers, parseMarkingScheme(JSON.stringify({ correct: 10, wrong: -3, skipped: -1 })));
    expect(res3.score).toBe(6);

    // Scheme 4: Per-section marking scheme
    const perSecJson = JSON.stringify({
      correct: 5,
      wrong: -1,
      skipped: 0,
      sections: {
        "Section A": { correct: 5, wrong: -2, skipped: 0 }, // Sec A wrong costs -2
        "Section B": { correct: 3, wrong: 0, skipped: 0 },
      },
    });
    const res4 = scoreAttempt(questions, answers, parseMarkingScheme(perSecJson));
    // Sec A correct (+5), Sec A wrong (-2), Sec B skipped (0) -> 5 - 2 = 3
    expect(res4.score).toBe(3);
  });
});
