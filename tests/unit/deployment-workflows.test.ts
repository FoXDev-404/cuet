import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { archiveGuardDecision } from "../../scripts/lib/import-guard.mjs";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("deployment workflows cannot resurrect archived papers", () => {
  it("keeps the production workflow off the legacy D1 seed import", () => {
    const production = read(".github/workflows/deploy-production.yml");
    expect(production).not.toContain("import-practice-library");
    expect(production).not.toContain("import-ranked-practice");
    expect(production).not.toContain("db:import:practice");
  });

  it("smoke-tests the live paper count", () => {
    const production = read(".github/workflows/deploy-production.yml");
    expect(production).toContain('--expect "132 papers"');
  });

  it("guards the seed importer against overwriting the archive", () => {
    expect(archiveGuardDecision(231, false).blocked).toBe(true);
    expect(archiveGuardDecision(231, true).blocked).toBe(false);
    expect(archiveGuardDecision(0, false).blocked).toBe(false);
    expect(archiveGuardDecision(null, false).blocked).toBe(true);

    const script = read("scripts/import-practice-library.mjs");
    expect(script).toContain("archiveGuardDecision");
    expect(script).toContain("--allow-archive-reset");
  });
});

describe("admin sidebar focus leaves the hidden drawer", () => {
  it("moves focus before aria-hidden is applied", () => {
    const layout = read("src/layouts/AdminLayout.astro");
    const focusGuard = layout.indexOf("if (!visible && sidebar.contains(document.activeElement))");
    const ariaHidden = layout.indexOf("sidebar.inert = !visible");
    expect(focusGuard).toBeGreaterThan(-1);
    expect(ariaHidden).toBeGreaterThan(-1);
    expect(focusGuard).toBeLessThan(ariaHidden);
  });
});
