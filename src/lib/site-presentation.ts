export const SITE_PRESENTATION_DEFAULTS = {
  site_name: "CUET Free Mock Test",
  site_tagline:
    "A focused space for CUET UG practice: mock tests, previous-year questions and performance reviews, moving forward one step at a time.",
  site_footer_note: "Independent practice resource.",
  footer_custom_links: "",
  header_custom_links: "",
  global_notice_enabled: "false",
  global_notice_text: "",
  global_notice_href: "",
} as const;

export const HOMEPAGE_PRESENTATION_DEFAULTS = {
  home_hero_badge: "Full-Length Mock Test · CUET PYQs With solutions",
  home_hero_title: "Boost Your CUET UG 2027 Preparation with FREE Online Mock Tests & PYQs",
  home_hero_description:
    "Practice with CUET Mock Test Series based on the NTA Exam Pattern and Previous Year Questions (PYQs) to Build Confidence and Improve Your Exam Readiness.",
  home_hero_primary_label: "Take a FREE Mock Test",
  home_hero_primary_href: "/mock-tests",
  home_hero_secondary_label: "Browse CUET PYQs",
  home_hero_secondary_href: "/cuet-ug-previous-year-papers",
  home_hero_note:
    "No account needed to start. Sign in later to save your history and leaderboard attempt.",
  home_featured_heading: "Most Popular Mock Tests",
  home_library_heading: "Most Popular Mock Tests and subject-wise practice.",
  home_library_description:
    "Every paper below is a previous-year practice paper. Fully scored papers appear first, and every row opens the matching timed test or subject practice.",
  home_show_featured_panel: "true",
  home_show_paper_library: "true",
  home_show_shortcuts: "true",
  home_show_year_archive: "true",
  home_show_study_rhythm: "true",
  home_show_focus_cards: "true",
  home_show_faq: "true",
  home_show_bottom_cta: "true",
} as const;

export const HOMEPAGE_PRESENTATION_KEYS = Object.keys(
  HOMEPAGE_PRESENTATION_DEFAULTS,
) as (keyof typeof HOMEPAGE_PRESENTATION_DEFAULTS)[];

export function isSafeInternalPath(value: string): boolean {
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
  try {
    return new URL(path, "https://cuet.invalid").origin === "https://cuet.invalid";
  } catch {
    return false;
  }
}

export function safeInternalPath(value: string | undefined, fallback: string): string {
  return value && isSafeInternalPath(value) ? value.trim() : fallback;
}

export interface SiteLink {
  label: string;
  href: string;
}

export function normalizeSiteLinks(value: string, limit = 8): string {
  const links = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf("|");
      if (separator < 0 || line.indexOf("|", separator + 1) >= 0) {
        throw new Error("Each navigation link must use the format Label | /path.");
      }

      const label = line.slice(0, separator).trim();
      const href = line.slice(separator + 1).trim();
      if (label.length < 2 || label.length > 40 || /[<>]/.test(label)) {
        throw new Error("Navigation link labels must be 2-40 plain-text characters.");
      }
      if (!isSafeInternalPath(href)) {
        throw new Error("Navigation link destinations must be same-site paths beginning with a single slash.");
      }
      return { label, href };
    });

  if (links.length > limit) throw new Error(`You can add up to ${limit} custom navigation links.`);
  return links.map(({ label, href }) => `${label} | ${href}`).join("\n");
}

export function parseSiteLinks(value: string | undefined, limit = 8): SiteLink[] {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((line) => {
      const separator = line.indexOf("|");
      if (separator < 0) return null;
      const label = line.slice(0, separator).trim();
      const href = line.slice(separator + 1).trim();
      if (label.length < 2 || label.length > 40 || /[<>]/.test(label) || !isSafeInternalPath(href)) {
        return null;
      }
      return { label, href };
    })
    .filter((link): link is SiteLink => link !== null)
    .slice(0, limit);
}
