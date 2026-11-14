import { getLocalSubjectSummaries } from "./local-papers";
import { getPyqSubjectType } from "./pyq-subject-path";

/**
 * A subject card as the syllabus and mock-test hub pages render it. Field
 * names mirror the D1 query aliases so either source can feed the template.
 */
export interface LocalSubjectCard {
  id: number;
  name: string;
  slug: string;
  type: "language" | "domain" | "general";
  question_count: number;
  mock_count: number;
}

function typeFor(slug: string): LocalSubjectCard["type"] {
  return getPyqSubjectType(undefined, slug);
}

/**
 * Subject list derived from the committed practice library.
 *
 * The syllabus and mock-test hub pages query D1 for the seeded subject list.
 * When that query fails the pages would render an empty grid (and drop their
 * internal links), so this rebuilds the same cards from the bundled index.
 * Returns an empty array if the library is not warm.
 */
export function getLocalSubjectCards(): LocalSubjectCard[] {
  try {
    return getLocalSubjectSummaries()
      .map((summary) => ({
        id: 0,
        name: summary.subject.name,
        slug: summary.subject.slug,
        type: typeFor(summary.subject.slug),
        question_count: summary.questionCount,
        mock_count: summary.paperCount,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Practice library unavailable for subject fallback", error);
    return [];
  }
}
