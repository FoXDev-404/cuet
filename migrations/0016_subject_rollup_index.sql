-- Performance optimization for cold subject rollup queries
-- Covers: SELECT s.slug, count(q.id) FROM questions q WHERE q.status = 'published' AND q.deleted_at IS NULL GROUP BY s.slug
CREATE INDEX IF NOT EXISTS idx_questions_status_deleted
  ON questions(status, deleted_at, subject_id);

