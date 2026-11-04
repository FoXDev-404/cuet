import { all } from "./db";
import {
  readPracticeCache,
  writePracticeCache,
  SUBJECT_STATS_CACHE_KEY,
} from "./practice-cache";
import {
  buildSubjectStats,
  type MockQuestionRow,
  type MockRow,
  type QuestionCountRow,
  type SubjectRow,
  type SubjectStatRow,
} from "./subject-stats-core";

/**
 * Per-subject question and mock rollups for the syllabus / mock-test hubs.
 *
 * The naive version of this query put two correlated subqueries on the
 * `subjects` list, so every subject rescanned the whole mock bank. D1 billed
 * ~2.1 million rows for a single render (six crawler hits burned 12.9M rows in
 * one day). The aggregates below scan the bank once, are combined in memory,
 * and the result is cached in KV for six hours.
 *
 * Field names stay snake_case so the payload can be dropped into the page
 * templates (and the `/api/subjects` response) in place of the old query rows.
 */

export type { SubjectStatRow } from "./subject-stats-core";

const SUBJECT_LIST_SQL = `
  SELECT s.id, s.name, s.slug, s.type, e.name AS exam_name, e.slug AS exam_slug
  FROM subjects s
  JOIN exams e ON e.id = s.exam_id
  WHERE s.is_active = 1 AND e.is_active = 1
  ORDER BY e.name, s.name
`;

const PUBLISHED_QUESTIONS_SQL = `
  SELECT subject_id, COUNT(*) AS question_count
  FROM questions
  WHERE status = 'published' AND deleted_at IS NULL
  GROUP BY subject_id
`;

const MOCK_QUESTIONS_SQL = `
  SELECT DISTINCT
         mq.mock_id,
         q.id AS question_id,
         q.subject_id,
         CASE WHEN m.practice_paper_slug IS NULL THEN 0 ELSE 1 END AS practice
  FROM mock_questions_current mq
  JOIN questions q ON q.id = mq.question_id
  JOIN mock_tests m ON m.id = mq.mock_id
  WHERE q.status = 'published' AND q.deleted_at IS NULL
    AND m.status = 'published' AND m.deleted_at IS NULL
    AND m.slug NOT LIKE 'e2e-%'
    AND m.slug NOT LIKE '%fixture%'
    AND m.slug NOT LIKE '%publish-check%'
    AND m.slug NOT LIKE 'slow-network-%'
    AND LOWER(m.title) NOT LIKE '%fixture%'
`;

const MOCKS_SQL = `
  SELECT id, subject_id,
         CASE WHEN practice_paper_slug IS NULL THEN 0 ELSE 1 END AS practice
  FROM mock_tests
  WHERE status = 'published' AND deleted_at IS NULL
    AND slug NOT LIKE 'e2e-%'
    AND slug NOT LIKE '%fixture%'
    AND slug NOT LIKE '%publish-check%'
    AND slug NOT LIKE 'slow-network-%'
    AND LOWER(title) NOT LIKE '%fixture%'
`;

/** How long the rollup may be reused before D1 is consulted again. */
const CACHE_TTL_SECONDS = 6 * 60 * 60;
/** Per-isolate guard so a cold KV cache does not fan out into many D1 reads. */
const MEMORY_TTL_MS = 60_000;
/** Pause after a D1 failure so a quota outage does not retry on every request. */
const FAILURE_BACKOFF_MS = 5 * 60_000;

let memory: { at: number; rows: SubjectStatRow[] } | null = null;
let inflight: Promise<SubjectStatRow[]> | null = null;
let lastFailureAt = 0;

async function loadSubjectStats(): Promise<SubjectStatRow[]> {
  const cached = await readPracticeCache<SubjectStatRow[]>(SUBJECT_STATS_CACHE_KEY);
  if (cached?.fresh) return cached.payload;

  try {
    const [subjects, published, mockQuestions, mocks] = await Promise.all([
      all<SubjectRow>(SUBJECT_LIST_SQL),
      all<QuestionCountRow>(PUBLISHED_QUESTIONS_SQL),
      all<MockQuestionRow>(MOCK_QUESTIONS_SQL),
      all<MockRow>(MOCKS_SQL),
    ]);
    const rows = buildSubjectStats(subjects, published, mockQuestions, mocks);
    await writePracticeCache(SUBJECT_STATS_CACHE_KEY, rows, CACHE_TTL_SECONDS);
    return rows;
  } catch (error) {
    if (cached) {
      // Quota exhausted or D1 busy: the counts barely move, so serve the last
      // known good rollup instead of dropping the subject grid.
      console.error("Subject stats refresh failed; serving the cached copy.", error);
      return cached.payload;
    }
    lastFailureAt = Date.now();
    throw error;
  }
}

/** Cached per-subject rollups. Throws when D1 fails and no cache exists. */
export async function getSubjectStats(): Promise<SubjectStatRow[]> {
  if (memory && Date.now() - memory.at < MEMORY_TTL_MS) return memory.rows;
  if (lastFailureAt && Date.now() - lastFailureAt < FAILURE_BACKOFF_MS) {
    throw new Error("Subject stats are cooling down after a D1 failure.");
  }
  if (!inflight) {
    inflight = loadSubjectStats()
      .then((rows) => {
        memory = { at: Date.now(), rows };
        lastFailureAt = 0;
        return rows;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}
