import { describe, expect, it } from "vitest";
import {
  publicRevealBlockers,
  seoBlockers,
  type SharePolicyFlags,
} from "../../src/lib/share/policy";

const ready: SharePolicyFlags = {
  shareEnabled: true,
  revealPolicy: "public",
  seoIndexable: false,
  rightsOk: true,
};

const readyQuestion = {
  publishedRevisionId: 10,
  hasExplanation: true,
  inPublishedMock: false,
  flags: ready,
};

describe("share policy blockers", () => {
  it("allows indexing only when every documented condition holds", () => {
    expect(seoBlockers(readyQuestion)).toEqual([]);
  });

  it("explains each missing indexing condition", () => {
    expect(seoBlockers({ ...readyQuestion, publishedRevisionId: null }).join(" ")).toMatch(
      /Publish/,
    );
    expect(
      seoBlockers({ ...readyQuestion, flags: { ...ready, rightsOk: false } }).join(" "),
    ).toMatch(/rights/i);
    expect(
      seoBlockers({
        ...readyQuestion,
        flags: { ...ready, revealPolicy: "attempted_only" },
      }).join(" "),
    ).toMatch(/reveal policy/i);
    expect(seoBlockers({ ...readyQuestion, hasExplanation: false }).join(" ")).toMatch(
      /explanation/i,
    );
    expect(seoBlockers({ ...readyQuestion, inPublishedMock: true }).join(" ")).toMatch(
      /ranked mock/i,
    );
  });

  it("blocks public reveal while the question is in a live ranked mock", () => {
    expect(
      publicRevealBlockers({ publishedRevisionId: 10, inPublishedMock: false }),
    ).toEqual([]);
    expect(
      publicRevealBlockers({ publishedRevisionId: 10, inPublishedMock: true }).join(" "),
    ).toMatch(/ranked mock/i);
    expect(
      publicRevealBlockers({ publishedRevisionId: null, inPublishedMock: false }).join(" "),
    ).toMatch(/Publish/);
  });
});
