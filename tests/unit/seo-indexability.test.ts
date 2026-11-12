import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("noindex duplicate routes stay crawlable", () => {
  it("points instructions canonicals at the indexable paper and keeps follow", () => {
    const file = read("src/pages/mock/[slug]/instructions.astro");
    expect(file).toContain("m.practice_paper_slug");
    expect(file).toContain("const canonical = mock.practice_paper_slug");
    expect(file).toContain("? `/mock-tests/${mock.practice_paper_slug}`");
    expect(file).toContain('robots="noindex, follow"');
    expect(file).toContain("canonical={canonical}");
  });

  it("resolves relative canonical overrides against the site origin", () => {
    const file = read("src/layouts/BaseLayout.astro");
    // A bare `new URL(relative)` throws, silently keeping the self-canonical.
    expect(file).toContain("new URL(canonicalOverride, site)");
  });

  it("keeps zero-entry leaderboards and wrapper overviews followable", () => {
    const leaderboard = read("src/pages/leaderboard/[slug].astro");
    expect(leaderboard).toContain('"noindex, follow"');
    const overview = read("src/pages/mock/[slug]/index.astro");
    expect(overview).toContain('robots={noindex ? "noindex, follow" : undefined}');
  });
});

describe("database outages cannot change exam-info indexability", () => {
  const pages = [
    "src/pages/cuet-ug-marking-scheme.astro",
    "src/pages/cuet-ug-important-dates.astro",
    "src/pages/cuet-ug-exam-pattern.astro",
    "src/pages/cuet-ug-syllabus.astro",
    "src/pages/cuet-ug-syllabus/[subject].astro",
  ];

  it("routes every public exam-info page through the availability-aware state", () => {
    for (const page of pages) {
      const file = read(page);
      expect(file, page).toContain("getExamInfoState(");
      expect(file, page).toContain("resolveExamVerification(");
      expect(file, page).toContain("DB_DEGRADED_HEADER");
      expect(file, page).not.toContain("getExamInfo(");
    }
  });

  it("uses the deploy-time fallback in the sitemap instead of dropping URLs", () => {
    const file = read("src/pages/sitemap.xml.ts");
    expect(file).toContain("resolveExamVerification(");
    expect(file).toContain("examInfoAvailable");
    // `readAll` swallows errors, so a fallback decision needs the direct read.
    expect(file).toContain("await all<{ key: string; value: string; last_verified: string | null }>(");
  });

  it("keeps the practice-paper wrapper noindex during a degraded render", () => {
    const fallback = read("src/lib/local-mock-fallback.ts");
    expect(fallback).toContain("practice_paper_slug: string | null");
    expect(fallback).toContain("practice_paper_slug: paper.slug");
  });
});
