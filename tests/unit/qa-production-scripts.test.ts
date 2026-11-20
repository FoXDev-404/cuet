import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const redirectSource = readFileSync(
  resolve(process.cwd(), "scripts/fix-archived-redirects.mjs"),
  "utf8",
);
const curationSource = readFileSync(
  resolve(process.cwd(), "scripts/flag-duplicate-options.mjs"),
  "utf8",
);
const miniMockSource = readFileSync(
  resolve(process.cwd(), "scripts/fix-english-mini-mock-v2.mjs"),
  "utf8",
);

describe("QA one-off production scripts", () => {
  it("checks the right Turso config field (BUG-010)", () => {
    // getTursoConfig() returns { url, authToken }. Using `token` here made
    // --turso report "credentials missing" even with valid credentials.
    expect(redirectSource).toContain("getTursoConfig()?.authToken");
    expect(curationSource).toContain("getTursoConfig()?.authToken");
    expect(redirectSource).not.toContain("getTursoConfig()?.token");
    expect(curationSource).not.toContain("getTursoConfig()?.token");
  });

  it("validates practice-paper and slug-redirect rows separately (BUG-010)", () => {
    // The remote pre-flight used to apply the is_archived check to slug
    // redirects too, aborting before any write.
    expect(redirectSource).toContain('fix.kind === "practice_paper"');
    expect(redirectSource).toContain("slug redirect for ${fix.slug} is missing");
  });

  it("creates the 50-question mini mock as a draft before adding frozen questions (BUG-011)", () => {
    // Production rejects mock_questions inserts into a published version.
    const draftInsert = miniMockSource.indexOf("'draft', NULL");
    const questionInsert = miniMockSource.indexOf("INSERT INTO mock_questions");
    const publish = miniMockSource.indexOf(
      "SET status = 'published', published_at = ?",
    );
    expect(draftInsert).toBeGreaterThan(-1);
    expect(questionInsert).toBeGreaterThan(draftInsert);
    expect(publish).toBeGreaterThan(questionInsert);
  });

  it("keeps the mini mock migration atomic and attempt-safe (BUG-011)", () => {
    expect(miniMockSource).toContain('client.transaction("write")');
    expect(miniMockSource).toContain("await transaction.rollback()");
    expect(miniMockSource).toContain("Backup written");
    expect(miniMockSource).not.toMatch(/(?:UPDATE|DELETE FROM|INSERT INTO)\s+attempts?\b/i);
    expect(miniMockSource).not.toMatch(/attempt_answers/i);
  });

  it("requires exactly 50 question slots for the mini mock (BUG-011)", () => {
    expect(miniMockSource).toContain("ADDED_QUESTION_IDS.length !== 45");
    expect(miniMockSource).toContain("questionIds.length !== 50");
    expect(miniMockSource).toContain("NEW_TOTAL_MARKS = 250");
  });
});
