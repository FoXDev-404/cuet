import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../src/lib/auth/password";

describe("password hashing", () => {
  it("stores the Workerd-compatible iteration count", async () => {
    const stored = await hashPassword("CorrectHorse1!");
    expect(stored.startsWith("pbkdf2$100000$")).toBe(true);
    expect(stored.split("$")).toHaveLength(4);
  });

  it("verifies a matching password", async () => {
    const stored = await hashPassword("CorrectHorse1!");
    await expect(verifyPassword("CorrectHorse1!", stored)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("CorrectHorse1!");
    await expect(verifyPassword("WrongHorse1!", stored)).resolves.toBe(false);
  });

  it("rejects malformed stored hashes", async () => {
    await expect(verifyPassword("whatever", "plaintext")).resolves.toBe(false);
    await expect(verifyPassword("whatever", "pbkdf2$100000$notbase64$notbase64")).resolves.toBe(false);
  });
});
