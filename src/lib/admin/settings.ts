import { getSetting, getSettings, setSetting } from "../settings";
import {
  HOMEPAGE_PRESENTATION_DEFAULTS,
  normalizeHomepageSectionOrder,
  isSafeInternalPath,
  normalizeSiteLinks,
  SITE_PRESENTATION_DEFAULTS,
} from "../site-presentation";
import {
  INFORMATIONAL_PAGE_DEFAULTS,
  INFORMATIONAL_PAGE_SETTING_KEYS,
  normalizeInformationalPageBlocks,
  type InformationalPageId,
} from "../site-content";

type SettingsGroup =
  | "global"
  | "homepage"
  | "homepage-sections"
  | "content-pages"
  | "features";

export type SettingField = {
  key: string;
  label: string;
  description: string;
  type: "text" | "textarea" | "path" | "links" | "order" | "boolean" | "blocks";
  defaultValue: string;
  group: SettingsGroup;
  maxLength?: number;
  rows?: number;
  allowEmpty?: boolean;
  pageId?: InformationalPageId;
};

export const SETTING_FIELDS: SettingField[] = [
  {
    key: "site_name",
    label: "Site name",
    description: "Shown in the public header, footer and organization metadata.",
    type: "text",
    defaultValue: SITE_PRESENTATION_DEFAULTS.site_name,
    group: "global",
    maxLength: 80,
  },
  {
    key: "site_tagline",
    label: "Footer description",
    description: "Short text below the brand in the public footer. Leave empty to hide it.",
    type: "textarea",
    defaultValue: SITE_PRESENTATION_DEFAULTS.site_tagline,
    group: "global",
    maxLength: 240,
    rows: 3,
    allowEmpty: true,
  },
  {
    key: "site_footer_note",
    label: "Footer note",
    description: "Small closing note at the bottom of the public footer. Leave empty to hide it.",
    type: "text",
    defaultValue: SITE_PRESENTATION_DEFAULTS.site_footer_note,
    group: "global",
    maxLength: 120,
    allowEmpty: true,
  },
  {
    key: "footer_custom_links",
    label: "Additional footer links",
    description: "Optional links shown under Explore. Add one per line as Label | /path (up to 8).",
    type: "links",
    defaultValue: SITE_PRESENTATION_DEFAULTS.footer_custom_links,
    group: "global",
    maxLength: 500,
    rows: 5,
    allowEmpty: true,
  },
  {
    key: "header_custom_links",
    label: "Additional header links",
    description: "Shown in a More menu on desktop and the mobile More panel. Order the lines as desired; remove a line to hide it. Up to 4 same-site links.",
    type: "links",
    defaultValue: SITE_PRESENTATION_DEFAULTS.header_custom_links,
    group: "global",
    maxLength: 300,
    rows: 4,
    allowEmpty: true,
  },
  {
    key: "global_notice_enabled",
    label: "Show the site-wide notice",
    description: "Display a short announcement above the header on public pages.",
    type: "boolean",
    defaultValue: SITE_PRESENTATION_DEFAULTS.global_notice_enabled,
    group: "global",
  },
  {
    key: "global_notice_text",
    label: "Notice text",
    description: "Plain text shown in the site-wide notice. Keep it brief and useful.",
    type: "text",
    defaultValue: SITE_PRESENTATION_DEFAULTS.global_notice_text,
    group: "global",
    maxLength: 180,
    allowEmpty: true,
  },
  {
    key: "global_notice_href",
    label: "Notice link",
    description: "Optional same-site path such as /cuet-ug-important-dates. External and script URLs are rejected.",
    type: "path",
    defaultValue: SITE_PRESENTATION_DEFAULTS.global_notice_href,
    group: "global",
    maxLength: 300,
    allowEmpty: true,
  },
  {
    key: "home_hero_badge",
    label: "Hero badge",
    description: "Small uppercase label above the homepage headline.",
    type: "text",
    defaultValue: HOMEPAGE_PRESENTATION_DEFAULTS.home_hero_badge,
    group: "homepage",
    maxLength: 100,
  },
  {
    key: "home_hero_title",
    label: "Hero headline",
    description: "Main homepage heading. The first occurrence of FREE receives the accent color.",
    type: "textarea",
    defaultValue: HOMEPAGE_PRESENTATION_DEFAULTS.home_hero_title,
    group: "homepage",
    maxLength: 150,
    rows: 2,
  },
  {
    key: "home_hero_description",
    label: "Hero description",
    description: "Supporting copy under the homepage headline.",
    type: "textarea",
    defaultValue: HOMEPAGE_PRESENTATION_DEFAULTS.home_hero_description,
    group: "homepage",
    maxLength: 300,
    rows: 3,
  },
  {
    key: "home_hero_primary_label",
    label: "Primary button label",
    description: "Label for the main homepage call to action.",
    type: "text",
    defaultValue: HOMEPAGE_PRESENTATION_DEFAULTS.home_hero_primary_label,
    group: "homepage",
    maxLength: 50,
  },
  {
    key: "home_hero_primary_href",
    label: "Primary button destination",
    description: "Same-site path for the main call to action.",
    type: "path",
    defaultValue: HOMEPAGE_PRESENTATION_DEFAULTS.home_hero_primary_href,
    group: "homepage",
    maxLength: 300,
  },
  {
    key: "home_hero_secondary_label",
    label: "Secondary button label",
    description: "Label for the second homepage call to action.",
    type: "text",
    defaultValue: HOMEPAGE_PRESENTATION_DEFAULTS.home_hero_secondary_label,
    group: "homepage",
    maxLength: 50,
  },
  {
    key: "home_hero_secondary_href",
    label: "Secondary button destination",
    description: "Same-site path for the second call to action.",
    type: "path",
    defaultValue: HOMEPAGE_PRESENTATION_DEFAULTS.home_hero_secondary_href,
    group: "homepage",
    maxLength: 300,
  },
  {
    key: "home_hero_note",
    label: "Hero note",
    description: "Small reassurance line beneath the homepage buttons.",
    type: "textarea",
    defaultValue: HOMEPAGE_PRESENTATION_DEFAULTS.home_hero_note,
    group: "homepage",
    maxLength: 180,
    rows: 2,
  },
  {
    key: "home_featured_heading",
    label: "Featured papers heading",
    description: "Heading above the highlighted mock tests on the hero.",
    type: "text",
    defaultValue: HOMEPAGE_PRESENTATION_DEFAULTS.home_featured_heading,
    group: "homepage",
    maxLength: 80,
  },
  {
    key: "home_library_heading",
    label: "Practice library heading",
    description: "Heading for the homepage mock and subject practice library.",
    type: "text",
    defaultValue: HOMEPAGE_PRESENTATION_DEFAULTS.home_library_heading,
    group: "homepage",
    maxLength: 120,
  },
  {
    key: "home_library_description",
    label: "Practice library description",
    description: "Supporting copy above the paper and subject cards.",
    type: "textarea",
    defaultValue: HOMEPAGE_PRESENTATION_DEFAULTS.home_library_description,
    group: "homepage",
    maxLength: 300,
    rows: 3,
  },
  ...(
    [
      ["home_show_featured_panel", "Featured mock tests", "Show the popular paper panel beside the homepage hero."],
      ["home_show_paper_library", "Practice library", "Show the mock-test and subject practice cards."],
      ["home_show_shortcuts", "Library shortcuts", "Show the shortcut row for mocks, PYQs and progress."],
      ["home_show_year_archive", "Previous-year archive", "Show the year-by-year paper browser."],
      ["home_show_study_rhythm", "Study rhythm", "Show the three-step study guidance section."],
      ["home_show_focus_cards", "Practice focus cards", "Show the focused practice card section."],
      ["home_show_faq", "Frequently asked questions", "Show the homepage FAQ section."],
      ["home_show_bottom_cta", "Final call to action", "Show the closing homepage practice call to action."],
    ] as const
  ).map(([key, label, description]) => ({
    key,
    label,
    description,
    type: "boolean" as const,
    defaultValue: HOMEPAGE_PRESENTATION_DEFAULTS[key],
    group: "homepage-sections" as const,
  })),
  {
    key: "home_section_order",
    label: "Homepage section order",
    description: "Reorder these IDs one per line and keep each exactly once: practice-library, shortcuts, year-archive, study-rhythm, focus-cards, faq, bottom-cta. The hero stays fixed; the SEO intro moves with the year archive.",
    type: "order",
    defaultValue: HOMEPAGE_PRESENTATION_DEFAULTS.home_section_order,
    group: "homepage-sections",
    maxLength: 200,
    rows: 7,
  },
  {
    key: INFORMATIONAL_PAGE_SETTING_KEYS.about,
    label: "About page content",
    description: "Edit the About page using headings, paragraphs, lists, callouts, uploaded images and internal links.",
    type: "blocks",
    defaultValue: JSON.stringify(INFORMATIONAL_PAGE_DEFAULTS.about),
    group: "content-pages",
    pageId: "about",
  },
  {
    key: INFORMATIONAL_PAGE_SETTING_KEYS.contact,
    label: "Contact page guidance",
    description: "Edit the Contact page guidance using headings, paragraphs, lists, callouts and uploaded images. Contact channels remain fixed.",
    type: "blocks",
    defaultValue: JSON.stringify(INFORMATIONAL_PAGE_DEFAULTS.contact),
    group: "content-pages",
    pageId: "contact",
  },
  {
    key: "registration_enabled",
    label: "Registration open",
    description: "When off, new account signups return a closed-registration error. Existing users can still log in.",
    type: "boolean",
    defaultValue: "true",
    group: "features",
  },
  {
    key: "discussion_enabled",
    label: "Discussions enabled",
    description: "When off, the discussion pages and posting APIs pause for everyone except admins.",
    type: "boolean",
    defaultValue: "true",
    group: "features",
  },
  {
    key: "maintenance_mode",
    label: "Maintenance mode",
    description: "When on, public pages are rewritten to the maintenance notice. Admin pages and APIs stay reachable.",
    type: "boolean",
    defaultValue: "false",
    group: "features",
  },
  {
    key: "share_question_during_attempt",
    label: "Share during a live attempt",
    description: "When on, every question in a live mock attempt — ranked mocks and previous-year practice papers — shows a Share button. The shared image shows the question and its options — never the correct answer — and the link opens the public question page when one exists, otherwise the mock instructions page.",
    type: "boolean",
    defaultValue: "false",
    group: "features",
  },
];

export const SETTING_KEYS = SETTING_FIELDS.map((field) => field.key);
const DRAFT_SETTING_KEY = "site_builder_draft";
const REVISION_SETTING_KEY = "site_builder_revisions";
const MAX_SETTING_REVISIONS = 10;

export type SiteSettingsRevision = {
  id: string;
  createdAt: string;
  adminId: number;
  settings: Record<string, string>;
};

type SiteSettingsDraft = {
  updatedAt: string;
  updatedBy: number;
  settings: Record<string, string>;
};

export async function loadSettings(): Promise<Record<string, string>> {
  const stored = await getSettings(SETTING_KEYS);
  return Object.fromEntries(
    SETTING_FIELDS.map((field) => [field.key, stored[field.key] ?? field.defaultValue]),
  );
}

async function loadDraftRecord(): Promise<SiteSettingsDraft | null> {
  const raw = await getSetting(DRAFT_SETTING_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("settings" in parsed) ||
      !("updatedAt" in parsed) ||
      !("updatedBy" in parsed)
    ) {
      throw new Error("Draft record has an invalid shape.");
    }
    const record = parsed as SiteSettingsDraft;
    return {
      updatedAt: String(record.updatedAt),
      updatedBy: Number(record.updatedBy),
      settings: normalizeSettings({ ...(await loadSettings()), ...record.settings }),
    };
  } catch (error) {
    console.error("site builder draft could not be loaded", error);
    throw new Error("The saved site builder draft could not be loaded.");
  }
}

export async function loadDraftSettings(): Promise<Record<string, string>> {
  const draft = await loadDraftRecord();
  return draft?.settings ?? loadSettings();
}

export async function hasDraftSettings(): Promise<boolean> {
  return Boolean(await loadDraftRecord());
}

export async function saveDraftSettings(
  input: Record<string, unknown>,
  adminId: number,
): Promise<{ settings: Record<string, string>; changed: Record<string, string>; hasDraft: boolean }> {
  const values = normalizeSettings(input);
  const before = await loadDraftSettings();
  const published = await loadSettings();
  const changed = Object.fromEntries(
    Object.entries(values).filter(([key, value]) => before[key] !== value),
  );
  const hasDraft = Object.entries(values).some(([key, value]) => published[key] !== value);
  await setSetting(
    DRAFT_SETTING_KEY,
    hasDraft
      ? JSON.stringify({
          settings: values,
          updatedAt: new Date().toISOString(),
          updatedBy: adminId,
        } satisfies SiteSettingsDraft)
      : "",
  );
  return { settings: values, changed, hasDraft };
}

export async function loadSettingsRevisions(): Promise<SiteSettingsRevision[]> {
  const raw = await getSetting(REVISION_SETTING_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("Revision history is not a list.");
    return parsed
      .filter(
        (revision): revision is SiteSettingsRevision =>
          Boolean(revision) &&
          typeof revision === "object" &&
          typeof revision.id === "string" &&
          typeof revision.createdAt === "string" &&
          typeof revision.adminId === "number" &&
          typeof revision.settings === "object" &&
          revision.settings !== null,
      )
      .slice(0, MAX_SETTING_REVISIONS);
  } catch (error) {
    console.error("site builder revision history could not be loaded", error);
    throw new Error("Site builder revision history could not be loaded.");
  }
}

export async function publishDraftSettings(
  adminId: number,
): Promise<{ settings: Record<string, string>; changed: Record<string, string>; published: boolean }> {
  const draft = await loadDraftRecord();
  const before = await loadSettings();
  if (!draft) return { settings: before, changed: {}, published: false };

  const changed = Object.fromEntries(
    Object.entries(draft.settings).filter(([key, value]) => before[key] !== value),
  );
  if (Object.keys(changed).length === 0) {
    await setSetting(DRAFT_SETTING_KEY, "");
    return { settings: before, changed, published: false };
  }

  const revisions = await loadSettingsRevisions();
  revisions.unshift({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    adminId,
    settings: before,
  });
  await setSetting(REVISION_SETTING_KEY, JSON.stringify(revisions.slice(0, MAX_SETTING_REVISIONS)));
  await saveSettings(draft.settings);
  await setSetting(DRAFT_SETTING_KEY, "");
  return { settings: draft.settings, changed, published: true };
}

export async function restoreSettingsRevision(
  revisionId: string,
  adminId: number,
): Promise<{ settings: Record<string, string>; changed: Record<string, string>; hasDraft: boolean } | null> {
  const revision = (await loadSettingsRevisions()).find((item) => item.id === revisionId);
  if (!revision) return null;

  const values = normalizeSettings(revision.settings);
  const before = await loadDraftSettings();
  const published = await loadSettings();
  const changed = Object.fromEntries(
    Object.entries(values).filter(([key, value]) => before[key] !== value),
  );
  const hasDraft = Object.entries(values).some(([key, value]) => published[key] !== value);
  await setSetting(
    DRAFT_SETTING_KEY,
    hasDraft
      ? JSON.stringify({
          settings: values,
          updatedAt: new Date().toISOString(),
          updatedBy: adminId,
        } satisfies SiteSettingsDraft)
      : "",
  );
  return { settings: values, changed, hasDraft };
}

export function normalizeSettings(input: Record<string, unknown>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const field of SETTING_FIELDS) {
    const raw = input[field.key];
    if (field.type === "boolean") {
      output[field.key] = raw === false || raw === "false" || raw === "0" || raw === 0 || raw === null || raw === undefined
        ? "false"
        : "true";
      continue;
    }
    if (field.type === "blocks") {
      if (!field.pageId) throw new Error(`${field.label} is missing its page allowlist.`);
      output[field.key] = JSON.stringify(normalizeInformationalPageBlocks(raw, field.pageId));
      continue;
    }
    const value = String(raw ?? "").trim();
    const minimumLength = field.allowEmpty ? 0 : 2;
    if (value.length < minimumLength || value.length > (field.maxLength ?? 80)) {
      throw new Error(
        `${field.label} must be ${minimumLength === 0 ? "0" : "2"}-${field.maxLength ?? 80} characters.`,
      );
    }
    if (field.type === "path" && value && !isSafeInternalPath(value)) {
      throw new Error(`${field.label} must be a same-site path beginning with a single slash.`);
    }
    if (value.includes("<") || value.includes(">")) {
      throw new Error(`${field.label} must be plain text.`);
    }
    if (field.type === "links") {
      output[field.key] = normalizeSiteLinks(value, field.key === "header_custom_links" ? 4 : 8);
      continue;
    }
    if (field.type === "order") {
      output[field.key] = normalizeHomepageSectionOrder(value);
      continue;
    }
    output[field.key] = value;
  }
  return output;
}

export async function saveSettings(values: Record<string, string>): Promise<void> {
  for (const field of SETTING_FIELDS) {
    const value = values[field.key];
    if (value !== undefined) await setSetting(field.key, value);
  }
}
