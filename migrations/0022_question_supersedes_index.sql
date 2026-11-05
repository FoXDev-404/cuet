-- Migration 0022: Index question lineage for duplicate detection.
--
-- findDuplicateQuestion() excludes any current question that already has a
-- live superseding revision. Without an index on supersedes_id, SQLite scans
-- the whole questions table once per candidate row; on the production-sized
-- bank that turned a single admin create into roughly 100M row reads.

CREATE INDEX IF NOT EXISTS idx_questions_supersedes_live
  ON questions(supersedes_id)
  WHERE supersedes_id IS NOT NULL AND deleted_at IS NULL;
