import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  hasSubstantiveSeoIntro,
  limitSeoDescription,
  rankedPaperMetaDescription,
} from "../../src/lib/seo-content";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("noindex duplicate routes stay crawlable", () => {
  it("points instructions canonicals at the indexable paper and keeps follow", () => {
    const file = read("src/pages/mock/[slug]/instructions.astro");
    expect(file).toContain("m.practice_paper_slug");
    expect(file).toContain("const canonical = mock.practice_paper_slug");
    expect(file).toContain("? localPaperPath(mock.practice_paper_slug)");
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

describe("indexability and internal-link fixes", () => {
  it("derives paper robots from the listing gate and rights status", () => {
    const file = read(
      "src/pages/cuet-ug-previous-year-question-papers/[category]/[subject]/[paper].astro",
    );
    expect(file).toContain("localPaperRobots");
    expect(file).toContain("robots={localPaperRobots(paper)}");
  });

  it("keeps public profiles out of the index but followable", () => {
    const file = read("src/pages/u/[username].astro");
    expect(file).toContain('robots="noindex, follow"');
  });

  it("keeps profile URLs out of the sitemap", () => {
    // Profiles are linked from leaderboards and discussion for people, not
    // for crawlers. A noindex URL in the sitemap only asks Google to fetch a
    // page we do not want indexed, so the sitemap must never add one.
    const sitemap = read("src/pages/sitemap.xml.ts");
    expect(sitemap).not.toContain('add("/u/');
    expect(sitemap).not.toContain("add(`/u/");
  });

  it("links leaderboard usernames only when the profile is public", () => {
    for (const page of ["src/pages/leaderboard/index.astro", "src/pages/leaderboard/[slug].astro"]) {
      const file = read(page);
      expect(file, page).toContain("u.is_profile_public");
      expect(file, page).toContain("/u/${");
    }
  });

  it("sends result guests straight to login with a return path", () => {
    const file = read("src/pages/result/[attemptId].astro");
    expect(file).not.toContain('href="/signup"');
    expect(file).toContain("loginHref");
    expect(file).toContain("/login?next=");
  });

  it("keeps the single login gate on discussions", () => {
    const file = read("src/pages/mock/[slug]/discussion.astro");
    expect(file).not.toContain("signupHref");
    expect(file).toContain("const loginHref = `/login?next=");
  });

  it("points admin navigation at the moderation route, not the legacy redirect", () => {
    const file = read("src/layouts/AdminLayout.astro");
    expect(file).not.toContain('href: "/admin/discussions"');
    expect(file).toContain('href: "/admin/moderation"');
    expect(read("src/pages/admin/discussions.astro")).toContain("Astro.redirect");
  });

  it("does not advertise the disallowed /search endpoint in homepage JSON-LD", () => {
    const file = read("src/pages/index.astro");
    expect(file).not.toContain("SearchAction");
    expect(file).not.toContain("/search?q=");
    expect(file).toContain('"@type": "WebSite"');
  });

  it("serves category roots and empty year-subject archives with redirects", () => {
    const categoryRoute = read(
      "src/pages/cuet-ug-previous-year-question-papers/[category]/index.ts",
    );
    expect(categoryRoute).toContain("resolvePyqCategoryRoot");
    expect(categoryRoute).toContain("status: 404");
    expect(categoryRoute).toContain("redirect");

    const archive = read("src/pages/pyq/[year]/[subject].astro");
    expect(archive).toContain("resolveEmptyPyqArchiveRedirect");
    expect(archive).toContain("303");
  });
});

describe("substantive SEO archive content", () => {
  it("requires at least 300 words of editorial intro, excluding markup and hidden content", () => {
    const words = Array.from({ length: 300 }, (_, index) => `word${index}`).join(" ");
    expect(hasSubstantiveSeoIntro(`<p>${words}</p>`)).toBe(true);
    expect(hasSubstantiveSeoIntro(`<p>${words.split(" ").slice(1).join(" ")}</p>`)).toBe(false);
    expect(
      hasSubstantiveSeoIntro(`<p>${Array.from({ length: 299 }, () => "word").join(" ")}</p><script>hidden hidden</script>`),
    ).toBe(false);
  });

  it("keeps composed-paper meta descriptions within the documented character range", () => {
    const description = rankedPaperMetaDescription({
      dateLabel: "6 June 2026",
      subject: "Chemistry",
      questionCount: 50,
      durationMinutes: 60,
    });
    expect(description.length).toBeGreaterThanOrEqual(120);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).toContain("50 scored questions");
    expect(description).toContain("60-minute timer");
  });

  it("trims long editorial descriptions at a word boundary", () => {
    const description = limitSeoDescription(Array.from({ length: 45 }, () => "guide").join(" "));
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description.endsWith("...")).toBe(true);
    expect(description).not.toContain("gui...");
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

  it("keeps PYQ archives out of search until they have substantive guidance", () => {
    for (const page of ["src/pages/pyq/[year].astro", "src/pages/pyq/[year]/[subject].astro"]) {
      const file = read(page);
      expect(file, page).toContain("hasSubstantiveSeoIntro(seo?.intro_html)");
      expect(file, page).toContain('robots={noindex ? "noindex, follow" : undefined}');
    }
  });
});
