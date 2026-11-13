import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/settings", () => ({
  getSettings: vi.fn(),
  setSetting: vi.fn(),
}));

import { normalizeSettings, SETTING_FIELDS } from "../../src/lib/admin/settings";

function completeSettings(): Record<string, unknown> {
  return Object.fromEntries(SETTING_FIELDS.map((field) => [field.key, field.defaultValue]));
}

describe("admin site presentation settings", () => {
  it("accepts the complete default homepage and global configuration", () => {
    const result = normalizeSettings(completeSettings());

    expect(result.home_hero_primary_href).toBe("/mock-tests");
    expect(result.home_show_paper_library).toBe("true");
    expect(result.global_notice_enabled).toBe("false");
    expect(result.global_notice_text).toBe("");
  });

  it.each(["//example.com", "https://example.com", "/\\example.com", "javascript:alert(1)"])(
    "rejects unsafe homepage paths: %s",
    (path) => {
      expect(() =>
        normalizeSettings({ ...completeSettings(), home_hero_primary_href: path }),
      ).toThrow(/same-site path/i);
    },
  );

  it("allows only plain text in editable homepage copy", () => {
    expect(() =>
      normalizeSettings({ ...completeSettings(), home_hero_title: "<script>alert(1)</script>" }),
    ).toThrow(/plain text/i);
  });

  it("allows an intentionally blank optional footer description", () => {
    const result = normalizeSettings({ ...completeSettings(), site_tagline: "   " });
    expect(result.site_tagline).toBe("");
  });
});
