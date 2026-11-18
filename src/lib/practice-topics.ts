/**
 * Topic tags for the previous-year practice library.
 *
 * Local practice questions carry no topic metadata in their source JSON, and
 * the timed-bank `questions.topic_id` column cannot be edited after publishing
 * (see `trg_published_question_immutable`). The library therefore keeps its
 * own editor-assigned tag in `practice_questions.topic_id`, populated by
 * `scripts/tag-practice-questions.mjs`.
 *
 * Tags are never inferred from question text. A topic page goes live only when
 * an editor has imported a mapping and the mapped paper is listed (30+
 * recovered questions), so the public count always matches the visible cards.
 */

/**
 * Keep in sync with `MIN_LISTED_QUESTIONS` in `local-papers.ts`. Importing
 * that module here would pull the Worker-only D1 store into the CLI script.
 */
export const PRACTICE_TOPIC_MIN_QUESTIONS = 30;

export interface PracticeTopicMappingRow {
  paperSlug: string;
  questionKey: string;
  topicSlug: string;
}

export interface ParsePracticeTopicResult {
  rows: PracticeTopicMappingRow[];
  errors: string[];
}

export interface PracticeTopicContext {
  /** Published, non-deleted practice paper slug -> its subject id. */
  papers: Map<string, { subjectId: number }>;
  /** Paper slug -> live question keys. */
  questionKeys: Map<string, Set<string>>;
  /** `${subjectId}:${topicSlug}` -> topic id. */
  topics: Map<string, { id: number; subjectId: number }>;
}

export interface PracticeTopicUpdate extends PracticeTopicMappingRow {
  topicId: number;
}

export interface PlanPracticeTopicResult {
  updates: PracticeTopicUpdate[];
  errors: string[];
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const QUESTION_KEY = /^[^\s,]+$/;

function topicKey(subjectId: number, topicSlug: string): string {
  return `${subjectId}:${topicSlug}`;
}

/**
 * Parse the editor CSV. The header is optional; blank lines and `#` comments
 * are ignored. Returns every row-level problem instead of failing on the first
 * one so a single import reports all typos.
 */
export function parsePracticeTopicCsv(text: string): ParsePracticeTopicResult {
  const rows: PracticeTopicMappingRow[] = [];
  const errors: string[] = [];
  const seen = new Map<string, string>();
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  let firstDataLine = true;

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index].trim();
    if (!line || line.startsWith("#")) continue;

    const cells = line.split(",").map((cell) => cell.trim());
    if (cells.length !== 3) {
      errors.push(`line ${lineNumber}: expected paper_slug,question_key,topic_slug`);
      firstDataLine = false;
      continue;
    }
    const [paperSlug, questionKey, topicSlug] = cells;
    if (firstDataLine) {
      firstDataLine = false;
      if (paperSlug === "paper_slug" && questionKey === "question_key") continue;
    }
    if (!SLUG.test(paperSlug)) {
      errors.push(`line ${lineNumber}: invalid paper slug "${paperSlug}"`);
      continue;
    }
    if (!QUESTION_KEY.test(questionKey)) {
      errors.push(`line ${lineNumber}: invalid question key "${questionKey}"`);
      continue;
    }
    if (!SLUG.test(topicSlug)) {
      errors.push(`line ${lineNumber}: invalid topic slug "${topicSlug}"`);
      continue;
    }

    const key = `${paperSlug}\u0000${questionKey}`;
    const previous = seen.get(key);
    if (previous === topicSlug) continue;
    if (previous) {
      errors.push(
        `line ${lineNumber}: ${paperSlug}/${questionKey} is mapped to both "${previous}" and "${topicSlug}"`,
      );
      continue;
    }
    seen.set(key, topicSlug);
    rows.push({ paperSlug, questionKey, topicSlug });
  }

  return { rows, errors };
}

/**
 * Validate parsed rows against the live paper, question and topic catalog.
 * The caller applies the returned updates in one transaction; unknown rows are
 * reported and skipped rather than guessed.
 */
export function planPracticeTopicUpdates(
  rows: PracticeTopicMappingRow[],
  context: PracticeTopicContext,
): PlanPracticeTopicResult {
  const updates: PracticeTopicUpdate[] = [];
  const errors: string[] = [];

  for (const row of rows) {
    const paper = context.papers.get(row.paperSlug);
    if (!paper) {
      errors.push(`${row.paperSlug}: no published practice paper with this slug`);
      continue;
    }
    const keys = context.questionKeys.get(row.paperSlug);
    if (!keys?.has(row.questionKey)) {
      errors.push(`${row.paperSlug}/${row.questionKey}: no live question with this key`);
      continue;
    }
    const topic = context.topics.get(topicKey(paper.subjectId, row.topicSlug));
    if (!topic) {
      errors.push(
        `${row.paperSlug}/${row.questionKey}: topic "${row.topicSlug}" does not belong to this paper's subject`,
      );
      continue;
    }
    updates.push({ ...row, topicId: topic.id });
  }

  return { updates, errors };
}

/**
 * Correlated SQL expression counting editor-tagged practice questions for a
 * topic. `topicColumn` is a trusted SQL identifier supplied by the calling
 * query (`t.id`, `?`, ...), never user input.
 *
 * Only published, non-deleted papers with at least
 * {@link PRACTICE_TOPIC_MIN_QUESTIONS} live questions contribute, matching the
 * public listing gate.
 */
export function practiceTopicCountSql(topicColumn = "t.id"): string {
  return `(SELECT COUNT(*)
            FROM practice_questions pq
            JOIN practice_papers pp ON pp.slug = pq.paper_slug
            JOIN topics tt ON tt.id = pq.topic_id AND tt.subject_id = pp.subject_id
            WHERE pq.topic_id = ${topicColumn}
              AND pq.deleted_at IS NULL
              AND pp.deleted_at IS NULL
              AND pp.publication_status = 'published'
              AND pp.is_archived = 0
              AND tt.deleted_at IS NULL
              AND (SELECT COUNT(*) FROM practice_questions pq_all
                   WHERE pq_all.paper_slug = pp.slug
                     AND pq_all.deleted_at IS NULL) >= ${PRACTICE_TOPIC_MIN_QUESTIONS})`;
}
