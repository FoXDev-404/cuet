-- Trash-page partial indexes.
--
-- `trashCounts()` and `listTrash()` filter on `deleted_at IS NOT NULL`. A
-- normal index on `deleted_at` still stores every live row, so SQLite has to
-- walk the whole index (15.8k questions on production) just to find the ~845
-- deleted ones. A partial index stores only deleted rows, which keeps the
-- admin trash screen cheap even when the live table grows.
--
-- The column order (`deleted_at DESC`) matches the `ORDER BY deleted_at DESC`
-- used by listTrash(), so a page of trash rows needs no temporary sort.
-- `CREATE INDEX IF NOT EXISTS` keeps the migration safe to re-run.

CREATE INDEX IF NOT EXISTS idx_trash_questions
  ON questions(deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trash_passages
  ON passages(deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trash_mock_tests
  ON mock_tests(deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trash_pyq_papers
  ON pyq_papers(deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trash_announcements
  ON announcements(deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trash_blog_posts
  ON blog_posts(deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trash_subjects
  ON subjects(deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trash_topics
  ON topics(deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trash_exams
  ON exams(deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trash_admins
  ON admins(deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trash_media_assets
  ON media_assets(deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trash_badges
  ON badges(deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trash_discussions
  ON discussions(deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trash_practice_papers
  ON practice_papers(deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trash_practice_passages
  ON practice_passages(deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trash_practice_questions
  ON practice_questions(deleted_at DESC) WHERE deleted_at IS NOT NULL;
