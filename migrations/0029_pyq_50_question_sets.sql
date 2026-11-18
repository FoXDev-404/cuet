-- Migration 0029: 50-question PYQ sets, archive flags and question source tags.
--
-- Additive only. No existing column, question or paper row is edited or
-- deleted. Old paper rows keep every question; archiving only hides them from
-- listings and turns their public URLs into 301s (see `replaced_by`).
--
-- Rollback: restore the pre-apply backup. Never run a destructive down
-- migration against production.

-- ---------------------------------------------------------------------------
-- Papers: language, archive state and the replacement target.
-- ---------------------------------------------------------------------------
ALTER TABLE practice_papers ADD COLUMN language TEXT NOT NULL DEFAULT 'English';
ALTER TABLE practice_papers ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;
ALTER TABLE practice_papers ADD COLUMN replaced_by TEXT;

-- Existing Hindi papers were imported from Hindi-medium PDFs.
UPDATE practice_papers
SET language = 'Hindi'
WHERE subject_id IN (SELECT id FROM subjects WHERE slug = 'hindi');

CREATE INDEX IF NOT EXISTS idx_practice_papers_archived
  ON practice_papers(is_archived);

-- ---------------------------------------------------------------------------
-- Practice questions: immutable provenance. The importer never guessed these;
-- the rebuild copies the original paper's year/date/shift/number verbatim and
-- leaves a value NULL when the source did not print it.
-- ---------------------------------------------------------------------------
ALTER TABLE practice_questions ADD COLUMN source_year INTEGER;
ALTER TABLE practice_questions ADD COLUMN source_date TEXT;
ALTER TABLE practice_questions ADD COLUMN source_shift TEXT;
ALTER TABLE practice_questions ADD COLUMN source_paper_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_practice_questions_source_paper
  ON practice_questions(source_paper_id);

-- ---------------------------------------------------------------------------
-- Ranked question bank: the attempt runner and result review read `questions`,
-- so the same tag must be available without a join.
-- ---------------------------------------------------------------------------
ALTER TABLE questions ADD COLUMN source_year INTEGER;
ALTER TABLE questions ADD COLUMN source_date TEXT;
ALTER TABLE questions ADD COLUMN source_shift TEXT;
ALTER TABLE questions ADD COLUMN source_question_no INTEGER;
ALTER TABLE questions ADD COLUMN source_paper_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_questions_source_paper
  ON questions(source_paper_id);

-- ---------------------------------------------------------------------------
-- Archived mock wrappers redirect either to another mock (`entity_id`) or to a
-- plain path such as a subject hub. `target_path` is only set for the latter.
-- ---------------------------------------------------------------------------
ALTER TABLE slug_redirects ADD COLUMN target_path TEXT;
