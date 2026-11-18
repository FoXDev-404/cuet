-- Migration 0031: a stable per-set ranked-question key.
--
-- `source_question_no` repeats across the papers pooled into one set, so the
-- isolation key must be the new set slug plus the new position. The seed uses
-- it to insert each ranked question exactly once and to clean up a failed
-- partial batch without touching a complete set.
ALTER TABLE questions ADD COLUMN source_key TEXT;

DROP INDEX IF EXISTS idx_questions_source_set_question;

CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_source_key
  ON questions(source_key)
  WHERE source_key IS NOT NULL;
