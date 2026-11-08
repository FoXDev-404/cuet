import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GUIDE_CATEGORY_ORDER,
  START_HERE_SLUGS,
  STATIC_GUIDES,
} from "../../src/content/guides";

const INDEX = JSON.parse(readFileSync("src/data/local-papers/index.json", "utf8")) as {
  papers?: { slug: string; subject?: { slug?: string } }[];
};

const PAPER_SLUGS = new Set((INDEX.papers ?? []).map((paper) => paper.slug));
const SUBJECT_SLUGS = new Set(
  (INDEX.papers ?? [])
    .map((paper) => paper.subject?.slug)
    .filter((slug): slug is string => Boolean(slug)),
);
const GUIDE_SLUGS = new Set(STATIC_GUIDES.map((guide) => guide.slug));
const CATEGORIES = new Set<string>(GUIDE_CATEGORY_ORDER);

/** Every non-dynamic page under src/pages, as a public URL path. */
function staticRoutes(): Set<string> {
  const routes = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".astro")) continue;
      const relative = full
        .replace(/\\/g, "/")
        .replace(/^src\/pages/, "")
        .replace(/\.astro$/, "")
        .replace(/\/index$/, "");
      if (relative.includes("[")) continue;
      routes.add(relative === "" ? "/" : relative);
    }
  };
  walk("src/pages");
  return routes;
}

const STATIC_ROUTES = staticRoutes();

function words(body: string): number {
  return body.split(/\s+/).filter(Boolean).length;
}

function internalLinks(body: string): string[] {
  return [...body.matchAll(/\]\((\/[^)\s#]+)\)/g)].map((match) => match[1]);
}

describe("repository guide library", () => {
  it("ships a substantial library with unique slugs", () => {
    expect(STATIC_GUIDES.length).toBeGreaterThanOrEqual(26);
    expect(new Set(STATIC_GUIDES.map((guide) => guide.slug)).size).toBe(STATIC_GUIDES.length);
  });

  it("keeps every title inside the 30-70 character SERP window", () => {
    const bad = STATIC_GUIDES.filter(
      (guide) => guide.title.length < 30 || guide.title.length > 70,
    ).map((guide) => `${guide.slug} (${guide.title.length}): ${guide.title}`);
    expect(bad).toEqual([]);
  });

  it("keeps every description inside the 120-160 character window", () => {
    const bad = STATIC_GUIDES.filter(
      (guide) => guide.description.length < 120 || guide.description.length > 160,
    ).map((guide) => `${guide.slug} (${guide.description.length})`);
    expect(bad).toEqual([]);
  });

  it("publishes only substantial bodies", () => {
    const bad = STATIC_GUIDES.filter((guide) => words(guide.body) < 300).map(
      (guide) => `${guide.slug} (${words(guide.body)} words)`,
    );
    expect(bad).toEqual([]);
  });

  it("uses a known category and a real publication order", () => {
    for (const guide of STATIC_GUIDES) {
      expect(CATEGORIES.has(guide.category), guide.slug).toBe(true);
      expect(guide.publishedAt, guide.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(`${guide.publishedAt}T00:00:00Z`).getTime())).toBe(false);
      if (guide.updatedAt) {
        expect(guide.updatedAt >= guide.publishedAt, guide.slug).toBe(true);
      }
    }
  });

  it("links the Start here cards to real guides", () => {
    expect(START_HERE_SLUGS.length).toBe(3);
    for (const slug of START_HERE_SLUGS) {
      expect(GUIDE_SLUGS.has(slug), slug).toBe(true);
    }
  });

  it("resolves every internal link in every guide", () => {
    const bad: string[] = [];
    for (const guide of STATIC_GUIDES) {
      for (const url of internalLinks(guide.body)) {
        if (url === "/blog") continue;
        if (url.startsWith("/blog/")) {
          if (!GUIDE_SLUGS.has(url.slice("/blog/".length))) bad.push(`${guide.slug} -> ${url}`);
          continue;
        }
        if (url.startsWith("/mock-tests/")) {
          if (!PAPER_SLUGS.has(url.slice("/mock-tests/".length))) bad.push(`${guide.slug} -> ${url}`);
          continue;
        }
        if (url.startsWith("/cuet-mock-test/")) {
          if (!SUBJECT_SLUGS.has(url.slice("/cuet-mock-test/".length))) {
            bad.push(`${guide.slug} -> ${url}`);
          }
          continue;
        }
        if (!STATIC_ROUTES.has(url)) bad.push(`${guide.slug} -> ${url}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("scans repository guides with the copy-lint allow-list", () => {
    const script = readFileSync("scripts/copy-lint.mjs", "utf8");
    expect(script).toContain('"src/content"');
  });
});
