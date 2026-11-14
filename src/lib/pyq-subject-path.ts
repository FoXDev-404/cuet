const PYQ_ARCHIVE_PATH = "/cuet-ug-previous-year-question-papers";

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
  return `${PYQ_ARCHIVE_PATH}/${category}/subject/${encodeURIComponent(slug)}`;
}

export function getPyqPaperPath(
  paperSlug: string,
  subjectSlug: string,
  subjectType?: string | null,
): string {
  return `${getPyqSubjectPath(subjectSlug, subjectType)}/${encodeURIComponent(paperSlug)}`;
}
