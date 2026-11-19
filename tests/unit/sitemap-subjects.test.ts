import { describe, expect, it } from "vitest";
import {
  sitemapSyllabusPaths,
  sitemapSubjectPaths,
  type SitemapSubjectStat,
} from "../../src/lib/sitemap-subjects";

function stat(overrides: Partial<SitemapSubjectStat>): SitemapSubjectStat {
  return {
    id: 1,
    slug: "english",
    exam_slug: "cuet-ug",
    bank_question_count: 0,
    mock_count: 0,
    ...overrides,
  };
}

describe("sitemap subject gates", () => {
  it("drops a subject whose only questions belong to archived practice wrappers", () => {
    const paths = sitemapSubjectPaths(
      [
        stat({ id: 16, slug: "legal-studies", bank_question_count: 0, mock_count: 0 }),
        stat({ id: 1, slug: "english", bank_question_count: 120, mock_count: 3 }),
      ],
      new Set(),
      new Set(),
    );
    expect(paths).toEqual(["/cuet-mock-test/english"]);
  });

  it("keeps a subject with a local practice paper", () => {
    const paths = sitemapSubjectPaths(
      [stat({ id: 16, slug: "legal-studies" })],
      new Set(["legal-studies"]),
      new Set(),
    );
    expect(paths).toEqual(["/cuet-mock-test/legal-studies"]);
  });

  it("honours a page-level noindex override", () => {
    const paths = sitemapSubjectPaths(
      [stat({ id: 1, slug: "english", bank_question_count: 120, mock_count: 3 })],
      new Set(),
      new Set(["/cuet-mock-test/english"]),
    );
    expect(paths).toEqual([]);
  });

  it("drops a syllabus URL that the page would 404", () => {
    const paths = sitemapSyllabusPaths(
      [
        stat({ id: 16, slug: "legal-studies", bank_question_count: 0, mock_count: 0 }),
        stat({ id: 14, slug: "sociology", bank_question_count: 0, mock_count: 0 }),
      ],
      new Map([
        [16, 0],
        [14, 9],
      ]),
      new Set(),
      new Set(),
    );
    expect(paths).toEqual(["/cuet-ug-syllabus/sociology"]);
  });

  it("keeps a syllabus page for a subject with live bank content", () => {
    const paths = sitemapSyllabusPaths(
      [stat({ id: 1, slug: "english", bank_question_count: 120, mock_count: 3 })],
      new Map([[1, 0]]),
      new Set(),
      new Set(),
    );
    expect(paths).toEqual(["/cuet-ug-syllabus/english"]);
  });

  it("honours a syllabus page-level noindex override", () => {
    const paths = sitemapSyllabusPaths(
      [stat({ id: 14, slug: "sociology" })],
      new Map([[14, 9]]),
      new Set(),
      new Set(["/cuet-ug-syllabus/sociology"]),
    );
    expect(paths).toEqual([]);
  });
});
