PRAGMA foreign_keys = ON;

-- ============================================================================
-- 0012 — question sharing foundation.
--
-- Each question lineage gets one opaque, crypto-random public id. Public URLs
-- and payloads never carry questions.id; the admin panel resolves the mapping
-- to the current revision. A revision insert with supersedes_id moves the
-- pointer in the same transaction as the insert (AFTER INSERT trigger).
--
-- The existing public_id rows are filled by
-- scripts/backfill-question-public-ids.mjs, which generates base62 identifiers
-- in application code instead of using a non-cryptographic SQL random source.
-- ============================================================================

CREATE TABLE IF NOT EXISTS question_public_ids (
  public_id TEXT PRIMARY KEY,
  current_question_id INTEGER NOT NULL REFERENCES questions(id),
  share_enabled INTEGER NOT NULL DEFAULT 1,
  reveal_policy TEXT NOT NULL DEFAULT 'attempted_only'
    CHECK (reveal_policy IN ('attempted_only','public')),
  seo_indexable INTEGER NOT NULL DEFAULT 0,
  rights_ok INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_qpid_current
  ON question_public_ids(current_question_id);

CREATE TABLE IF NOT EXISTS share_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT,                     -- null when sharing a mock link
  mock_id INTEGER,
  user_id INTEGER,
  context TEXT NOT NULL CHECK (context IN ('attempt','solutions','practice','public_page')),
  channel TEXT NOT NULL,              -- 'native','whatsapp','telegram','copy','download'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_share_events_pid
  ON share_events(public_id, created_at);

-- Move the lineage pointer atomically with the revision insert. The admin
-- workflow always inserts the replacement row with supersedes_id set; keeping
-- this in SQL means imports, duplicate endpoints and future writers cannot
-- leave the public id pointing at stale content.
CREATE TRIGGER IF NOT EXISTS trg_question_public_id_move
AFTER INSERT ON questions
FOR EACH ROW
WHEN NEW.supersedes_id IS NOT NULL
BEGIN
  UPDATE question_public_ids
  SET current_question_id = NEW.id
  WHERE current_question_id = NEW.supersedes_id;
END;
