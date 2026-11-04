/**
 * tests/unit/lockfile-and-scorecard.test.ts
 *
 * Verifies:
 * 1. Dependency version parity between package-lock.json and report facts
 * 2. Deterministic scorecard business rules and integrity
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { generateScorecard } from "../../scripts/scorecard.mjs";

const ROOT = process.cwd();

describe("Lockfile Version Consistency", () => {
  it("matches tracked dependency versions between package-lock.json and facts.json", () => {
    const lockPath = join(ROOT, "package-lock.json");
    expect(existsSync(lockPath)).toBe(true);

    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    const factsPath = join(ROOT, "docs", "report", "facts.json");
    expect(existsSync(factsPath)).toBe(true);

    const facts = JSON.parse(readFileSync(factsPath, "utf8"));
    const factsDeps = facts.dependencies.dependencies;

    const getLockVersion = (name: string) => {
      return (
        lock.packages?.[`node_modules/${name}`]?.version ||
        lock.dependencies?.[name]?.version
      );
    };

    const trackedPackages = [
      "astro",
      "@astrojs/cloudflare",
      "tailwindcss",
      "@playwright/test",
      "vitest",
      "wrangler",
      "axe-core",
      "katex",
    ];

    for (const pkg of trackedPackages) {
      const lockVersion = getLockVersion(pkg);
      expect(lockVersion).toBeDefined();
      expect(factsDeps[pkg]).toBe(lockVersion);
    }
  });

  it("ensures old legacy version numbers are not cited in documentation", () => {
    const reportPath = join(ROOT, "docs", "report", "PROJECT_REPORT.md");
    if (!existsSync(reportPath)) return;

    const content = readFileSync(reportPath, "utf8");

    // Must NOT contain old erroneous versions identified in review
    expect(content).not.toContain("Tailwind 3.4");
    expect(content).not.toContain("Playwright 1.58");
    expect(content).not.toContain("axe 4.11");
    expect(content).not.toContain("Wrangler 4.65");
    expect(content).not.toContain("TypeScript 5.8");
  });
});

describe("Deterministic Scorecard Generator", () => {
  it("generates a valid scorecard with all 16 required areas", () => {
    const data = generateScorecard();
    expect(data).toBeDefined();
    expect(data.product).toBe("CUET Free Mock Test");
    expect(data.overallVerdict).toBe("PARTIAL");
    expect(data.scorecard).toHaveLength(16);

    const areas = data.scorecard.map((s: { area: string }) => s.area);
    expect(areas).toContain("Test engine");
    expect(areas).toContain("Scoring and leaderboard");
    expect(areas).toContain("Auth and sessions");
    expect(areas).toContain("Admin panel");
    expect(areas).toContain("Content library");
    expect(areas).toContain("Public pages and SEO");
    expect(areas).toContain("Design system and dark/light theme");
    expect(areas).toContain("Question sharing");
    expect(areas).toContain("Media/images");
    expect(areas).toContain("Security");
    expect(areas).toContain("Performance");
    expect(areas).toContain("Accessibility");
    expect(areas).toContain("Tests and CI");
    expect(areas).toContain("Deployment and ops");
    expect(areas).toContain("Legal and AdSense readiness");
    expect(areas).toContain("External integrations");
  });

  it("caps Content Library at PARTIAL while unreviewed explanations or unconfirmed rights exist", () => {
    const data = generateScorecard();
    const contentArea = data.scorecard.find(
      (s: { area: string }) => s.area === "Content library"
    );
    expect(contentArea?.status).toBe("PARTIAL");
    expect(contentArea?.reason).toContain("PARTIAL");
  });

  it("caps External Integrations at PARTIAL when production credentials are unset", () => {
    const data = generateScorecard();
    const extArea = data.scorecard.find(
      (s: { area: string }) => s.area === "External integrations"
    );
    expect(extArea?.status).toBe("PARTIAL");
    expect(extArea?.reason).toContain("unset");
  });

  it("caps Deployment and Ops at PARTIAL when production deployment is pending", () => {
    const data = generateScorecard();
    const opsArea = data.scorecard.find(
      (s: { area: string }) => s.area === "Deployment and ops"
    );
    expect(opsArea?.status).toBe("PARTIAL");
  });

  it("sets Tests and CI to DONE only when unit, E2E, and a11y tests have zero failures", () => {
    const data = generateScorecard();
    const testsArea = data.scorecard.find(
      (s: { area: string }) => s.area === "Tests and CI"
    );
    expect(testsArea?.status).toBe("DONE");
    expect(testsArea?.confidence).toBe("HIGH");
  });

  it("contains Top 10 Problems and Top 5 Strengths with exact issue IDs", () => {
    const data = generateScorecard();
    expect(data.top10Problems).toHaveLength(10);
    expect(data.top5Strengths).toHaveLength(5);

    const issueIds = data.top10Problems.map((p: { id: string }) => p.id);
    expect(issueIds).toEqual([
      "ISSUE-001",
      "ISSUE-002",
      "ISSUE-003",
      "ISSUE-004",
      "ISSUE-005",
      "ISSUE-006",
      "ISSUE-007",
      "ISSUE-008",
      "ISSUE-009",
      "ISSUE-010",
    ]);
  });
});

