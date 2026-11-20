import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("qa-data-audit redirect target classification", () => {
  const source = readFileSync(
    resolve(process.cwd(), "scripts/qa-data-audit.mjs"),
    "utf8",
  );

  it("accepts /cuet-mock-test/<subject> as a valid archived-paper target", () => {
    // BUG-009: the approved BUG-001 retarget pointed two archived papers at
    // the subject practice hubs. The checker knew only the old archive hub
    // paths and raised two false P1 findings.
    expect(source).toContain('segments[0] === "cuet-mock-test"');
    expect(source).toContain("isPracticeHub");
    expect(source).toContain("!isSubjectHub && !isPracticeHub");
  });

  it("treats any published non-50-question mock as a P1 release blocker (BUG-011)", () => {
    // A 5-question mock shipped to production because the audit only rated
    // non-50 versions P2 and the publish path did not enforce the count.
    const block = source.slice(
      source.indexOf("published version has zero questions"),
      source.indexOf("// duplicate slugs"),
    );
    expect(block).toContain("qcount !== 50");
    expect(block).toContain("questions (expected 50)`, \"P1\"");
  });
});
