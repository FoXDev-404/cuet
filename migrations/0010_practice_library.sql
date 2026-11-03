PRAGMA foreign_keys = ON;

-- ============================================================================
-- Practice library (refined OCR previous-year papers).
--
-- The practice player is deliberately separate from the ranked mock engine:
-- attempts are graded in memory, never written to D1, and never affect a
-- leaderboard. Keeping the content in its own tables means the mock builder,
-- attempt scoring and immutability triggers cannot see or corrupt it.
--
-- These tables replace the build-time JSON bundle as the runtime source of
-- truth. The JSON files under src/data/local-papers remain the import seed.
-- ============================================================================

-- Subjects had no short code. The practice library prints one (APM, BIO, ...)
-- and the admin panel benefits from it, so add the nullable column instead of
-- duplicating it on every paper row.
ALTER TABLE subjects ADD COLUMN code TEXT;

CREATE TABLE IF NOT EXISTS practice_papers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  meta_description TEXT NOT NULL DEFAULT '',
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  year INTEGER NOT NULL,
  exam_date TEXT,
  date_label TEXT NOT NULL DEFAULT '',
  shift TEXT,
  duration_min INTEGER NOT NULL DEFAULT 45,
  source_file TEXT,
  source_method TEXT,
  source_question_count INTEGER NOT NULL DEFAULT 0,
  publication_status TEXT NOT NULL DEFAULT 'published'
    CHECK (publication_status IN ('draft', 'published')),
  review_required INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS practice_passages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paper_slug TEXT NOT NULL REFERENCES practice_papers(slug) ON DELETE CASCADE,
  passage_key TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  UNIQUE (paper_slug, passage_key)
);

-- Question keys are printed option letters (A/B/C/D). `correct_option` is NULL
-- when no authoritative key exists and stays unscored; it is never guessed.
-- Options are stored already normalised to A/B/C/D so SQL aggregate checks and
-- the runtime normaliser always agree.
CREATE TABLE IF NOT EXISTS practice_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paper_slug TEXT NOT NULL REFERENCES practice_papers(slug) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  source_question_no INTEGER,
  position INTEGER NOT NULL,
  stem TEXT NOT NULL DEFAULT '',
  options_json TEXT NOT NULL DEFAULT '[]',
  options_are_images INTEGER NOT NULL DEFAULT 0,
  correct_option TEXT,
  explanation TEXT,
  passage_key TEXT,
  match_list_json TEXT,
  arrangement_json TEXT NOT NULL DEFAULT '[]',
  assets_json TEXT NOT NULL DEFAULT '[]',
  source_pages_json TEXT NOT NULL DEFAULT '[]',
  review_status TEXT,
  review_flags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT,
  deleted_at TEXT,
  UNIQUE (paper_slug, question_key)
);

CREATE INDEX IF NOT EXISTS idx_practice_papers_subject ON practice_papers(subject_id);
CREATE INDEX IF NOT EXISTS idx_practice_papers_year ON practice_papers(year);
CREATE INDEX IF NOT EXISTS idx_practice_passages_paper ON practice_passages(paper_slug);
CREATE INDEX IF NOT EXISTS idx_practice_questions_paper ON practice_questions(paper_slug, position);
