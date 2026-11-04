import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  isFixtureSlug,
  isFixtureMock,
  isFixtureQuestion,
  isProductionEnvironment,
} from "../../src/lib/fixtures";

describe("Fixture & Test Data Isolation (Fix R5)", () => {
  describe("Slug pattern detection", () => {
    it("identifies E2E and test fixture slugs correctly", () => {
      expect(isFixtureSlug("e2e-local-fixture-mock")).toBe(true);
      expect(isFixtureSlug("e2e-publish-check-mvxr4ko7cafa")).toBe(true);
      expect(isFixtureSlug("e2e-share-mock-mvyu0h5f23wqzt")).toBe(true);
      expect(isFixtureSlug("slow-network-check")).toBe(true);
      expect(isFixtureSlug("fixture-mock-1")).toBe(true);
      expect(isFixtureSlug("my-test-mock")).toBe(true);
    });

    it("allows real exam and practice slugs", () => {
      expect(isFixtureSlug("cuet-ug-physics-2024")).toBe(false);
      expect(isFixtureSlug("cuet-ug-chemistry-2024-shift-1")).toBe(false);
      expect(isFixtureSlug("mathematics-mock-paper-1")).toBe(false);
      expect(isFixtureSlug("general-test-practice-set")).toBe(false);
      expect(isFixtureSlug("")).toBe(false);
      expect(isFixtureSlug(null)).toBe(false);
      expect(isFixtureSlug(undefined)).toBe(false);
    });
  });

  describe("Mock title and object detection", () => {
    it("flags synthetic mock records", () => {
      expect(isFixtureMock({ slug: "e2e-local-fixture-mock", title: "E2E Local Fixture Mock" })).toBe(true);
      expect(isFixtureMock({ slug: "real-slug", title: "E2E publish check mvx" })).toBe(true);
      expect(isFixtureMock({ slug: "slow-network-check", title: "Slow network check" })).toBe(true);
    });

    it("allows real mock titles and objects", () => {
      expect(
        isFixtureMock({
          slug: "cuet-ug-physics-2024",
          title: "CUET UG Physics 2024 Official Paper",
        }),
      ).toBe(false);
      expect(isFixtureMock(null)).toBe(false);
      expect(isFixtureMock(undefined)).toBe(false);
    });
  });

  describe("Question fixture detection", () => {
    it("detects synthetic fixture questions", () => {
      expect(
        isFixtureQuestion({ text: "E2E fixture question 01: Which option is correct?" }),
      ).toBe(true);
      expect(isFixtureQuestion({ text: "Sample fixture question for audit" })).toBe(true);
    });

    it("allows real exam questions", () => {
      expect(
        isFixtureQuestion({
          text: "$$ \\int\\frac{e^{2x}-e^{-2x}}{e^{2x}+e^{-2x}}dx $$ is equal to:",
        }),
      ).toBe(false);
      expect(
        isFixtureQuestion({
          text: "Linear inequalities corresponding to the shaded feasible region OABCO in the given figure are",
        }),
      ).toBe(false);
      expect(isFixtureQuestion(null)).toBe(false);
      expect(isFixtureQuestion(undefined)).toBe(false);
    });
  });

  describe("Environment detection", () => {
    it("identifies production environment flag", () => {
      expect(isProductionEnvironment({ ENV: "production" })).toBe(true);
      expect(isProductionEnvironment({ ENV: "Production " })).toBe(true);
      expect(isProductionEnvironment({ ENV: "staging" })).toBe(false);
      expect(isProductionEnvironment({ ENV: "development" })).toBe(false);
      expect(isProductionEnvironment({})).toBe(false);
    });
  });

  describe("export-content.mjs fixture and user data isolation", () => {
    it("exports clean content with zero user rows and zero fixture rows", () => {
      const testExportPath = resolve(process.cwd(), "test-fixtures-export.sql");
      if (existsSync(testExportPath)) unlinkSync(testExportPath);

      try {
        const stdout = execSync(
          `node scripts/export-content.mjs --output test-fixtures-export.sql`,
          { encoding: "utf8" },
        );
        expect(stdout).toContain("Leak check passed");

        expect(existsSync(testExportPath)).toBe(true);
        const sql = readFileSync(testExportPath, "utf8");

        // Forbidden user tables
        expect(sql).not.toContain("INSERT OR REPLACE INTO users ");
        expect(sql).not.toContain("INSERT OR REPLACE INTO sessions ");
        expect(sql).not.toContain("INSERT OR REPLACE INTO attempts ");
        expect(sql).not.toContain("INSERT OR REPLACE INTO attempt_answers ");

        // Fixture items
        expect(sql).not.toContain("e2e-local-fixture-mock");
        expect(sql).not.toContain("e2e-publish-check");
        expect(sql).not.toContain("e2e-share-mock");
        expect(sql).not.toContain("slow-network-check");
        expect(sql).not.toContain("E2E fixture question");

        // Legitimate content
        expect(sql).toContain("INSERT OR REPLACE INTO mock_tests ");
        expect(sql).toContain("INSERT OR REPLACE INTO questions ");
        expect(sql).toContain("INSERT OR REPLACE INTO practice_papers ");
      } finally {
        if (existsSync(testExportPath)) unlinkSync(testExportPath);
      }
    });
  });
});
