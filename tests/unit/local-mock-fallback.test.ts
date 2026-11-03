import { beforeAll, describe, expect, it } from "vitest";
import { getLocalMockFallback } from "../../src/lib/local-mock-fallback";
import { getLocalPaperSummary } from "../../src/lib/local-papers";
import { ensurePracticeLibrary, setPracticeLibraryStore } from "../../src/lib/practice-library";
import { parseMarkingScheme } from "../../src/lib/content";

const SLUG = "biology-2022-08-18";

beforeAll(async () => {
  // The snapshot is normally warmed by middleware; warm it from the bundled
  // index so these tests exercise the same data the fallback reads in production.
  setPracticeLibraryStore({
    loadIndex: async () => {
      throw new Error("D1 unavailable");
    },
    loadPaper: async () => null,
  });
  await ensurePracticeLibrary(0);
});

describe("getLocalMockFallback", () => {
  it("describes a bundled practice paper without D1", () => {
    const paper = getLocalPaperSummary(SLUG);
    expect(paper).not.toBeNull();

    const fallback = getLocalMockFallback(SLUG);
    expect(fallback).not.toBeNull();
    expect(fallback!.slug).toBe(SLUG);
    expect(fallback!.title).toBe(paper!.title);
    expect(fallback!.duration_min).toBe(paper!.durationMinutes);
    expect(fallback!.question_count).toBe(
      paper!.scorableQuestionCount || paper!.totalQuestions,
    );
    expect(fallback!.id).toBe(0);
  });

  it("stores a marking scheme that parseMarkingScheme understands", () => {
    const fallback = getLocalMockFallback(SLUG)!;
    const marking = parseMarkingScheme(fallback.marking_scheme);
    expect(marking.correct).toBe(5);
    expect(marking.wrong).toBe(-1);
    expect(marking.skipped).toBe(0);
  });

  it("returns null for a slug that is not a practice paper", () => {
    expect(getLocalMockFallback("definitely-not-a-paper")).toBeNull();
  });
});
