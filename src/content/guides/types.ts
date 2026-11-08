/**
 * Shared types for the repository-backed guide library.
 *
 * Guides live in `src/content/guides` so they are reviewed with the code and
 * served even when D1 is at its daily row-read limit. Database posts created in
 * /admin/blog are merged on top by the guide data layer.
 */

export type GuideCategory = "exam-basics" | "practice" | "subject-strategy" | "exam-day";

export interface StaticGuide {
  slug: string;
  title: string;
  description: string;
  category: GuideCategory;
  /** ISO date (YYYY-MM-DD) used for display, sorting and the sitemap. */
  publishedAt: string;
  /** ISO date (YYYY-MM-DD); defaults to publishedAt when omitted. */
  updatedAt?: string;
  /** Markdown subset rendered by `renderArticleBody`. */
  body: string;
}

export const GUIDE_CATEGORY_META: Record<
  GuideCategory,
  { label: string; blurb: string }
> = {
  "exam-basics": {
    label: "Exam basics",
    blurb:
      "How the exam is built, what the syllabus covers, and which official documents to read before you plan a single study session.",
  },
  "subject-strategy": {
    label: "Subject strategy",
    blurb:
      "Subject-specific routines for the CUET domain papers: what each paper rewards, which units to prioritise, and how to drill them.",
  },
  practice: {
    label: "Practice and analysis",
    blurb:
      "Timed attempts, error logs and score plateaus. These guides cover the loop that turns a mock test into a measurable improvement.",
  },
  "exam-day": {
    label: "Exam day",
    blurb:
      "Documents, reporting time and the exam-hall routine. Read these once early, then again in the final week.",
  },
};

export const GUIDE_CATEGORY_ORDER: GuideCategory[] = [
  "exam-basics",
  "subject-strategy",
  "practice",
  "exam-day",
];
