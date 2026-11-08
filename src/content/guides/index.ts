import { EXAM_BASICS_GUIDES } from "./exam-basics";
import { PRACTICE_GUIDES } from "./practice";
import { SUBJECT_GUIDES_A } from "./subjects-a";
import { SUBJECT_GUIDES_B } from "./subjects-b";
import type { StaticGuide } from "./types";

export { GUIDE_CATEGORY_META, GUIDE_CATEGORY_ORDER } from "./types";
export type { GuideCategory, StaticGuide } from "./types";

/** All repository-backed guides, in publication order. */
export const STATIC_GUIDES: StaticGuide[] = [
  ...EXAM_BASICS_GUIDES,
  ...SUBJECT_GUIDES_A,
  ...SUBJECT_GUIDES_B,
  ...PRACTICE_GUIDES,
].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug));

/**
 * The three guides the index promotes above the full library. These are the
 * orientation, review and logistics pieces that make the rest useful.
 */
export const START_HERE_SLUGS = [
  "cuet-ug-syllabus-and-ncert-books",
  "cuet-ug-how-to-review-a-mock-test",
  "cuet-ug-exam-day-checklist",
] as const;
