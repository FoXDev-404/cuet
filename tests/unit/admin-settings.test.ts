import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSettingsStore = vi.hoisted(() => new Map<string, string>());
vi.mock("../../src/lib/settings", () => ({
  getSettings: vi.fn(),
  getSetting: vi.fn(),
  setSetting: vi.fn(),
}));

import { getSetting, getSettings, setSetting } from "../../src/lib/settings";
import {
  hasDraftSettings,
  loadDraftSettings,
  loadSettings,
  loadSettingsRevisions,
  normalizeSettings,
  publishDraftSettings,
  restoreSettingsRevision,
  saveDraftSettings,
  SETTING_FIELDS,
} from "../../src/lib/admin/settings";
import {
  HOMEPAGE_SECTION_ORDER,
  parseHomepageSectionOrder,
  parseSiteLinks,
} from "../../src/lib/site-presentation";
import {
  INFORMATIONAL_PAGE_DEFAULTS,
  normalizeInformationalPageBlocks,
} from "../../src/lib/site-content";

beforeEach(() => {
  mockSettingsStore.clear();
  vi.mocked(getSetting).mockImplementation(async (key, fallback = "") => mockSettingsStore.get(key) ?? fallback);
  vi.mocked(getSettings).mockImplementation(async (keys) =>
    Object.fromEntries(
      keys.flatMap((key) =>
        mockSettingsStore.has(key) ? [[key, mockSettingsStore.get(key)!]] : [],
      ),
    ),
  );
  vi.mocked(setSetting).mockImplementation(async (key, value) => {
    mockSettingsStore.set(key, value);
  });
});

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

  it("normalizes safe custom footer links and rejects external or malformed entries", () => {
    const result = normalizeSettings({
      ...completeSettings(),
      footer_custom_links: "Study plan | /cuet-ug-study-plan\nContact | /contact",
    });

    expect(parseSiteLinks(result.footer_custom_links)).toEqual([
      { label: "Study plan", href: "/cuet-ug-study-plan" },
      { label: "Contact", href: "/contact" },
    ]);
    expect(() =>
      normalizeSettings({ ...completeSettings(), footer_custom_links: "External | https://example.com" }),
    ).toThrow(/same-site path/i);
    expect(() =>
      normalizeSettings({ ...completeSettings(), footer_custom_links: "Missing separator" }),
    ).toThrow(/format Label \| \/path/i);
  });

  it("supports ordered, limited custom header links for desktop and mobile menus", () => {
    const result = normalizeSettings({
      ...completeSettings(),
      header_custom_links: "Study plan | /cuet-ug-study-plan\nContact | /contact",
    });

    expect(parseSiteLinks(result.header_custom_links, 4)).toEqual([
      { label: "Study plan", href: "/cuet-ug-study-plan" },
      { label: "Contact", href: "/contact" },
    ]);
    expect(() =>
      normalizeSettings({
        ...completeSettings(),
        header_custom_links: Array.from({ length: 5 }, (_, index) => `Page ${index + 1} | /page-${index + 1}`).join("\n"),
      }),
    ).toThrow(/up to 4/i);
  });

  it("allows homepage component reordering only with a complete unique section list", () => {
    const reversedOrder = [...HOMEPAGE_SECTION_ORDER].reverse();
    const result = normalizeSettings({
      ...completeSettings(),
      home_section_order: reversedOrder.join("\n"),
    });

    expect(parseHomepageSectionOrder(result.home_section_order)).toEqual(reversedOrder);
    expect(() =>
      normalizeSettings({
        ...completeSettings(),
        home_section_order: ["faq", ...HOMEPAGE_SECTION_ORDER.slice(1)].join("\n"),
      }),
    ).toThrow(/each allowed section exactly once/i);
  });

  it("normalizes the default About and Contact block sets", () => {
    const result = normalizeSettings(completeSettings());
    const about = JSON.parse(result.page_about_blocks);
    const contact = JSON.parse(result.page_contact_blocks);

    expect(about).toEqual(INFORMATIONAL_PAGE_DEFAULTS.about);
    expect(contact).toEqual(INFORMATIONAL_PAGE_DEFAULTS.contact);
  });

  it("accepts only page-allowlisted text blocks and safe internal links", () => {
    const blocks = [
      { type: "heading", level: "h2", text: "More about the site" },
      { type: "paragraph", text: "This content is plain text." },
      { type: "internal_link", label: "Practice", href: "/mock-tests" },
    ];
    const result = normalizeSettings({
      ...completeSettings(),
      page_about_blocks: JSON.stringify(blocks),
    });

    expect(JSON.parse(result.page_about_blocks)).toEqual(blocks);
    expect(() =>
      normalizeInformationalPageBlocks(
        [{ type: "internal_link", label: "External", href: "https://example.com" }],
        "about",
      ),
    ).toThrow(/same-site path/i);
    expect(() =>
      normalizeInformationalPageBlocks(
        [{ type: "internal_link", label: "Not allowed here", href: "/about" }],
        "contact",
      ),
    ).toThrow(/not allowed on this page/i);
  });

  it("accepts only uploaded media IDs with required plain-text alt text", () => {
    const assetId = "74be4d60-50e7-4a32-b741-c116f6a20a1d";
    expect(
      normalizeInformationalPageBlocks(
        [{ type: "image", assetId, alt: "A CUET practice paper open on a desk" }],
        "contact",
      ),
    ).toEqual([{ type: "image", assetId, alt: "A CUET practice paper open on a desk" }]);
    expect(() =>
      normalizeInformationalPageBlocks(
        [{ type: "image", assetId: "https://example.com/image.png", alt: "Image" }],
        "about",
      ),
    ).toThrow(/uploaded media asset/i);
    expect(() =>
      normalizeInformationalPageBlocks(
        [{ type: "image", assetId, alt: "<img>" }],
        "about",
      ),
    ).toThrow(/plain-text/i);
  });

  it("rejects HTML, unknown block fields and oversized lists in page content", () => {
    expect(() =>
      normalizeInformationalPageBlocks(
        [{ type: "paragraph", text: "<img src=x onerror=alert(1)>" }],
        "about",
      ),
    ).toThrow(/plain-text/i);
    expect(() =>
      normalizeInformationalPageBlocks(
        [{ type: "paragraph", text: "Safe text", html: "<b>ignored</b>" }],
        "about",
      ),
    ).toThrow(/unsupported fields/i);
    expect(() =>
      normalizeInformationalPageBlocks(
        [{ type: "list", items: Array.from({ length: 11 }, (_, index) => `Item ${index + 1}`) }],
        "contact",
      ),
    ).toThrow(/1-10 items/i);
  });

  it("keeps drafts private until publication and restores prior versions as drafts", async () => {
    const published = await loadSettings();
    const draft = {
      ...published,
      site_name: "Draft CUET Site",
      page_about_blocks: JSON.stringify([
        { type: "paragraph", text: "Draft about page content." },
      ]),
    };

    await saveDraftSettings(draft, 7);
    expect(await hasDraftSettings()).toBe(true);
    expect((await loadSettings()).site_name).toBe(published.site_name);
    expect((await loadDraftSettings()).site_name).toBe("Draft CUET Site");
    expect(JSON.parse((await loadSettings()).page_about_blocks)).toEqual(
      INFORMATIONAL_PAGE_DEFAULTS.about,
    );

    const result = await publishDraftSettings(7);
    expect(result.published).toBe(true);
    expect((await loadSettings()).site_name).toBe("Draft CUET Site");
    expect(JSON.parse((await loadSettings()).page_about_blocks)).toEqual([
      { type: "paragraph", text: "Draft about page content." },
    ]);

    const [revision] = await loadSettingsRevisions();
    expect(revision.settings.site_name).toBe(published.site_name);
    expect(JSON.parse(revision.settings.page_about_blocks)).toEqual(
      INFORMATIONAL_PAGE_DEFAULTS.about,
    );
    const restored = await restoreSettingsRevision(revision.id, 7);
    expect(restored?.hasDraft).toBe(true);
    expect((await loadSettings()).site_name).toBe("Draft CUET Site");
    expect((await loadDraftSettings()).site_name).toBe(published.site_name);
    expect(JSON.parse((await loadDraftSettings()).page_about_blocks)).toEqual(
      INFORMATIONAL_PAGE_DEFAULTS.about,
    );
  });
});
