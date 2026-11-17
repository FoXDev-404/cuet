import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const API_ROOT = join(process.cwd(), "src/pages/api");

function apiFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...apiFiles(fullPath));
    } else if (fullPath.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("API conventions", () => {
  it("keeps one shared error envelope", () => {
    // `apiError()` emits `{ error }` with the shared JSON headers. A route that
    // hand-rolls JSON.stringify({ error }) is how the media type and cache
    // policy drift apart, so fail on any new copy.
    const offenders = apiFiles(API_ROOT)
      .filter((file) => /JSON\.stringify\(\{\s*error/.test(readFileSync(file, "utf8")))
      .map((file) => relative(process.cwd(), file));
    expect(offenders).toEqual([]);
  });

  it("serves every JSON response without caching", () => {
    const http = readFileSync(join(process.cwd(), "src/lib/http.ts"), "utf8");
    expect(http).toContain("return json({ error: message }, status);");
    expect(http).toContain('"cache-control": "no-store"');
  });

  it("does not add an API version prefix without an external consumer", () => {
    // P2-12 decision: `/api` is internal-only, so a second `/api/v1` contract
    // would double maintenance for no compatibility benefit. Revisit only when
    // a third party actually consumes the API, and then keep the old paths as
    // aliases rather than moving them.
    expect(() => statSync(join(API_ROOT, "v1"))).toThrow();
  });
});
