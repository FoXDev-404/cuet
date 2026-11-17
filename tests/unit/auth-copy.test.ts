import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Sign-in is Google-only. Public legal/support copy and admin guidance must not
 * describe the retired email/password flow as if it were still available.
 */

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Google-only auth copy", () => {
  it("describes the current sign-in flow in the privacy policy", () => {
    const policy = read("src/pages/privacy-policy.astro");

    expect(policy).toContain("Sign-in is Google-only");
    expect(policy).toContain("we do not receive or store your Google password");
    expect(policy).toContain("unused password hash");

    expect(policy).not.toContain("password hash if you sign up with email");
    expect(policy).not.toContain("let you reset a password");
    expect(policy).not.toContain("Password-reset tokens");
    expect(policy).not.toContain("use a unique password");
  });

  it("keeps the terms, contact guidance and admin screens consistent", () => {
    const terms = read("src/pages/terms.astro");
    const contact = read("src/lib/site-content.ts");
    const admins = read("src/pages/admin/admins.astro");
    const oauth = read("src/lib/auth/oauth-config.ts");

    expect(terms).toContain("Google account");
    expect(terms).not.toContain("keeping your password");

    expect(contact).not.toContain("used to sign up");
    expect(contact).not.toContain("Never send your password");

    expect(admins).not.toContain("Google or password");
    expect(oauth).not.toContain("email/password login always remains");
  });
});
