import { describe, expect, it } from "vitest";
import {
  PUBLIC_ID_ALPHABET,
  PUBLIC_ID_LENGTH,
  encodePublicId,
  generatePublicId,
  isPublicIdCollision,
  isValidPublicId,
  parsePublicId,
  questionSharePath,
  slugifyQuestion,
} from "../../src/lib/share/public-id";

describe("question public ids", () => {
  it("encodes the full 10-character base62 space", () => {
    expect(encodePublicId(0n)).toBe("0000000000");
    expect(encodePublicId(61n)).toBe("000000000z");
    expect(encodePublicId(62n ** 10n - 1n)).toBe("zzzzzzzzzz");
    expect(() => encodePublicId(-1n)).toThrow(RangeError);
    expect(() => encodePublicId(62n ** 10n)).toThrow(RangeError);
  });

  it("generates unique ids in the documented alphabet", () => {
    const ids = new Set(Array.from({ length: 2_000 }, () => generatePublicId()));
    expect(ids.size).toBe(2_000);
    for (const id of ids) {
      expect(id).toHaveLength(PUBLIC_ID_LENGTH);
      expect(isValidPublicId(id)).toBe(true);
      for (const character of id) expect(PUBLIC_ID_ALPHABET).toContain(character);
    }
  });

  it("parses the id from the end of a slug and rejects malformed values", () => {
    const id = generatePublicId();
    expect(parsePublicId(`what-is-the-value-${id}`)).toBe(id);
    expect(parsePublicId(id)).toBe(id);
    expect(parsePublicId(`what-is-the-value-${id.slice(0, 9)}`)).toBeNull();
    expect(parsePublicId("what-is-the-value")).toBeNull();
    expect(parsePublicId(`what-is-the-value-${id}-extra`)).toBeNull();
    expect(isValidPublicId("short")).toBe(false);
    expect(isValidPublicId("123456789!")).toBe(false);
  });

  it("builds readable six-word ASCII slugs", () => {
    expect(slugifyQuestion("What is the value of x in this very long question?")).toBe(
      "what-is-the-value-of-x",
    );
    expect(slugifyQuestion("  ***  ")).toBe("question");
    expect(slugifyQuestion("भारत की राजधानी क्या है?")).toMatch(/^[a-z0-9-]+$/);
    expect(slugifyQuestion("A".repeat(200))).toBe("a".repeat(80));
  });

  it("keeps the public id in the canonical path and never uses the DB id", () => {
    const id = generatePublicId();
    const path = questionSharePath(id, "Which option is correct?");
    expect(path).toBe(`/q/which-option-is-correct-${id}`);
    expect(path).not.toContain("/questions/");
    expect(() => questionSharePath("not-an-id", "Question")).toThrow();
  });

  it("recognises only public-id uniqueness errors for retry", () => {
    expect(
      isPublicIdCollision(
        new Error("UNIQUE constraint failed: question_public_ids.public_id"),
      ),
    ).toBe(true);
    expect(
      isPublicIdCollision(new Error("UNIQUE constraint failed: questions.id")),
    ).toBe(false);
    expect(isPublicIdCollision("network unavailable")).toBe(false);
  });
});
