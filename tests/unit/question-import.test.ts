import { describe, expect, it } from "vitest";
import {
  detectImportFormat,
  normalizeImportRecord,
  parseCsvCells,
  parseQuestionImport,
  questionSignature,
  QuestionImportError,
} from "../../src/lib/admin/question-import";

describe("parseCsvCells", () => {
  it("handles quoted commas, escaped quotes and multiline fields", () => {
    expect(parseCsvCells('a,b\r\n"one, two","say ""hi"""\n"line 1\nline 2",c')).toEqual([
      ["a", "b"],
      ["one, two", 'say "hi"'],
      ["line 1\nline 2", "c"],
    ]);
  });

  it("rejects an unclosed quoted field", () => {
    expect(() => parseCsvCells('a,b\n"broken,row')).toThrow(QuestionImportError);
  });
});

describe("parseQuestionImport", () => {
  it("detects and parses a JSON array", () => {
    const parsed = parseQuestionImport(
      JSON.stringify([{ text: "Question", subject_slug: "english" }]),
      "auto",
    );
    expect(parsed.format).toBe("json");
    expect(parsed.records).toHaveLength(1);
  });

  it("accepts a JSON object with a questions array", () => {
    const parsed = parseQuestionImport(
      JSON.stringify({ questions: [{ text: "Question", subject_slug: "english" }] }),
      "json",
    );
    expect(parsed.records[0]).toMatchObject({ text: "Question" });
  });

  it("normalises CSV headers and skips empty rows", () => {
    const parsed = parseQuestionImport(
      '\uFEFFSubject Slug,Question Text,Option A,Option B,Correct Option\nenglish,What is 2+2?,3,4,B\n, , , ,\n',
      "csv",
    );
    expect(parsed.format).toBe("csv");
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0]).toMatchObject({
      subject_slug: "english",
      question_text: "What is 2+2?",
      option_a: "3",
      option_b: "4",
      correct_option: "B",
    });
  });

  it("rejects duplicate CSV headers, empty imports and oversized row counts", () => {
    expect(() => parseQuestionImport("text,text\nA,B", "csv")).toThrow(/appears more than once/);
    expect(() => parseQuestionImport("text\n", "csv")).toThrow(/no question rows/);
    expect(() => parseQuestionImport("[]", "json")).toThrow(/no questions/);

    const rows = Array.from({ length: 101 }, () => ({
      subject_slug: "english",
      text: "Question",
      options: [{ text: "A" }, { text: "B" }],
      correct_option: 0,
    }));
    expect(() => parseQuestionImport(JSON.stringify(rows), "json")).toThrow(/at most 100/);
  });

  it("detects JSON before a CSV fallback", () => {
    expect(detectImportFormat("  [")).toBe("json");
    expect(detectImportFormat("{")).toBe("json");
    expect(detectImportFormat("subject_slug,text")).toBe("csv");
  });
});

describe("normalizeImportRecord", () => {
  it("maps flat CSV fields, letters and image alt text", () => {
    const normalized = normalizeImportRecord({
      subject_id: "2",
      text: "Pick the correct graph",
      option_a: "Graph A",
      option_a_image_url: "/api/media/1",
      option_a_image_alt: "Line rising to the right",
      option_b: "Graph B",
      option_c: "",
      option_d: "",
      correct_option: "a",
      difficulty: "Medium",
      status: "PUBLISHED",
    });

    expect(normalized.subjectRef).toBe("2");
    expect(normalized.payload).toMatchObject({
      subject_id: "2",
      correct_option: 0,
      difficulty: "Medium",
      status: "published",
      options: [
        {
          text: "Graph A",
          image_url: "/api/media/1",
          alt: "Line rising to the right",
        },
        { text: "Graph B", image_url: null, alt: null },
      ],
    });
  });

  it("keeps native JSON options and numeric correct indexes", () => {
    const normalized = normalizeImportRecord({
      subject_slug: "english",
      text: "Native JSON",
      options: [
        { text: "A", image_url: null, alt: null },
        { text: "B", image_url: null, alt: null },
      ],
      correct_option: 1,
    });
    expect(normalized.subjectRef).toBe("english");
    expect(normalized.payload.options).toHaveLength(2);
    expect(normalized.payload.correct_option).toBe(1);
  });

  it("accepts JSON options stored as a string", () => {
    const normalized = normalizeImportRecord({
      subject_id: "1",
      text: "String options",
      options: JSON.stringify([{ text: "A" }, { text: "B" }]),
      correct_option: "0",
    });
    expect(normalized.payload.options).toEqual([{ text: "A" }, { text: "B" }]);
    expect(normalized.payload.correct_option).toBe(0);
  });

  it("accepts common column aliases for question text and subject name", () => {
    const normalized = normalizeImportRecord({
      subject_name: "English",
      question_text: "Aliased question",
      option_a: "A",
      option_b: "B",
      correct_option: "0",
    });
    expect(normalized.subjectRef).toBe("English");
    expect(normalized.payload.text).toBe("Aliased question");
  });
});

describe("questionSignature", () => {
  it("ignores case and runs of whitespace", () => {
    expect(questionSignature("  What   is 2 + 2? ")).toBe("what is 2 + 2?");
    expect(questionSignature("WHAT IS 2 + 2?")).toBe("what is 2 + 2?");
    expect(questionSignature("What is 2 + 2?")).not.toBe(questionSignature("What is 3 + 2?"));
  });
});
