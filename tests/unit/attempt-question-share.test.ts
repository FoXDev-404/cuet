import { describe, expect, it } from "vitest";
import {
  attemptQuestionShareUrl,
  attemptShareFileName,
  attemptShareLinkText,
} from "../../src/lib/share/attempt-question";

const SITE = "https://cuetfreemocktest.com";
const MOCK_URL = `${SITE}/mock/english-2026-06-06-shift-1/instructions`;

describe("attempt question share links", () => {
  it("prefers the public question page when the lineage has an enabled mapping", () => {
    const link = attemptQuestionShareUrl({
      publicId: "AAAAAAAAAA",
      questionText: "Which Act introduced Dyarchy in the provinces?",
      mockUrl: MOCK_URL,
      siteOrigin: SITE,
    });
    expect(link.publicId).toBe("AAAAAAAAAA");
    expect(link.url).toBe(`${SITE}/q/which-act-introduced-dyarchy-in-the-AAAAAAAAAA`);
  });

  it("falls back to the mock instructions link for questions without a mapping", () => {
    const link = attemptQuestionShareUrl({
      publicId: null,
      questionText: "Anything",
      mockUrl: MOCK_URL,
      siteOrigin: SITE,
    });
    expect(link).toEqual({ url: MOCK_URL, publicId: null });
  });

  it("keeps the attempt page usable when the mock url is missing", () => {
    const link = attemptQuestionShareUrl({
      publicId: null,
      questionText: "Anything",
      mockUrl: "",
      siteOrigin: SITE,
    });
    expect(link.url).toBe("");
  });
});

describe("attempt share link text", () => {
  it("shows host plus path without the scheme", () => {
    expect(attemptShareLinkText(MOCK_URL)).toBe(
      "cuetfreemocktest.com/mock/english-2026-06-06-shift-1/instructions",
    );
  });

  it("truncates long paths and never ends on a partial word", () => {
    const long = `${SITE}/q/${"a".repeat(120)}-AAAAAAAAAA`;
    const text = attemptShareLinkText(long, 64);
    expect(text.length).toBeLessThanOrEqual(64);
    expect(text.endsWith("…")).toBe(true);
  });

  it("degrades to a scheme-less copy for malformed urls", () => {
    expect(attemptShareLinkText("not a url")).toBe("not a url");
  });
});

describe("attempt share filename", () => {
  it("uses the public id when the question is publicly shareable", () => {
    expect(attemptShareFileName("AAAAAAAAAA", "english-2026-06-06-shift-1", 3)).toBe(
      "cuet-question-AAAAAAAAAA.png",
    );
  });

  it("falls back to the mock slug and on-screen question number", () => {
    expect(attemptShareFileName(null, "english-2026-06-06-shift-1", 12)).toBe(
      "cuet-english-2026-06-06-shift-1-q12.png",
    );
  });
});
