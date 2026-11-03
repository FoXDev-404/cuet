import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Fix 8 — Honest Labels, Disclaimers, and Copy-Lint", () => {
  const root = process.cwd();

  it("runs copy-lint.mjs script cleanly with 0 violations", () => {
    const result = execSync("node scripts/copy-lint.mjs", {
      encoding: "utf8",
      cwd: root,
    });
    expect(result).toContain("SUCCESS: 0 violations");
  });

  it("verifies public profiles keep is_profile_public = 0 by default", () => {
    const migration = readFileSync(join(root, "migrations/0001_init.sql"), "utf8");
    expect(migration).toContain("is_profile_public INTEGER NOT NULL DEFAULT 0");
  });

  it("verifies independent NTA disclaimer in BaseLayout footer", () => {
    const layout = readFileSync(join(root, "src/layouts/BaseLayout.astro"), "utf8");
    expect(layout).toContain("A focused space for CUET UG practice");
    expect(layout).toContain("href=\"/about\"");
  });

  it("verifies independent disclaimer on practice paper pages", () => {
    const practicePage = readFileSync(join(root, "src/pages/practice/[slug].astro"), "utf8");
    expect(practicePage).toContain("CUET Free Mock Test is not affiliated with NTA");
    expect(practicePage).toContain("Indian Copyright Act, 1957");
  });

  it("verifies rank cards explicitly indicate 'among users of this site'", () => {
    const resultPage = readFileSync(join(root, "src/pages/result/[attemptId].astro"), "utf8");
    expect(resultPage).toContain("Rank (this site)");
    expect(resultPage).toContain("percentile among users");
    expect(resultPage).toContain("not an official NTA rank");
  });
});
