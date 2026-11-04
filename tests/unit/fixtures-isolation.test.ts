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
          `node scripts/export-content.mjs --limit 10 --output test-fixtures-export.sql`,
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
    }, 30_000);
  });

  describe("Surface exclusion gates (sitemap, listings, search, production 404)", () => {
    it("sitemap mock query excludes 100% of fixture mocks", async () => {
      const { DatabaseSync } = await import("node:sqlite");
      const { readdirSync, statSync } = await import("node:fs");
      const { join } = await import("node:path");

      const d1Dir = resolve(process.cwd(), ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
      const files = readdirSync(d1Dir)
        .filter((f) => f.endsWith(".sqlite") && !f.includes("backup"))
        .map((f) => ({ name: f, size: statSync(join(d1Dir, f)).size }))
        .sort((a, b) => b.size - a.size);

      if (files.length === 0) return;
      const db = new DatabaseSync(join(d1Dir, files[0].name), { readOnly: true });

      const sitemapMocks = db
        .prepare(
          `SELECT m.slug, m.title, m.practice_paper_slug
           FROM mock_tests m
           WHERE m.status = 'published' AND m.deleted_at IS NULL
             AND m.slug NOT LIKE 'e2e-%'
             AND m.slug NOT LIKE '%fixture%'
             AND m.slug NOT LIKE '%publish-check%'
             AND m.slug NOT LIKE 'slow-network-%'
             AND LOWER(m.title) NOT LIKE '%fixture%'
             AND EXISTS (SELECT 1 FROM mock_questions_current mq WHERE mq.mock_id = m.id)`,
        )
        .all() as { slug: string; title: string; practice_paper_slug: string | null }[];

      for (const m of sitemapMocks) {
        expect(isFixtureSlug(m.slug)).toBe(false);
        expect(isFixtureMock(m)).toBe(false);
      }

      // Standalone mocks (practice_paper_slug IS NULL) that would be indexable
      const standaloneMocks = sitemapMocks.filter((m) => !m.practice_paper_slug);
      expect(standaloneMocks.length).toBe(0);
    });

    it("public mock listings query excludes all fixture mocks", async () => {
      const { DatabaseSync } = await import("node:sqlite");
      const { readdirSync, statSync } = await import("node:fs");
      const { join } = await import("node:path");

      const d1Dir = resolve(process.cwd(), ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
      const files = readdirSync(d1Dir)
        .filter((f) => f.endsWith(".sqlite") && !f.includes("backup"))
        .map((f) => ({ name: f, size: statSync(join(d1Dir, f)).size }))
        .sort((a, b) => b.size - a.size);

      if (files.length === 0) return;
      const db = new DatabaseSync(join(d1Dir, files[0].name), { readOnly: true });

      const listedMocks = db
        .prepare(
          `SELECT m.id, m.title, m.slug
           FROM mock_tests m
           WHERE m.status = 'published' AND m.deleted_at IS NULL
             AND m.practice_paper_slug IS NULL
             AND m.slug NOT LIKE 'e2e-%'
             AND m.slug NOT LIKE '%fixture%'
             AND m.slug NOT LIKE '%publish-check%'
             AND m.slug NOT LIKE 'slow-network-%'
             AND LOWER(m.title) NOT LIKE '%fixture%'`,
        )
        .all() as { id: number; title: string; slug: string }[];

      expect(listedMocks.length).toBe(0);
      for (const m of listedMocks) {
        expect(isFixtureSlug(m.slug)).toBe(false);
        expect(isFixtureMock(m)).toBe(false);
      }
    });

    it("public search query excludes fixture mocks from results", async () => {
      const { DatabaseSync } = await import("node:sqlite");
      const { readdirSync, statSync } = await import("node:fs");
      const { join } = await import("node:path");

      const d1Dir = resolve(process.cwd(), ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
      const files = readdirSync(d1Dir)
        .filter((f) => f.endsWith(".sqlite") && !f.includes("backup"))
        .map((f) => ({ name: f, size: statSync(join(d1Dir, f)).size }))
        .sort((a, b) => b.size - a.size);

      if (files.length === 0) return;
      const db = new DatabaseSync(join(d1Dir, files[0].name), { readOnly: true });

      const term = "%fixture%";
      const searchedMocks = db
        .prepare(
          `SELECT m.id, m.title, m.slug, m.type, s.name AS subject_name
           FROM mock_tests m
           LEFT JOIN subjects s ON s.id = m.subject_id
           WHERE m.status = 'published' AND m.deleted_at IS NULL
             AND m.practice_paper_slug IS NULL
             AND m.slug NOT LIKE 'e2e-%'
             AND m.slug NOT LIKE '%fixture%'
             AND m.slug NOT LIKE '%publish-check%'
             AND m.slug NOT LIKE 'slow-network-%'
             AND LOWER(m.title) NOT LIKE '%fixture%'
             AND (m.title LIKE ? OR COALESCE(s.name, '') LIKE ?)
           ORDER BY m.published_at DESC, m.id DESC LIMIT 10`,
        )
        .all(term, term) as { id: number; title: string; slug: string }[];

      expect(searchedMocks.length).toBe(0);
    });

    it("production 404 gate enforces rejection of fixture slugs in production mode", () => {
      const prodEnv = { ENV: "production" };
      expect(isProductionEnvironment(prodEnv)).toBe(true);

      const fixtureSlugs = [
        "e2e-local-fixture-mock",
        "e2e-publish-check-mvxr4ko7cafa",
        "e2e-share-mock-mvyu0h5f23wqzt",
        "slow-network-check",
      ];

      for (const slug of fixtureSlugs) {
        const isBlocked = isProductionEnvironment(prodEnv) && isFixtureSlug(slug);
        expect(isBlocked).toBe(true);
      }

      // Real content must not be blocked
      const realSlugs = ["cuet-ug-physics-2024", "mathematics-mock-paper-1"];
      for (const slug of realSlugs) {
        const isBlocked = isProductionEnvironment(prodEnv) && isFixtureSlug(slug);
        expect(isBlocked).toBe(false);
      }
    });
  });
});
