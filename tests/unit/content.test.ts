import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatDuration,
  normalizeOptions,
  parseMarkingScheme,
  slugify,
  validateQuestionContent,
  type QuestionPayload,
} from "../../src/lib/content";

function payload(overrides: Partial<QuestionPayload> = {}): QuestionPayload {
  return {
    subject_id: 1,
    topic_id: null,
    passage_id: null,
    text: "What is 2 + 2?",
    text_hi: null,
    options: [
      { text: "3", image_url: null, alt: null },
      { text: "4", image_url: null, alt: null },
      { text: "5", image_url: null, alt: null },
      { text: "6", image_url: null, alt: null },
    ],
    options_hi: [],
    correct_option: 1,
    explanation: "4 is correct.",
    explanation_hi: null,
    difficulty: "easy",
    year: null,
    image_url: null,
    image_alt: null,
    explanation_image_url: null,
    explanation_image_alt: null,
    status: "published",
    ...overrides,
  };
}

describe("parseMarkingScheme", () => {
  it("reads a stored scheme", () => {
    expect(parseMarkingScheme('{"correct":5,"wrong":-1,"skipped":0}')).toEqual({
      correct: 5,
      wrong: -1,
      skipped: 0,
    });
  });

  it("falls back to the CUET default on invalid JSON or numbers", () => {
    expect(parseMarkingScheme("not json")).toEqual({ correct: 5, wrong: -1, skipped: 0 });
    expect(parseMarkingScheme('{"correct":"x","wrong":-1}')).toEqual({
      correct: 5,
      wrong: -1,
      skipped: 0,
    });
  });
});

describe("slugify", () => {
  it("lowercases, removes quotes and collapses punctuation into single dashes", () => {
    expect(slugify(`  CUET UG: English (2022) — "Paper" 1  `)).toBe(
      "cuet-ug-english-2022-paper-1",
    );
  });

  it("caps generated slugs at 90 characters and trims edge dashes", () => {
    expect(slugify("---")).toBe("");
    expect(slugify("a".repeat(120))).toHaveLength(90);
  });
});

describe("date and duration formatting", () => {
  it("formats a valid ISO timestamp without changing the date", () => {
    const date = "2026-10-30T12:00:00.000Z";
    expect(formatDate(date)).toMatch(/30 Oct 2026/);
    expect(formatDateTime(date)).toMatch(/30 Oct 2026/);
    expect(formatDateTime(date)).toMatch(/2026/);
  });

  it("returns fallbacks for missing or invalid values", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
    expect(formatDate("not-a-date")).toBe("not-a-date");
    expect(formatDateTime("not-a-date")).toBe("not-a-date");
  });

  it("formats elapsed time with hours, minutes and seconds", () => {
    expect(formatDuration(3661)).toBe("1h 1m 1s");
    expect(formatDuration(61)).toBe("1m 1s");
    expect(formatDuration(5)).toBe("5s");
    expect(formatDuration(null)).toBe("0s");
    expect(formatDuration(-10)).toBe("0s");
  });
});

describe("validateQuestionContent", () => {
  it("accepts a complete published question", () => {
    expect(validateQuestionContent(payload())).toEqual([]);
  });

  it("requires alt text for every image", () => {
    const errors = validateQuestionContent(
      payload({
        image_url: "/api/media/1",
        options: [
          { text: "3", image_url: "/api/media/2", alt: null },
          { text: "4", image_url: null, alt: null },
        ],
      }),
    );
    expect(errors).toContain("Alt text is required for the question image.");
    expect(errors).toContain("Alt text is required for the option A image.");
  });

  it("requires an explanation before publishing", () => {
    expect(validateQuestionContent(payload({ explanation: null }))).toContain(
      "A published question needs an explanation.",
    );
    expect(validateQuestionContent(payload({ status: "draft", explanation: null }))).toEqual([]);
  });

  it("rejects an empty or out-of-range correct option", () => {
    expect(validateQuestionContent(payload({ correct_option: 9 }))).toContain(
      "The correct option is outside the option list.",
    );
    const empty = payload({
      correct_option: 0,
      options: [
        { text: "", image_url: null, alt: null },
        { text: "4", image_url: null, alt: null },
      ],
    });
    expect(validateQuestionContent(empty)).toContain("The correct option cannot be empty.");
  });
});

describe("normalizeOptions", () => {
  it("trims values, drops blank image URLs and pads to four options", () => {
    const options = normalizeOptions([
      { text: "  A  ", image_url: "  ", alt: "  " },
      { text: "B", image_url: " /api/media/1 ", alt: " Chart " },
    ]);
    expect(options).toHaveLength(4);
    expect(options[0]).toEqual({ text: "A", image_url: null, alt: null });
    expect(options[1]).toEqual({ text: "B", image_url: "/api/media/1", alt: "Chart" });
    expect(options[2]).toEqual({ text: "", image_url: null, alt: null });
  });
});
