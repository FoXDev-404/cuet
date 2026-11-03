PRAGMA foreign_keys = ON;

-- ============================================================================
-- Blueprint v2 operational modules that arrived after the versioning migration:
-- editorial guides, account bans, PYQ provenance timestamps and announcement
-- audit fields. Every column added to an existing table is nullable so SQLite
-- can apply this migration to a populated remote database.
-- ============================================================================

ALTER TABLE users ADD COLUMN banned_at TEXT;
ALTER TABLE users ADD COLUMN updated_at TEXT;
UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;

-- Leaderboard control needs to distinguish "never ranked" from "disqualified".
ALTER TABLE attempts ADD COLUMN disqualified_at TEXT;
ALTER TABLE attempts ADD COLUMN disqualified_by INTEGER REFERENCES admins(id);

ALTER TABLE pyq_papers ADD COLUMN created_at TEXT;
ALTER TABLE pyq_papers ADD COLUMN updated_at TEXT;
ALTER TABLE pyq_papers ADD COLUMN deleted_at TEXT;
UPDATE pyq_papers SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE created_at IS NULL;

ALTER TABLE announcements ADD COLUMN created_at TEXT;
ALTER TABLE announcements ADD COLUMN updated_at TEXT;
ALTER TABLE announcements ADD COLUMN created_by INTEGER REFERENCES admins(id);
ALTER TABLE announcements ADD COLUMN deleted_at TEXT;
UPDATE announcements SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE created_at IS NULL;

CREATE TABLE blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at TEXT,
  created_by INTEGER REFERENCES admins(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE INDEX idx_blog_posts_status ON blog_posts(status, published_at DESC);
CREATE INDEX idx_users_banned ON users(banned_at);
CREATE INDEX idx_pyq_published ON pyq_papers(status, year);
CREATE INDEX idx_attempts_disqualified ON attempts(disqualified_at);
