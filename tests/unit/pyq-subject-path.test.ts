import { describe, expect, it } from "vitest";
import {
  getPyqPaperPath,
  getPyqSubjectPath,
} from "../../src/lib/pyq-subject-path";

describe("PYQ subject paths", () => {
  it("uses the General Aptitude category for the General Test", () => {
    expect(getPyqSubjectPath("general-test", "general")).toBe(
      "/cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/subject/general-test",
    );
  });

  it("uses the language and domain categories", () => {
    expect(getPyqSubjectPath("english", "language")).toBe(
      "/cuet-ug-previous-year-question-papers/language-pyqs/subject/english",
    );
    expect(getPyqSubjectPath("accountancy", "domain")).toBe(
      "/cuet-ug-previous-year-question-papers/domain-subject-pyqs/subject/accountancy",
    );
  });

  it("encodes the subject slug in the generated path", () => {
    expect(getPyqSubjectPath("subject name", "domain")).toContain("/subject/subject%20name");
  });

  it("places each paper under its category and subject archive path", () => {
    expect(getPyqPaperPath("paper-2025-shift-1", "general-test", "general")).toBe(
      "/cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/subject/general-test/paper-2025-shift-1",
    );
    expect(getPyqPaperPath("paper-2025", "english", "language")).toBe(
      "/cuet-ug-previous-year-question-papers/language-pyqs/subject/english/paper-2025",
    );
  });
});
