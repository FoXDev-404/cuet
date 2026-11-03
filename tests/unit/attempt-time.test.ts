import { describe, expect, it } from "vitest";
import { hasExpired, remainingSeconds, SUBMIT_GRACE_SECONDS } from "../../src/lib/attempt-time";

const DEADLINE = "2026-10-31T10:00:00.000Z";
const deadlineMs = Date.parse(DEADLINE);

describe("attempt deadline helpers", () => {
  it("counts down from the server deadline and never goes negative", () => {
    expect(remainingSeconds({ deadline_at: DEADLINE }, deadlineMs - 90_000)).toBe(90);
    expect(remainingSeconds({ deadline_at: DEADLINE }, deadlineMs)).toBe(0);
    expect(remainingSeconds({ deadline_at: DEADLINE }, deadlineMs + 60_000)).toBe(0);
  });

  it("allows the documented submission grace window", () => {
    expect(hasExpired({ deadline_at: DEADLINE }, deadlineMs)).toBe(false);
    expect(
      hasExpired({ deadline_at: DEADLINE }, deadlineMs + SUBMIT_GRACE_SECONDS * 1000),
    ).toBe(false);
  });

  it("marks the attempt expired after the grace window", () => {
    expect(
      hasExpired({ deadline_at: DEADLINE }, deadlineMs + SUBMIT_GRACE_SECONDS * 1000 + 1),
    ).toBe(true);
    expect(hasExpired({ deadline_at: DEADLINE }, deadlineMs + 60 * 60 * 1000)).toBe(true);
  });
});
