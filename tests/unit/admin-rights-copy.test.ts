import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("admin rights copy matches the enforcement code", () => {
  const file = read("src/pages/admin/pyq.astro");

  it("says only Restricted papers are quarantined", () => {
    expect(file).toContain("Only papers marked <strong>Restricted</strong>");
    expect(file).not.toContain("Papers not marked <strong>cleared</strong> are automatically quarantined");
    expect(file).not.toContain("excluded from sitemaps, and stripped of ads");
  });

  it("does not claim unknown papers are noindexed", () => {
    expect(file).not.toContain("Forced noindex, no ads");
    expect(file).toContain("Live · rights unconfirmed");
  });
});
