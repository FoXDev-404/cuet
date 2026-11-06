import { describe, expect, it } from "vitest";
import {
  canViewerCheck,
  isSeoEligible,
  optionsForPublic,
  optionsForPublicHindi,
  plainExcerpt,
  publicQuestionDescription,
  publicQuestionTitle,
  questionOgImagePath,
} from "../../src/lib/share/public-question";

const seoReady = {
  published: true,
  seoIndexable: true,
  revealPolicy: "public" as const,
  rightsOk: true,
  hasExplanation: true,
  inPublishedMock: false,
};

describe("public question reveal policy", () => {
  it("allows public-reveal questions only outside a published ranked mock", () => {
    expect(
      canViewerCheck({
        revealPolicy: "public",
        inPublishedMock: false,
        hasSubmittedAttempt: false,
      }),
    ).toBe(true);
    expect(
      canViewerCheck({
        revealPolicy: "public",
        inPublishedMock: true,
        hasSubmittedAttempt: true,
      }),
    ).toBe(false);
  });

  it("requires a submitted attempt for attempted-only questions", () => {
    expect(
      canViewerCheck({
        revealPolicy: "attempted_only",
        inPublishedMock: false,
        hasSubmittedAttempt: false,
      }),
    ).toBe(false);
    expect(
      canViewerCheck({
        revealPolicy: "attempted_only",
        inPublishedMock: true,
        hasSubmittedAttempt: true,
      }),
    ).toBe(true);
  });
});

describe("public question SEO policy", () => {
  it("allows indexing only when every condition holds", () => {
    expect(isSeoEligible(seoReady)).toBe(true);
  });

  it("rejects each missing condition", () => {
    expect(isSeoEligible({ ...seoReady, published: false })).toBe(false);
    expect(isSeoEligible({ ...seoReady, seoIndexable: false })).toBe(false);
    expect(isSeoEligible({ ...seoReady, revealPolicy: "attempted_only" })).toBe(false);
    expect(isSeoEligible({ ...seoReady, rightsOk: false })).toBe(false);
    expect(isSeoEligible({ ...seoReady, hasExplanation: false })).toBe(false);
    expect(isSeoEligible({ ...seoReady, inPublishedMock: true })).toBe(false);
  });
});

describe("public question view helpers", () => {
  it("maps options without exposing a correct answer", () => {
    const options = optionsForPublic(
      JSON.stringify([
        { text: "First", image_url: null, alt: null },
        { text: "Second", image_url: "/media/a.png", alt: "A graph" },
      ]),
    );
    expect(options).toEqual([
      { letter: "A", text: "First", imageUrl: null, alt: null },
      { letter: "B", text: "Second", imageUrl: "/media/a.png", alt: "A graph" },
    ]);
    expect(JSON.stringify(options)).not.toMatch(/correct|answer/i);
    expect(optionsForPublicHindi("[]")).toBeNull();
    expect(optionsForPublicHindi(null)).toBeNull();
  });

  it("builds bounded titles and descriptions from question text", () => {
    const text = "What is the value of $x^2 + 1$ when $x = 3$? ".repeat(6);
    expect(plainExcerpt(text, 40).length).toBeLessThanOrEqual(40);
    expect(plainExcerpt(text, 40)).not.toContain("$");
    const title = publicQuestionTitle({ text, subjectName: "Mathematics", seoEligible: true });
    const description = publicQuestionDescription({
      text,
      subjectName: "Mathematics",
      seoEligible: true,
    });
    expect(title.length).toBeLessThanOrEqual(70);
    expect(description.length).toBeLessThanOrEqual(158);
    expect(title).toMatch(/CUET Mathematics/);
    expect(description).toMatch(/worked explanation/);
  });

  it("maps an indexable question to its offline OG image path", () => {
    expect(questionOgImagePath("Ab3dE5fG7h")).toBe("/og/questions/Ab3dE5fG7h.png");
  });
});
