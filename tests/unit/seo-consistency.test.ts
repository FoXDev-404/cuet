import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Fix 7 — Duplicate Hubs and Sitemap Consistency", () => {
  const root = process.cwd();

  it("verifies /cuet-mock-test and /cuet-ug-mock-test 301-redirect to /mock-tests", () => {
    for (const page of ["src/pages/cuet-mock-test.astro", "src/pages/cuet-ug-mock-test.astro"]) {
      const file = readFileSync(join(root, page), "utf8");
      expect(file, page).toContain('Astro.redirect("/mock-tests", 301)');
    }
  });

  it("verifies /pyq 301-redirects to /cuet-ug-previous-year-papers", () => {
    const file = readFileSync(join(root, "src/pages/pyq/index.ts"), "utf8");
    expect(file).toContain('headers: { location: "/cuet-ug-previous-year-papers" }');
    expect(file).toContain("status: 301");
  });

  it("verifies /mock/[slug] noindexes practice-paper wrapper mocks and sets canonical to /mock-tests/[slug]", () => {
    const file = readFileSync(join(root, "src/pages/mock/[slug]/index.astro"), "utf8");
    expect(file).toContain("const isPracticeWrapper = Boolean(mock.practice_paper_slug)");
    expect(file).toContain("const canonical = isPracticeWrapper ? `/mock-tests/${mock.practice_paper_slug}` : undefined");
    expect(file).toContain("const noindex = totalQuestions === 0 || isPracticeWrapper");
    expect(file).toContain("canonical={canonical}");
    expect(file).toContain("noindex={noindex}");
  });

  it("verifies sitemap.xml excludes 301 redirects (/cuet-mock-test, /cuet-ug-mock-test, /pyq)", () => {
    const file = readFileSync(join(root, "src/pages/sitemap.xml.ts"), "utf8");
    expect(file).not.toContain('add("/cuet-mock-test"');
    expect(file).not.toContain('add("/cuet-ug-mock-test"');
    expect(file).not.toContain('add("/pyq"');
  });

  it("verifies sitemap.xml gates unverified exam info pages (important-dates)", () => {
    const file = readFileSync(join(root, "src/pages/sitemap.xml.ts"), "utf8");
    expect(file).toContain("isExamVerified");
    expect(file).toContain('if (isExamVerified("important-dates")) add("/cuet-ug-important-dates"');
  });

  it("verifies sitemap.xml includes previous-year papers unless rights are restricted", () => {
    const file = readFileSync(join(root, "src/pages/sitemap.xml.ts"), "utf8");
    expect(file).toContain('if (paper.rightsStatus === "restricted") continue;');
    expect(file).toContain("add(paper.path");
  });

  it("verifies zero private routes exist in sitemap.xml generator", () => {
    const file = readFileSync(join(root, "src/pages/sitemap.xml.ts"), "utf8");
    const bannedPrefixes = ["/admin", "/attempt", "/result", "/dashboard", "/dev", "/api", "/login", "/signup"];
    for (const prefix of bannedPrefixes) {
      const regex = new RegExp(`add\\(["'\`]${prefix}`, "i");
      expect(regex.test(file)).toBe(false);
    }
  });

  it("verifies PYQ year and subject hubs are indexable when non-restricted papers exist", () => {
    const yearFile = readFileSync(join(root, "src/pages/pyq/[year].astro"), "utf8");
    expect(yearFile).toContain("const noindex = indexablePaperCount === 0");
    expect(yearFile).toContain('paper.rightsStatus !== "restricted"');
    const subjFile = readFileSync(join(root, "src/pages/pyq/[year]/[subject].astro"), "utf8");
    expect(subjFile).toContain("const noindex = indexablePaperCount === 0");
    expect(subjFile).toContain('paper.rightsStatus !== "restricted"');
    const sitemap = readFileSync(join(root, "src/pages/sitemap.xml.ts"), "utf8");
    expect(sitemap).toContain("for (const year of indexablePyqYears)");
    expect(sitemap).toContain("add(`/pyq/${entry.year}/${entry.subject}`");
  });
});

