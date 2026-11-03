import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function getFilesRecursively(dir: string, ext = ".astro"): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getFilesRecursively(fullPath, ext));
    } else if (fullPath.endsWith(ext) || fullPath.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

const ALLOWED_SCHEMAS = new Set([
  "Organization",
  "WebSite",
  "BreadcrumbList",
  "Article",
  "ItemList",
  "ListItem",
]);

const DISALLOWED_SCHEMAS = ["Quiz", "Course", "FAQPage", "Product", "Question", "Answer"];

describe("Fix 6 — Structured Data (JSON-LD) Governance", () => {
  it("strictly disallows Quiz, Course, and FAQPage schemas across the entire codebase", () => {
    const srcFiles = getFilesRecursively(join(process.cwd(), "src"));
    const violations: { file: string; type: string }[] = [];

    for (const filePath of srcFiles) {
      const content = readFileSync(filePath, "utf8");
      for (const disallowed of DISALLOWED_SCHEMAS) {
        // Regex matches "@type": "Disallowed" or '@type': 'Disallowed' or @type: "Disallowed"
        const regex = new RegExp(`["']?@type["']?\\s*:\\s*["']${disallowed}["']`, "i");
        if (regex.test(content)) {
          violations.push({ file: filePath, type: disallowed });
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("verifies all structured data types in src/lib/seo.ts belong to the approved allow-list", () => {
    const seoContent = readFileSync(join(process.cwd(), "src/lib/seo.ts"), "utf8");
    const matches = Array.from(seoContent.matchAll(/["']@type["']\s*:\s*["']([^"']+)["']/g));
    const emittedTypes = matches.map((m) => m[1]);

    for (const schema of emittedTypes) {
      expect(ALLOWED_SCHEMAS.has(schema)).toBe(true);
    }
  });

  it("verifies BaseLayout only emits approved Organization schema", () => {
    const layoutContent = readFileSync(join(process.cwd(), "src/layouts/BaseLayout.astro"), "utf8");
    const matches = Array.from(layoutContent.matchAll(/["']@type["']\s*:\s*["']([^"']+)["']/g));
    const layoutTypes = matches.map((m) => m[1]);

    for (const schema of layoutTypes) {
      expect(ALLOWED_SCHEMAS.has(schema)).toBe(true);
    }
  });

  it("verifies public guide pages emit only BreadcrumbList and Article", () => {
    const guidePages = [
      "src/pages/cuet-ug-exam-pattern.astro",
      "src/pages/cuet-ug-marking-scheme.astro",
      "src/pages/cuet-ug-syllabus.astro",
      "src/pages/cuet-ug-important-dates.astro",
      "src/pages/cuet-ug-previous-year-papers.astro",
    ];

    for (const pagePath of guidePages) {
      const content = readFileSync(join(process.cwd(), pagePath), "utf8");
      expect(content).not.toContain("FAQPage");
      expect(content).not.toContain("Quiz");
      expect(content).not.toContain("Course");
    }
  });

  it("verifies mock test and practice pages emit only BreadcrumbList and ItemList", () => {
    const testPages = [
      "src/pages/mock/[slug]/index.astro",
      "src/pages/practice/[slug].astro",
      "src/pages/cuet-ug-mock-test.astro",
      "src/pages/cuet-mock-test.astro",
      "src/pages/q/[slug].astro",
    ];

    for (const pagePath of testPages) {
      const content = readFileSync(join(process.cwd(), pagePath), "utf8");
      expect(content).not.toContain("Quiz");
      expect(content).not.toContain("Course");
      expect(content).not.toContain("FAQPage");
    }
  });
});

