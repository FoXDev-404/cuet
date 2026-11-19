import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const redirectSource = readFileSync(
  resolve(process.cwd(), "scripts/fix-archived-redirects.mjs"),
  "utf8",
);
const curationSource = readFileSync(
  resolve(process.cwd(), "scripts/flag-duplicate-options.mjs"),
  "utf8",
);

describe("QA one-off production scripts", () => {
  it("checks the right Turso config field (BUG-010)", () => {
    // getTursoConfig() returns { url, authToken }. Using `token` here made
    // --turso report "credentials missing" even with valid credentials.
    expect(redirectSource).toContain("getTursoConfig()?.authToken");
    expect(curationSource).toContain("getTursoConfig()?.authToken");
    expect(redirectSource).not.toContain("getTursoConfig()?.token");
    expect(curationSource).not.toContain("getTursoConfig()?.token");
  });

  it("validates practice-paper and slug-redirect rows separately (BUG-010)", () => {
    // The remote pre-flight used to apply the is_archived check to slug
    // redirects too, aborting before any write.
    expect(redirectSource).toContain('fix.kind === "practice_paper"');
    expect(redirectSource).toContain("slug redirect for ${fix.slug} is missing");
  });
});
