import { getDb } from "./db";
import {
  PRACTICE_INDEX_CACHE_KEY,
  practicePaperCacheKey,
  readPracticeCache,
  writePracticeCache,
} from "./practice-cache";
import type { PracticeLibraryStore } from "./practice-library";
import type { LocalPaper, LocalPaperSummary } from "./practice-normalize";
import {
  mapIndexRow,
  mapPaperRow,
  type PaperIndexRow,
  type PaperRow,
  type PassageRow,
  type QuestionRow,
} from "./practice-store-rows";

const INDEX_SQL = `
  SELECT
    p.slug,
    p.title,
    p.meta_description,
    p.year,
    p.exam_date,
    p.date_label,
    p.shift,
    p.duration_min,
    p.source_file,
    p.source_method,
    p.source_url,
    p.source_type,
    p.rights_status,
    p.rights_note,
    p.verified_by,
    p.verified_at,
    p.source_question_count,
    p.publication_status,
    p.review_required,
    s.name AS subject_name,
    s.slug AS subject_slug,
    s.code AS subject_code,
    COUNT(q.id) AS question_count,
    COALESCE(SUM(CASE WHEN q.correct_option IS NOT NULL THEN 1 ELSE 0 END), 0) AS scorable_count,
    COALESCE(SUM(CASE WHEN q.assets_json <> '[]' THEN 1 ELSE 0 END), 0) AS image_question_count,
    COALESCE(SUM(json_array_length(q.assets_json)), 0) AS asset_count,
    (SELECT COUNT(*) FROM attempts a
       JOIN mock_tests m ON m.id = a.mock_id
      WHERE m.slug = p.slug AND a.status IN ('submitted', 'expired')) AS attempt_count
  FROM practice_papers p
  JOIN subjects s ON s.id = p.subject_id
  LEFT JOIN practice_questions q
    ON q.paper_slug = p.slug AND q.deleted_at IS NULL
  WHERE p.deleted_at IS NULL AND p.publication_status = 'published'
  GROUP BY p.id
  ORDER BY p.year DESC, s.name ASC, p.exam_date ASC, p.shift ASC
`;

async function loadIndex(): Promise<LocalPaperSummary[]> {
  const cached = await readPracticeCache<LocalPaperSummary[]>(PRACTICE_INDEX_CACHE_KEY);
  if (cached?.fresh) return cached.payload;

  try {
    const result = await getDb().prepare(INDEX_SQL).all<PaperIndexRow>();
    const papers = (result.results ?? []).map(mapIndexRow);
    await writePracticeCache(PRACTICE_INDEX_CACHE_KEY, papers);
    return papers;
  } catch (error) {
    if (cached) {
      // D1 is unreachable (quota exhausted, database busy). The index barely
      // changes, so the last known good copy is better than a 500.
      console.error("Practice index refresh failed; serving the cached copy.", error);
      return cached.payload;
    }
    throw error;
  }
}

async function readPaperFromD1(slug: string): Promise<LocalPaper | null> {
  const db = getDb();
  const [paperResult, passageResult, questionResult] = await db.batch<
    PaperRow | PassageRow | QuestionRow
  >([
    db
      .prepare(
        `SELECT
           p.slug, p.title, p.meta_description, p.year, p.exam_date, p.date_label, p.shift,
           p.duration_min, p.source_file, p.source_method, p.source_url, p.source_type,
           p.rights_status, p.rights_note, p.verified_by, p.verified_at, p.source_question_count,
           p.publication_status, p.review_required,
           s.name AS subject_name, s.slug AS subject_slug, s.code AS subject_code
         FROM practice_papers p
         JOIN subjects s ON s.id = p.subject_id
         WHERE p.slug = ? AND p.deleted_at IS NULL AND p.publication_status = 'published'`,
      )
      .bind(slug),
    db
      .prepare(
        `SELECT passage_key, title, body
         FROM practice_passages
         WHERE paper_slug = ? AND deleted_at IS NULL
         ORDER BY id`,
      )
      .bind(slug),
    db
      .prepare(
        `SELECT question_key, source_question_no, position, stem, options_json,
                options_are_images, correct_option, explanation, passage_key,
                match_list_json, arrangement_json, assets_json, review_flags_json
         FROM practice_questions
         WHERE paper_slug = ? AND deleted_at IS NULL
         ORDER BY position`,
      )
      .bind(slug),
  ]);

  const paperRow = (paperResult.results?.[0] ?? null) as PaperRow | null;
  if (!paperRow) return null;

  return mapPaperRow(
    paperRow,
    (passageResult.results ?? []) as PassageRow[],
    (questionResult.results ?? []) as QuestionRow[],
  );
}

async function loadPaper(slug: string): Promise<LocalPaper | null> {
  const cacheKey = practicePaperCacheKey(slug);
  const cached = await readPracticeCache<LocalPaper | null>(cacheKey);
  if (cached?.fresh) return cached.payload;

  try {
    const paper = await readPaperFromD1(slug);
    await writePracticeCache(cacheKey, paper);
    return paper;
  } catch (error) {
    if (cached) {
      console.error(
        `Practice paper "${slug}" refresh failed; serving the cached copy.`,
        error,
      );
      return cached.payload;
    }
    throw error;
  }
}

export const practiceLibraryD1Store: PracticeLibraryStore = { loadIndex, loadPaper };
