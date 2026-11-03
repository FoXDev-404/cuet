import { describe, expect, it } from "vitest";
import { orderQuestionsBySections } from "../../src/lib/admin/mock-order";
import { normalizeCanonicalUrl } from "../../src/lib/canonical";

describe("mockbuilder ordering", () => {
  it("orders sections before questions and keeps within-section order stable", () => {
    const questions = [
      { question_id: 1, section: "General Test" },
      { question_id: 2, section: "Language" },
      { question_id: 3, section: "Domain" },
      { question_id: 4, section: "Language" },
    ];
    expect(
      orderQuestionsBySections(questions, ["Language", "Domain", "General Test"]).map(
        (question) => question.question_id,
      ),
    ).toEqual([2, 4, 3, 1]);
  });

  it("appends sections that are missing from the order list", () => {
    const questions = [
      { question_id: 1, section: "General Test" },
      { question_id: 2, section: "Language" },
      { question_id: 3, section: "Domain" },
    ];
    expect(orderQuestionsBySections(questions, ["Domain"]).map((question) => question.question_id)).toEqual([
      3, 1, 2,
    ]);
  });

  it("preserves submission order when no section list is provided", () => {
    const questions = [
      { question_id: 3, section: "Domain" },
      { question_id: 1, section: "Language" },
    ];
    expect(orderQuestionsBySections(questions, []).map((question) => question.question_id)).toEqual([3, 1]);
  });

  it("ignores duplicate section names in the order list", () => {
    const questions = [
      { question_id: 1, section: "Language" },
      { question_id: 2, section: "Domain" },
    ];
    expect(
      orderQuestionsBySections(questions, ["Language", "Language"]).map((question) => question.question_id),
    ).toEqual([1, 2]);
  });
});

describe("canonical URL normalization", () => {
  it("accepts absolute http(s) URLs and strips fragments", () => {
    expect(normalizeCanonicalUrl("https://cuetfreemocktest.com/about#team")).toBe(
      "https://cuetfreemocktest.com/about",
    );
    expect(normalizeCanonicalUrl("http://localhost:4321/mock/demo")).toBe(
      "http://localhost:4321/mock/demo",
    );
  });

  it("rejects relative, script and malformed URLs", () => {
    expect(normalizeCanonicalUrl("/about")).toBeNull();
    expect(normalizeCanonicalUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeCanonicalUrl("not a url")).toBeNull();
    expect(normalizeCanonicalUrl("")).toBeNull();
  });
});
