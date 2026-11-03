import { describe, expect, it } from "vitest";
import {
  createBundledPracticeSnapshot,
  createPracticeSnapshot,
  ensurePracticeLibrary,
  setPracticeLibraryStore,
  type PracticeLibraryStore,
} from "../../src/lib/practice-library";
import type { LocalPaperSummary } from "../../src/lib/practice-normalize";
import { sortPracticeSummaries } from "../../src/lib/practice-normalize";

function summary(slug: string): LocalPaperSummary {
  return {
    id: `local-${slug}`,
    slug,
    title: slug,
    metaDescription: "",
    year: 2024,
    subject: { id: "local-biology", name: "Biology", slug: "biology", code: "BIO" },
    date: "2024-05-15",
    dateLabel: "15 May 2024",
    shift: null,
    durationMinutes: 45,
    markingScheme: { correct: 5, wrong: 1, skipped: 0 },
    totalQuestions: 10,
    sourceQuestionCount: 10,
    recoveredQuestionCount: 10,
    omittedQuestionCount: 0,
    scorableQuestionCount: 9,
    pendingReviewCount: 1,
    attemptCount: 0,
    imageQuestionCount: 0,
    assetCount: 0,
    sourceFile: null,
    sourceMethod: null,
    publicationStatus: "published",
    reviewRequired: false,
    localPaper: true,
    draft: true,
    path: `/practice/${slug}`,
  };
}

describe("bundled practice index", () => {
  it("builds a snapshot from the committed index file", () => {
    const snapshot = createBundledPracticeSnapshot();
    expect(snapshot.papers.length).toBeGreaterThan(100);
    expect(snapshot.papersBySlug.has("biology-2022-08-18")).toBe(true);
    expect(snapshot.subjectSummaries.size).toBeGreaterThan(5);
  });

  it("keeps the paper counts that the listing pages show", () => {
    const snapshot = createBundledPracticeSnapshot();
    const paper = snapshot.papersBySlug.get("biology-2022-08-18");
    expect(paper?.totalQuestions).toBeGreaterThan(0);
    expect(paper?.scorableQuestionCount).toBeGreaterThan(0);
    expect(paper?.scorableQuestionCount).toBeLessThanOrEqual(paper?.totalQuestions ?? 0);
  });
});

describe("ensurePracticeLibrary fallback", () => {
  it("serves the bundled index when the store fails", async () => {
    const failing: PracticeLibraryStore = {
      loadIndex: async () => {
        throw new Error("D1 row read limit exceeded");
      },
      loadPaper: async () => null,
    };
    setPracticeLibraryStore(failing);

    const snapshot = await ensurePracticeLibrary(0);
    expect(snapshot.papers.length).toBeGreaterThan(100);
  });

  it("prefers the store when it works", async () => {
    const working: PracticeLibraryStore = {
      loadIndex: async () => [summary("from-store")],
      loadPaper: async () => null,
    };
    setPracticeLibraryStore(working);

    const snapshot = await ensurePracticeLibrary(0);
    expect(snapshot.papers.map((paper) => paper.slug)).toEqual(["from-store"]);
  });
});

describe("createPracticeSnapshot", () => {
  it("indexes papers by slug and applies the canonical ordering", () => {
    const input = [summary("b-paper"), summary("a-paper")];
    const snapshot = createPracticeSnapshot(input);
    expect(snapshot.papersBySlug.size).toBe(2);
    expect(snapshot.papersBySlug.get("a-paper")?.slug).toBe("a-paper");
    expect(snapshot.papers.map((paper) => paper.slug)).toEqual(
      sortPracticeSummaries(input).map((paper) => paper.slug),
    );
  });
});
