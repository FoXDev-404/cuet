import { describe, expect, it } from "vitest";
import {
  getPyqPaperPath,
  getPyqSubjectPath,
  PYQ_ARCHIVE_PATH,
  PYQ_CATEGORY_SLUGS,
  resolveEmptyPyqArchiveRedirect,
  resolvePyqCategoryRoot,
} from "../../src/lib/pyq-subject-path";

describe("PYQ subject paths", () => {
  it("uses the General Aptitude category for the General Test", () => {
    expect(getPyqSubjectPath("general-test", "general")).toBe(
      "/cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test",
    );
  });

  it("uses the language and domain categories", () => {
    expect(getPyqSubjectPath("english", "language")).toBe(
      "/cuet-ug-previous-year-question-papers/language-pyqs/english",
    );
    expect(getPyqSubjectPath("accountancy", "domain")).toBe(
      "/cuet-ug-previous-year-question-papers/domain-subject-pyqs/accountancy",
    );
  });

  it("encodes the subject slug in the generated path", () => {
    expect(getPyqSubjectPath("subject name", "domain")).toContain("/domain-subject-pyqs/subject%20name");
  });

  it("places each paper under its category and subject archive path", () => {
    expect(getPyqPaperPath("paper-2025-shift-1", "general-test", "general")).toBe(
      "/cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test/paper-2025-shift-1",
    );
    expect(getPyqPaperPath("paper-2025", "english", "language")).toBe(
      "/cuet-ug-previous-year-question-papers/language-pyqs/english/paper-2025",
    );
  });

  it("recognises only the three canonical category roots", () => {
    expect(PYQ_CATEGORY_SLUGS).toEqual([
      "general-aptitude-test-pyqs",
      "language-pyqs",
      "domain-subject-pyqs",
    ]);
    for (const category of PYQ_CATEGORY_SLUGS) {
      expect(resolvePyqCategoryRoot(category)).toBe(PYQ_ARCHIVE_PATH);
    }
    expect(resolvePyqCategoryRoot("subject")).toBeNull();
    expect(resolvePyqCategoryRoot("general-test")).toBeNull();
  });

  it("redirects an empty year-subject archive to the canonical subject hub", () => {
    expect(
      resolveEmptyPyqArchiveRedirect({
        yearHasPapers: true,
        subjectKnown: true,
        subjectSlug: "general-test",
        subjectType: "general",
      }),
    ).toBe(
      "/cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test",
    );
    expect(
      resolveEmptyPyqArchiveRedirect({
        yearHasPapers: false,
        subjectKnown: true,
        subjectSlug: "general-test",
        subjectType: "general",
      }),
    ).toBeNull();
    expect(
      resolveEmptyPyqArchiveRedirect({
        yearHasPapers: true,
        subjectKnown: false,
        subjectSlug: "not-a-subject",
        subjectType: null,
      }),
    ).toBeNull();
  });
});
