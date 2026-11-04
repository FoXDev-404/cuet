import { all, first } from "./db";

export { normalizeCanonicalUrl } from "./canonical";

export const SITE_NAME = "CUET Free Mock Test";
export const DEFAULT_SITE_DESCRIPTION =
  "Free CUET UG mock tests with server-scored results, detailed solutions, syllabus and exam-pattern guides.";

export type FaqItem = { question: string; answer: string };

export type PageSeoRow = {
  path: string;
  title: string | null;
  description: string | null;
  intro_html: string | null;
  faq_json: string | null;
  canonical_url: string | null;
  noindex: number;
  updated_at: string | null;
};

export type ExamInfoRow = {
  key: string;
  value: string;
  source_url: string | null;
  last_verified: string | null;
};

/** Known public pages shown in the admin SEO editor. */
export const SEO_PATHS = [
  "/",
  "/cuet-ug-mock-test",
  "/cuet-mock-test",
  "/cuet-ug-syllabus",
  "/cuet-ug-exam-pattern",
  "/cuet-ug-marking-scheme",
  "/cuet-ug-important-dates",
  "/cuet-ug-previous-year-papers",
  "/blog",
  "/leaderboard",
  "/about",
  "/contact",
  "/privacy-policy",
  "/terms",
  "/disclaimer",
] as const;

export const EXAM_INFO_KEYS = [
  { key: "exam-pattern", label: "Exam pattern (official summary)" },
  { key: "marking-scheme", label: "Marking scheme (official summary)" },
  { key: "syllabus", label: "Syllabus (official summary)" },
  { key: "important-dates", label: "Important dates" },
  { key: "eligibility", label: "Eligibility criteria" },
  { key: "subject-combination", label: "Subject combination rules" },
] as const;

export async function getPageSeo(path: string): Promise<PageSeoRow | null> {
  try {
    return await first<PageSeoRow>(
      `SELECT path, title, description, intro_html, faq_json, canonical_url, noindex, updated_at
       FROM page_seo WHERE path = ?`,
      path,
    );
  } catch {
    return null;
  }
}

export async function getExamInfo(keys: string[]): Promise<Record<string, ExamInfoRow>> {
  if (keys.length === 0) return {};
  try {
    const placeholders = keys.map(() => "?").join(",");
    const rows = await all<ExamInfoRow>(
      `SELECT key, value, source_url, last_verified FROM exam_info WHERE key IN (${placeholders})`,
      ...keys,
    );
    return Object.fromEntries(rows.map((row) => [row.key, row]));
  } catch {
    return {};
  }
}

export function parseFaq(raw: string | null | undefined): FaqItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const record = (item ?? {}) as Record<string, unknown>;
        return {
          question: typeof record.question === "string" ? record.question.trim() : "",
          answer: typeof record.answer === "string" ? record.answer.trim() : "",
        };
      })
      .filter((item) => item.question.length >= 3 && item.answer.length >= 3)
      .slice(0, 12);
  } catch {
    return [];
  }
}

/** Accept a YYYY-MM-DD or ISO timestamp and return a readable date. */
export function formatVerified(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

// FAQPage schema was intentionally removed per Google Search guidelines (Aug 2023 update restricts FAQ rich results to government and health sites).
// Quiz and Course schemas are disallowed per /docs/SEO_RULES.md.

export function breadcrumbJsonLd(
  site: URL,
  trail: { name: string; path: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: new URL(item.path, site).toString(),
    })),
  };
}

export function articleJsonLd(input: {
  site: URL;
  title: string;
  description: string;
  path: string;
  updated?: string | null;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    mainEntityOfPage: new URL(input.path, input.site).toString(),
    dateModified: input.updated || new Date().toISOString(),
    author: { "@type": "Organization", name: SITE_NAME, url: input.site.toString() },
    publisher: { "@type": "Organization", name: SITE_NAME, url: input.site.toString() },
  };
}

export function itemListJsonLd(
  site: URL,
  items: { name: string; path: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: new URL(item.path, site).toString(),
    })),
  };
}
