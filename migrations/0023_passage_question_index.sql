-- Migration 0023: Index question counts by passage.
--
-- The admin passages list counts questions for each of up to 200 listed
-- passages with a correlated subquery. Without this index SQLite scans every
-- question row once per passage: on the production bank that is about
-- 3.16 million rows read for a single page load, enough to exhaust the
-- free-tier daily read quota after a couple of visits. The same subquery also
-- backs the single-passage editor.

CREATE INDEX IF NOT EXISTS idx_questions_passage
  ON questions(passage_id, deleted_at);
