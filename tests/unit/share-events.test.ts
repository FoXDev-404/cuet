import { describe, expect, it } from "vitest";
import { normalizeShareEvent } from "../../src/lib/share/events";

describe("share event validation", () => {
  it("accepts a public-page copy event", () => {
    const result = normalizeShareEvent({
      publicId: "AbCdEf1234",
      context: "public_page",
      channel: "copy",
    });
    expect(result).toEqual({
      ok: true,
      event: {
        publicId: "AbCdEf1234",
        mockId: null,
        context: "public_page",
        channel: "copy",
      },
    });
  });

  it("accepts a live-attempt mock event and rejects question ids there", () => {
    const result = normalizeShareEvent({
      mockId: 12,
      context: "attempt",
      channel: "native",
    });
    expect(result).toEqual({
      ok: true,
      event: {
        publicId: null,
        mockId: 12,
        context: "attempt",
        channel: "native",
      },
    });

    const question = normalizeShareEvent({
      publicId: "AbCdEf1234",
      mockId: 12,
      context: "attempt",
      channel: "copy",
    });
    expect(question.ok).toBe(false);
  });

  it("requires a public id outside the live attempt", () => {
    for (const context of ["solutions", "practice", "public_page"] as const) {
      const result = normalizeShareEvent({ context, channel: "copy" });
      expect(result.ok).toBe(false);
    }
  });

  it("rejects unknown contexts, channels and malformed ids", () => {
    expect(
      normalizeShareEvent({ publicId: "AbCdEf1234", context: "result", channel: "copy" })
        .ok,
    ).toBe(false);
    expect(
      normalizeShareEvent({ publicId: "AbCdEf1234", context: "public_page", channel: "email" })
        .ok,
    ).toBe(false);
    expect(
      normalizeShareEvent({ publicId: "short", context: "public_page", channel: "copy" }).ok,
    ).toBe(false);
    expect(
      normalizeShareEvent({ publicId: "AbCdEf1234", context: "public_page", channel: "copy", mockId: 0 })
        .ok,
    ).toBe(false);
    expect(normalizeShareEvent(null).ok).toBe(false);
  });
});
