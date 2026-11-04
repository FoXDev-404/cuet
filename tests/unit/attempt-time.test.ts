import { describe, expect, it } from "vitest";
import {
  ATTEMPT_GRACE_SECONDS,
  hasExpired,
  remainingSeconds,
  SUBMIT_GRACE_SECONDS,
} from "../../src/lib/attempt-time";

const DEADLINE = "2026-10-31T10:00:00.000Z";
const deadlineMs = Date.parse(DEADLINE);

describe("attempt deadline helpers (Fix 10 Item 1)", () => {
  it("verifies ATTEMPT_GRACE_SECONDS constant equals 15 seconds", () => {
    expect(ATTEMPT_GRACE_SECONDS).toBe(15);
    expect(SUBMIT_GRACE_SECONDS).toBe(ATTEMPT_GRACE_SECONDS);
  });

  it("counts down from the server deadline and never goes negative", () => {
    expect(remainingSeconds({ deadline_at: DEADLINE }, deadlineMs - 90_000)).toBe(90);
    expect(remainingSeconds({ deadline_at: DEADLINE }, deadlineMs)).toBe(0);
    expect(remainingSeconds({ deadline_at: DEADLINE }, deadlineMs + 60_000)).toBe(0);
  });

  it("allows on-time submissions (before or at deadline)", () => {
    expect(hasExpired({ deadline_at: DEADLINE }, deadlineMs - 5_000)).toBe(false);
    expect(hasExpired({ deadline_at: DEADLINE }, deadlineMs)).toBe(false);
  });

  it("allows submissions within the documented grace window (<= 15s)", () => {
    expect(hasExpired({ deadline_at: DEADLINE }, deadlineMs + 5_000)).toBe(false);
    expect(hasExpired({ deadline_at: DEADLINE }, deadlineMs + 14_999)).toBe(false);
    expect(
      hasExpired({ deadline_at: DEADLINE }, deadlineMs + ATTEMPT_GRACE_SECONDS * 1000),
    ).toBe(false);
  });

  it("marks the attempt expired after the grace window (> 15s)", () => {
    expect(
      hasExpired({ deadline_at: DEADLINE }, deadlineMs + ATTEMPT_GRACE_SECONDS * 1000 + 1),
    ).toBe(true);
    expect(hasExpired({ deadline_at: DEADLINE }, deadlineMs + 16_000)).toBe(true);
    expect(hasExpired({ deadline_at: DEADLINE }, deadlineMs + 60 * 60 * 1000)).toBe(true);
  });
});
