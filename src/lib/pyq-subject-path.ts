export const PYQ_ARCHIVE_PATH = "/cuet-ug-previous-year-question-papers";

export const PYQ_CATEGORY_SLUGS = [
  "general-aptitude-test-pyqs",
  "language-pyqs",
  "domain-subject-pyqs",
] as const;

export type PyqCategorySlug = (typeof PYQ_CATEGORY_SLUGS)[number];

const LANGUAGE_SUBJECT_SLUGS = new Set([
  "english",
  "hindi",
  "sanskrit",
  "urdu",
  "french",
  "german",
  "spanish",
  "japanese",
  "chinese",
  "arabic",
  "tamil",
  "telugu",
  "kannada",
  "malayalam",
  "marathi",
  "gujarati",
  "bengali",
  "punjabi",
  "odia",
  "assamese",
]);

export type PyqSubjectType = "general" | "domain" | "language";

export function getPyqSubjectType(
  type: string | null | undefined,
  slug: string,
): PyqSubjectType {
  if (type === "general" || slug === "general-test") return "general";
  if (type === "language" || LANGUAGE_SUBJECT_SLUGS.has(slug)) return "language";
  return "domain";
}

export function getPyqSubjectCategoryPath(type: string | null | undefined, slug: string): string {
  switch (getPyqSubjectType(type, slug)) {
    case "general":
      return "general-aptitude-test-pyqs";
    case "language":
      return "language-pyqs";
    case "domain":
      return "domain-subject-pyqs";
  }
}

export function getPyqSubjectPath(slug: string, type: string | null | undefined): string {
  const category = getPyqSubjectCategoryPath(type, slug);
  return `${PYQ_ARCHIVE_PATH}/${category}/${encodeURIComponent(slug)}`;
}

export function getPyqPaperPath(
  paperSlug: string,
  subjectSlug: string,
  subjectType?: string | null,
): string {
  return `${getPyqSubjectPath(subjectSlug, subjectType)}/${encodeURIComponent(paperSlug)}`;
}

/** Category roots are archive sections, not standalone pages. */
export function resolvePyqCategoryRoot(category: string): string | null {
  return (PYQ_CATEGORY_SLUGS as readonly string[]).includes(category)
    ? PYQ_ARCHIVE_PATH
    : null;
}

/**
 * An empty `(year, subject)` archive is valid but has no page of its own while
 * every paper for the pair is hidden. Send visitors to the canonical subject
 * hub instead of a raw 404, but only when the year and subject are real.
 */
export function resolveEmptyPyqArchiveRedirect(options: {
  yearHasPapers: boolean;
  subjectKnown: boolean;
  subjectSlug: string;
  subjectType?: string | null;
}): string | null {
  if (!options.yearHasPapers || !options.subjectKnown) return null;
  return getPyqSubjectPath(options.subjectSlug, options.subjectType);
}
