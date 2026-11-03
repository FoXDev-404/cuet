import { describe, expect, it } from "vitest";
import { commentStatusFor, isTrustedContributor } from "../../src/lib/moderation";

describe("discussion auto-approval", () => {
  it("keeps new members in the moderation queue", () => {
    expect(isTrustedContributor(0)).toBe(false);
    expect(commentStatusFor(0)).toBe("pending");
    expect(commentStatusFor(2)).toBe("pending");
  });

  it("auto-approves members with three approved comments", () => {
    expect(isTrustedContributor(3)).toBe(true);
    expect(commentStatusFor(3)).toBe("visible");
    expect(commentStatusFor(12)).toBe("visible");
  });
});
