import { getLocalPaperSummary } from "./local-papers";

/**
 * The subset of a mock-test row that the public overview and instructions
 * pages render. Field names match the D1 columns so a fallback object can be
 * used anywhere the query result is used.
 */
export interface LocalMockFallback {
  id: number;
  title: string;
  slug: string;
  type: string;
  duration_min: number;
  total_marks: number;
  marking_scheme: string;
  instructions: string | null;
  intro_html: string | null;
  subject_name: string | null;
  published_at: string | null;
  question_count: number;
  attempt_count: number;
}

/**
 * Builds a mock-page payload from the bundled practice library.
 *
 * Practice papers are stored twice: in D1 (`mock_tests`) and in the committed
 * `src/data/local-papers` bundle. When D1 is unreachable the bundle still
 * describes the paper well enough to render its overview and instructions, so
 * an indexed `/mock/<practice-slug>` URL keeps answering 200 instead of 503.
 *
 * Returns `null` for slugs that are not practice papers.
 */
export function getLocalMockFallback(slug: string): LocalMockFallback | null {
  let paper;
  try {
    paper = getLocalPaperSummary(slug);
  } catch (error) {
    // The library is only warm after middleware runs; never turn a missing
    // snapshot into a page-level 500.
    console.error("Practice library unavailable for mock fallback", error);
    return null;
  }
  if (!paper) return null;
  const scored = paper.scorableQuestionCount || paper.totalQuestions;
  return {
    id: 0,
    title: paper.title,
    slug: paper.slug,
    type: "pyq",
    duration_min: paper.durationMinutes,
    total_marks: paper.markingScheme.correct * scored,
    // parseMarkingScheme expects the negative penalty that D1 stores.
    marking_scheme: JSON.stringify({
      correct: paper.markingScheme.correct,
      wrong: -paper.markingScheme.wrong,
      skipped: paper.markingScheme.skipped,
    }),
    instructions: null,
    intro_html: null,
    subject_name: paper.subject.name,
    published_at: null,
    question_count: scored,
    attempt_count: paper.attemptCount,
  };
}
