PRAGMA foreign_keys = ON;

-- ============================================================================
-- 0009 — admin full-control foundation.
-- Adds revision snapshots, resumable rescore jobs, attempt voiding, slug
-- redirects, and soft-delete columns for taxonomy/admin/media/badge tables.
-- Every statement is additive and safe on populated databases.
-- ============================================================================

-- Full before/after snapshots for published-content edits and restores.
CREATE TABLE IF NOT EXISTS revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  reason TEXT,
  admin_id INTEGER REFERENCES admins(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_revisions_entity
  ON revisions(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revisions_admin
  ON revisions(admin_id, created_at DESC);

-- Batched, idempotent, resumable rescore jobs.
CREATE TABLE IF NOT EXISTS rescore_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'complete', 'failed', 'cancelled')),
  total INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  started_by INTEGER REFERENCES admins(id),
  started_at TEXT,
  finished_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_rescore_jobs_status
  ON rescore_jobs(status, created_at DESC);

-- Voiding keeps the attempt for audit but removes it from ranked views.
ALTER TABLE attempts ADD COLUMN voided_at TEXT;
ALTER TABLE attempts ADD COLUMN void_reason TEXT;
ALTER TABLE attempts ADD COLUMN voided_by INTEGER REFERENCES admins(id);

CREATE INDEX IF NOT EXISTS idx_attempts_voided
  ON attempts(voided_at, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_status_submitted
  ON attempts(status, submitted_at DESC);

-- Renamed mocks keep working through a permanent redirect.
CREATE TABLE IF NOT EXISTS slug_redirects (
  old_slug TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_slug_redirects_entity
  ON slug_redirects(entity_type, entity_id);

-- Soft delete on the remaining admin-managed tables.
ALTER TABLE exams ADD COLUMN deleted_at TEXT;
ALTER TABLE subjects ADD COLUMN deleted_at TEXT;
ALTER TABLE topics ADD COLUMN deleted_at TEXT;
ALTER TABLE admins ADD COLUMN updated_at TEXT;
ALTER TABLE admins ADD COLUMN deleted_at TEXT;
ALTER TABLE media_assets ADD COLUMN deleted_at TEXT;
ALTER TABLE badges ADD COLUMN deleted_at TEXT;
ALTER TABLE discussions ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_exams_deleted ON exams(deleted_at);
CREATE INDEX IF NOT EXISTS idx_subjects_deleted ON subjects(deleted_at);
CREATE INDEX IF NOT EXISTS idx_topics_deleted ON topics(deleted_at);
CREATE INDEX IF NOT EXISTS idx_admins_deleted ON admins(deleted_at);
CREATE INDEX IF NOT EXISTS idx_media_deleted ON media_assets(deleted_at);
CREATE INDEX IF NOT EXISTS idx_discussions_deleted ON discussions(deleted_at);

-- Filters and sorts used by the new admin screens.
CREATE INDEX IF NOT EXISTS idx_questions_year_status
  ON questions(year, status, subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_updated
  ON questions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_created_by
  ON questions(created_by, deleted_at);
CREATE INDEX IF NOT EXISTS idx_mocks_updated
  ON mock_tests(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_admin_created
  ON audit_log(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity
  ON audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_created
  ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_deleted
  ON blog_posts(deleted_at, status);
