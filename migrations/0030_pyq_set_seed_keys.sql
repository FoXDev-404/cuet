-- Migration 0030: deterministic idempotency keys for the PYQ set seed.
--
-- The rebuild creates 118 papers and 5,900 ranked questions in batches. A
-- retried batch must never duplicate a passage or a ranked question, and a
-- partially applied set must be removable by an exact identifier rather than a
-- broad `LIKE` pattern. These columns are internal: no page renders them.
ALTER TABLE passages ADD COLUMN source_key TEXT;
ALTER TABLE questions ADD COLUMN source_set_slug TEXT;
ALTER TABLE practice_papers ADD COLUMN duration_locked INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_passages_source_key
  ON passages(subject_id, source_key)
  WHERE source_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_source_set_question
  ON questions(source_set_slug, source_question_no)
  WHERE source_set_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_source_set
  ON questions(source_set_slug)
  WHERE source_set_slug IS NOT NULL;
