import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Fix 7 — Duplicate Hubs and Sitemap Consistency", () => {
  const root = process.cwd();

  it("verifies /cuet-mock-test 301-redirects to /cuet-ug-mock-test", () => {
    const file = readFileSync(join(root, "src/pages/cuet-mock-test.astro"), "utf8");
    expect(file).toContain('Astro.redirect("/cuet-ug-mock-test", 301)');
  });

  it("verifies /pyq 301-redirects to /cuet-ug-previous-year-papers", () => {
    const file = readFileSync(join(root, "src/pages/pyq/index.ts"), "utf8");
    expect(file).toContain('headers: { location: "/cuet-ug-previous-year-papers" }');
    expect(file).toContain("status: 301");
  });

  it("verifies /mock/[slug] noindexes practice-paper wrapper mocks and sets canonical to /practice/[slug]", () => {
    const file = readFileSync(join(root, "src/pages/mock/[slug]/index.astro"), "utf8");
    expect(file).toContain("const isPracticeWrapper = Boolean(mock.practice_paper_slug)");
    expect(file).toContain("const canonical = isPracticeWrapper ? `/practice/${mock.practice_paper_slug}` : undefined");
    expect(file).toContain("const noindex = totalQuestions === 0 || isPracticeWrapper");
    expect(file).toContain("canonical={canonical}");
    expect(file).toContain("noindex={noindex}");
  });

  it("verifies sitemap.xml excludes 301 redirects (/cuet-mock-test, /pyq)", () => {
    const file = readFileSync(join(root, "src/pages/sitemap.xml.ts"), "utf8");
    expect(file).not.toContain('add("/cuet-mock-test"');
    expect(file).not.toContain('add("/pyq"');
  });

  it("verifies sitemap.xml gates unverified exam info pages (important-dates)", () => {
    const file = readFileSync(join(root, "src/pages/sitemap.xml.ts"), "utf8");
    expect(file).toContain("isExamVerified");
    expect(file).toContain('if (isExamVerified("important-dates")) add("/cuet-ug-important-dates"');
  });

  it("verifies sitemap.xml gates un-cleared previous-year papers", () => {
    const file = readFileSync(join(root, "src/pages/sitemap.xml.ts"), "utf8");
    expect(file).toContain('if (rights === "cleared")');
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
});

