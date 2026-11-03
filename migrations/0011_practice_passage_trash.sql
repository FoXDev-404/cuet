PRAGMA foreign_keys = ON;

-- Passages had no soft-delete column, so deleting one from the data manager was
-- permanent while its questions stayed behind. Align it with the other practice
-- tables so trash/restore works and the public reader can hide deleted passages.
ALTER TABLE practice_passages ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_practice_passages_deleted
  ON practice_passages(paper_slug, deleted_at);
