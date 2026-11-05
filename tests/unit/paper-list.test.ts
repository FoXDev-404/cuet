import { describe, expect, it } from "vitest";
import {
  classifyPaper,
  getKeyStatus,
  formatMarking,
  formatShortTitle,
  sanitizeParams,
  applyFilters,
  sortPapers,
  paginate,
  recommendPapers,
  isFiltered,
  buildFilterUrl,
} from "../../src/lib/paper-list";
import type { LocalPaperSummary } from "../../src/lib/local-papers";

function makePaper(partial: Partial<LocalPaperSummary> = {}): LocalPaperSummary {
  return {
    slug: partial.slug ?? "test-paper",
    id: partial.id ?? "test-id",
    title: partial.title ?? "CUET UG Test Paper 2026",
    metaDescription: partial.metaDescription ?? "Test meta description",
    year: partial.year ?? 2026,
    subject: partial.subject ?? {
      id: "subj-1",
      name: "Physics",
      slug: "physics",
      code: "PHY",
    },
    date: partial.date ?? "2026-05-20",
    dateLabel: partial.dateLabel ?? "20 May 2026",
    shift: "shift" in partial ? (partial.shift ?? null) : "Shift 1",
    durationMinutes: partial.durationMinutes ?? 45,
    markingScheme: partial.markingScheme ?? { correct: 5, wrong: 1, skipped: 0 },
    totalQuestions: partial.totalQuestions ?? 50,
    sourceQuestionCount: partial.sourceQuestionCount ?? 50,
    recoveredQuestionCount: partial.recoveredQuestionCount ?? 50,
    omittedQuestionCount: partial.omittedQuestionCount ?? 0,
    scorableQuestionCount: partial.scorableQuestionCount ?? 50,
    pendingReviewCount: partial.pendingReviewCount ?? 0,
    attemptCount: partial.attemptCount ?? 0,
    imageQuestionCount: partial.imageQuestionCount ?? 0,
    assetCount: partial.assetCount ?? 0,
    sourceFile: null,
    sourceMethod: null,
    publicationStatus: "published",
    reviewRequired: false,
    localPaper: true,
    draft: true,
    path: partial.path ?? "/mock-tests/test-paper",
  };
}

describe("paper-list module", () => {
  describe("classifyPaper", () => {
    it("classifies >= 40 questions as full", () => {
      expect(classifyPaper({ recoveredQuestionCount: 40 })).toBe("full");
      expect(classifyPaper({ recoveredQuestionCount: 50 })).toBe("full");
      expect(classifyPaper({ recoveredQuestionCount: 85 })).toBe("full");
    });

    it("classifies < 40 questions as mini", () => {
      expect(classifyPaper({ recoveredQuestionCount: 39 })).toBe("mini");
      expect(classifyPaper({ recoveredQuestionCount: 10 })).toBe("mini");
      expect(classifyPaper({ recoveredQuestionCount: 1 })).toBe("mini");
    });
  });

  describe("getKeyStatus", () => {
    it("returns Full key when all questions are scored and 0 pending", () => {
      const status = getKeyStatus({
        recoveredQuestionCount: 50,
        scorableQuestionCount: 50,
        pendingReviewCount: 0,
      });
      expect(status.isFullKey).toBe(true);
      expect(status.label).toBe("Full key");
      expect(status.tone).toBe("full");
    });

    it("returns Key N of M when some questions lack a key", () => {
      const status = getKeyStatus({
        recoveredQuestionCount: 10,
        scorableQuestionCount: 6,
        pendingReviewCount: 4,
      });
      expect(status.isFullKey).toBe(false);
      expect(status.label).toBe("Key 6 of 10");
      expect(status.tone).toBe("partial");
    });
  });

  describe("formatMarking", () => {
    it("formats marking with true minus sign", () => {
      expect(formatMarking({ correct: 5, wrong: 1 })).toBe("+5 / −1");
      expect(formatMarking({ correct: 5, wrong: -1 })).toBe("+5 / −1");
      expect(formatMarking({ correct: 4, wrong: 1 })).toBe("+4 / −1");
    });
  });

  describe("formatShortTitle", () => {
    it("formats short title with date and shift", () => {
      const paper = makePaper({
        subject: { id: "s1", name: "Physics", slug: "physics", code: "PHY" },
        dateLabel: "29 May 2026",
        shift: "Shift 1",
      });
      expect(formatShortTitle(paper)).toBe("Physics · 29 May 2026 · Shift 1");
    });

    it("falls back to year if dateLabel is empty", () => {
      const paper = makePaper({
        subject: { id: "s1", name: "Chemistry", slug: "chemistry", code: "CHE" },
        dateLabel: "",
        year: 2025,
        shift: null,
      });
      expect(formatShortTitle(paper)).toBe("Chemistry · 2025");
    });
  });

  describe("sanitizeParams", () => {
    it("returns defaults when params are empty", () => {
      const params = sanitizeParams(new URLSearchParams());
      expect(params.q).toBe("");
      expect(params.year).toBe("all");
      expect(params.subject).toBe("all");
      expect(params.type).toBe("full"); // Full papers by default
      expect(params.sort).toBe("newest"); // Newest by default
      expect(params.page).toBe(1);
    });

    it("sanitizes valid query parameters", () => {
      const search = new URLSearchParams({
        q: "english",
        year: "2025",
        subject: "english",
        type: "mini",
        sort: "attempts",
        page: "3",
      });
      const params = sanitizeParams(search, [2025, 2026], ["english", "physics"]);
      expect(params.q).toBe("english");
      expect(params.year).toBe(2025);
      expect(params.subject).toBe("english");
      expect(params.type).toBe("mini");
      expect(params.sort).toBe("attempts");
      expect(params.page).toBe(3);
    });

    it("falls back to defaults on unknown values", () => {
      const search = new URLSearchParams({
        year: "1999",
        subject: "astrology",
        type: "unknown-type",
        sort: "random",
        page: "-5",
      });
      const params = sanitizeParams(search, [2025, 2026], ["english"]);
      expect(params.year).toBe("all");
      expect(params.subject).toBe("all");
      expect(params.type).toBe("full");
      expect(params.sort).toBe("newest");
      expect(params.page).toBe(1);
    });
  });

  describe("isFiltered", () => {
    it("returns false for defaults", () => {
      const defaults = sanitizeParams(new URLSearchParams());
      expect(isFiltered(defaults)).toBe(false);
    });

    it("returns true when any filter is active", () => {
      expect(isFiltered({ ...sanitizeParams(new URLSearchParams()), q: "bio" })).toBe(true);
      expect(isFiltered({ ...sanitizeParams(new URLSearchParams()), year: 2025 })).toBe(true);
      expect(isFiltered({ ...sanitizeParams(new URLSearchParams()), subject: "chemistry" })).toBe(true);
      expect(isFiltered({ ...sanitizeParams(new URLSearchParams()), type: "all" })).toBe(true);
      expect(isFiltered({ ...sanitizeParams(new URLSearchParams()), sort: "oldest" })).toBe(true);
      expect(isFiltered({ ...sanitizeParams(new URLSearchParams()), page: 2 })).toBe(true);
    });
  });

  describe("applyFilters", () => {
    const papers = [
      makePaper({
        slug: "p1",
        year: 2026,
        recoveredQuestionCount: 50,
        subject: { id: "s1", name: "Physics", slug: "physics", code: "PHY" },
        title: "Physics 2026",
      }),
      makePaper({
        slug: "p2",
        year: 2026,
        recoveredQuestionCount: 10,
        subject: { id: "s1", name: "Physics", slug: "physics", code: "PHY" },
        title: "Physics Mini 2026",
      }),
      makePaper({
        slug: "p3",
        year: 2025,
        recoveredQuestionCount: 50,
        subject: { id: "s2", name: "English", slug: "english", code: "ENG" },
        title: "English 2025",
      }),
    ];

    it("filters by type: full papers only by default", () => {
      const filtered = applyFilters(papers, sanitizeParams(new URLSearchParams()));
      expect(filtered.map((p) => p.slug)).toEqual(["p1", "p3"]);
    });

    it("filters by type: mini papers", () => {
      const filtered = applyFilters(papers, sanitizeParams(new URLSearchParams({ type: "mini" })));
      expect(filtered.map((p) => p.slug)).toEqual(["p2"]);
    });

    it("filters by year", () => {
      const filtered = applyFilters(papers, sanitizeParams(new URLSearchParams({ year: "2025", type: "all" }), [2025, 2026]));
      expect(filtered.map((p) => p.slug)).toEqual(["p3"]);
    });

    it("filters by search query", () => {
      const filtered = applyFilters(papers, sanitizeParams(new URLSearchParams({ q: "English", type: "all" })));
      expect(filtered.map((p) => p.slug)).toEqual(["p3"]);
    });
  });

  describe("sortPapers", () => {
    const p1 = makePaper({ slug: "p1", year: 2026, attemptCount: 10, pendingReviewCount: 0 });
    const p2 = makePaper({ slug: "p2", year: 2024, attemptCount: 50, pendingReviewCount: 5 });
    const p3 = makePaper({ slug: "p3", year: 2025, attemptCount: 20, pendingReviewCount: 0 });

    it("sorts by newest year first", () => {
      const sorted = sortPapers([p2, p1, p3], "newest");
      expect(sorted.map((p) => p.slug)).toEqual(["p1", "p3", "p2"]);
    });

    it("sorts by oldest year first", () => {
      const sorted = sortPapers([p1, p3, p2], "oldest");
      expect(sorted.map((p) => p.slug)).toEqual(["p2", "p3", "p1"]);
    });

    it("sorts by attempts descending", () => {
      const sorted = sortPapers([p1, p2, p3], "attempts");
      expect(sorted.map((p) => p.slug)).toEqual(["p2", "p3", "p1"]);
    });

    it("sorts by keys: full keys first", () => {
      const sorted = sortPapers([p2, p1, p3], "keys");
      expect(sorted[2]?.slug).toBe("p2"); // partial key at end
    });
  });

  describe("paginate", () => {
    const items = Array.from({ length: 50 }, (_, i) => i + 1);

    it("paginates page 1 with 24 items", () => {
      const res = paginate(items, 1, 24);
      expect(res.items.length).toBe(24);
      expect(res.page).toBe(1);
      expect(res.totalPages).toBe(3);
      expect(res.hasNext).toBe(true);
      expect(res.hasPrev).toBe(false);
      expect(res.nextPage).toBe(2);
      expect(res.startIndex).toBe(1);
      expect(res.endIndex).toBe(24);
    });

    it("paginates last page correctly", () => {
      const res = paginate(items, 3, 24);
      expect(res.items.length).toBe(2);
      expect(res.page).toBe(3);
      expect(res.hasNext).toBe(false);
      expect(res.hasPrev).toBe(true);
      expect(res.startIndex).toBe(49);
      expect(res.endIndex).toBe(50);
    });

    it("handles empty items safely", () => {
      const res = paginate([], 1, 24);
      expect(res.items.length).toBe(0);
      expect(res.total).toBe(0);
      expect(res.totalPages).toBe(1);
      expect(res.startIndex).toBe(0);
      expect(res.endIndex).toBe(0);
    });
  });

  describe("recommendPapers", () => {
    it("selects full papers with full key, prioritizing English and General Test", () => {
      const pool = [
        makePaper({
          slug: "phy-mini",
          recoveredQuestionCount: 10,
          scorableQuestionCount: 10,
          pendingReviewCount: 0,
          subject: { id: "phy", name: "Physics", slug: "physics", code: "PHY" },
        }),
        makePaper({
          slug: "phy-full",
          year: 2026,
          recoveredQuestionCount: 50,
          scorableQuestionCount: 50,
          pendingReviewCount: 0,
          subject: { id: "phy", name: "Physics", slug: "physics", code: "PHY" },
        }),
        makePaper({
          slug: "chem-full-partial-key",
          year: 2026,
          recoveredQuestionCount: 50,
          scorableQuestionCount: 40,
          pendingReviewCount: 10,
          subject: { id: "chem", name: "Chemistry", slug: "chemistry", code: "CHE" },
        }),
        makePaper({
          slug: "eng-full",
          year: 2026,
          recoveredQuestionCount: 50,
          scorableQuestionCount: 50,
          pendingReviewCount: 0,
          subject: { id: "eng", name: "English", slug: "english", code: "ENG" },
        }),
        makePaper({
          slug: "gt-full",
          year: 2025,
          recoveredQuestionCount: 50,
          scorableQuestionCount: 50,
          pendingReviewCount: 0,
          subject: { id: "gt", name: "General Test", slug: "general-test", code: "GT" },
        }),
      ];

      const recs = recommendPapers(pool, 3);
      expect(recs.length).toBe(3);
      // English should come first due to preference
      expect(recs[0]?.slug).toBe("eng-full");
      // General Test second
      expect(recs[1]?.slug).toBe("gt-full");
      // Physics third
      expect(recs[2]?.slug).toBe("phy-full");
      // Distinct subjects
      const subjects = new Set(recs.map((r) => r.subject.id));
      expect(subjects.size).toBe(3);
    });
  });

  describe("buildFilterUrl", () => {
    it("omits default values from query string", () => {
      const defaults = sanitizeParams(new URLSearchParams());
      expect(buildFilterUrl("/mock-tests", defaults, {})).toBe("/mock-tests");
    });

    it("includes custom filters and resets page when filter updates", () => {
      const params = sanitizeParams(new URLSearchParams({ page: "3" }));
      const nextUrl = buildFilterUrl("/mock-tests", params, { year: 2026, subject: "physics" });
      expect(nextUrl).toBe("/mock-tests?year=2026&subject=physics");
    });

    it("preserves explicit page updates", () => {
      const defaults = sanitizeParams(new URLSearchParams());
      const nextUrl = buildFilterUrl("/mock-tests", defaults, { page: 2 });
      expect(nextUrl).toBe("/mock-tests?page=2");
    });
  });
});
