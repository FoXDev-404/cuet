import { beforeAll, describe, expect, it } from "vitest";
import { getLocalSubjectCards } from "../../src/lib/local-subject-fallback";
import { ensurePracticeLibrary, setPracticeLibraryStore } from "../../src/lib/practice-library";

beforeAll(async () => {
  setPracticeLibraryStore({
    loadIndex: async () => {
      throw new Error("D1 unavailable");
    },
    loadPaper: async () => null,
  });
  await ensurePracticeLibrary(0);
});

describe("getLocalSubjectCards", () => {
  it("rebuilds the subject grid from the bundled practice library", () => {
    const cards = getLocalSubjectCards();
    expect(cards.length).toBeGreaterThanOrEqual(10);

    const biology = cards.find((card) => card.slug === "biology");
    expect(biology).toBeDefined();
    expect(biology!.name).toBe("Biology");
    expect(biology!.type).toBe("domain");
    expect(biology!.mock_count).toBeGreaterThan(0);
    expect(biology!.question_count).toBeGreaterThan(0);
  });

  it("classifies language and general subjects", () => {
    const cards = getLocalSubjectCards();
    expect(cards.find((card) => card.slug === "english")?.type).toBe("language");
    expect(cards.find((card) => card.slug === "hindi")?.type).toBe("language");
    expect(cards.find((card) => card.slug === "general-test")?.type).toBe("general");
    expect(cards.find((card) => card.slug === "physics")?.type).toBe("domain");
  });

  it("returns cards sorted by name", () => {
    const names = getLocalSubjectCards().map((card) => card.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});
