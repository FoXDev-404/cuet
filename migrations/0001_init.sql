PRAGMA foreign_keys = ON;

-- ===== Core taxonomy =====
CREATE TABLE exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exams(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('language', 'domain', 'general')),
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  UNIQUE (subject_id, slug)
);

-- ===== People =====
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  target_exam_date TEXT,
  is_profile_public INTEGER NOT NULL DEFAULT 0,
  streak_count INTEGER NOT NULL DEFAULT 0,
  last_active_date TEXT,
  approved_comments INTEGER NOT NULL DEFAULT 0,
  muted_until TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('super', 'editor', 'moderator', 'contributor')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE password_resets (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE email_verifications (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ===== Content =====
CREATE TABLE passages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  body TEXT NOT NULL,
  body_hi TEXT,
  image_url TEXT,
  image_alt TEXT,
  deleted_at TEXT
);

CREATE TABLE questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  topic_id INTEGER REFERENCES topics(id),
  passage_id INTEGER REFERENCES passages(id),
  text TEXT NOT NULL,
  text_hi TEXT,
  options TEXT NOT NULL,
  options_hi TEXT,
  correct_option INTEGER NOT NULL CHECK (correct_option >= 0),
  explanation TEXT,
  explanation_hi TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  year INTEGER,
  image_url TEXT,
  image_alt TEXT,
  explanation_image_url TEXT,
  explanation_image_alt TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'published')),
  supersedes_id INTEGER REFERENCES questions(id),
  created_by INTEGER REFERENCES admins(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE mock_tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exams(id),
  subject_id INTEGER REFERENCES subjects(id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('full', 'subject', 'chapter', 'pyq')),
  duration_min INTEGER NOT NULL,
  total_marks REAL NOT NULL,
  marking_scheme TEXT NOT NULL,
  instructions TEXT,
  intro_html TEXT,
  pyq_year INTEGER,
  pyq_shift TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'published', 'archived')),
  version INTEGER NOT NULL DEFAULT 1,
  previous_version_id INTEGER REFERENCES mock_tests(id),
  published_at TEXT,
  created_by INTEGER REFERENCES admins(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE mock_questions (
  mock_id INTEGER NOT NULL REFERENCES mock_tests(id),
  question_id INTEGER NOT NULL REFERENCES questions(id),
  section TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (mock_id, question_id)
);

-- ===== Attempts =====
CREATE TABLE attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  guest_token TEXT,
  mock_id INTEGER NOT NULL REFERENCES mock_tests(id),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'expired')),
  score REAL,
  correct INTEGER,
  wrong INTEGER,
  skipped INTEGER,
  time_taken_sec INTEGER,
  started_at TEXT NOT NULL,
  deadline_at TEXT NOT NULL,
  submitted_at TEXT,
  is_first_attempt INTEGER NOT NULL DEFAULT 0,
  CHECK (user_id IS NOT NULL OR guest_token IS NOT NULL)
);

CREATE TABLE attempt_answers (
  attempt_id INTEGER NOT NULL REFERENCES attempts(id),
  question_id INTEGER NOT NULL REFERENCES questions(id),
  selected INTEGER,
  time_spent_sec INTEGER NOT NULL DEFAULT 0,
  marked_for_review INTEGER NOT NULL DEFAULT 0,
  is_correct INTEGER,
  PRIMARY KEY (attempt_id, question_id)
);

-- ===== Reports and discussion =====
CREATE TABLE question_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES questions(id),
  user_id INTEGER REFERENCES users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE discussions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mock_id INTEGER NOT NULL REFERENCES mock_tests(id),
  question_id INTEGER REFERENCES questions(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  parent_id INTEGER REFERENCES discussions(id),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 2 AND 2000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('visible', 'pending', 'hidden')),
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_best_answer INTEGER NOT NULL DEFAULT 0,
  upvotes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE discussion_votes (
  discussion_id INTEGER NOT NULL REFERENCES discussions(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  PRIMARY KEY (discussion_id, user_id)
);

CREATE TABLE discussion_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discussion_id INTEGER NOT NULL REFERENCES discussions(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (discussion_id, user_id)
);

-- ===== User features =====
CREATE TABLE bookmarks (
  user_id INTEGER NOT NULL REFERENCES users(id),
  question_id INTEGER NOT NULL REFERENCES questions(id),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, question_id)
);

CREATE TABLE user_stats (
  user_id INTEGER NOT NULL REFERENCES users(id),
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  topic_id INTEGER NOT NULL DEFAULT 0,
  attempted INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  avg_time_sec REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, subject_id, topic_id)
);

CREATE TABLE badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE user_badges (
  user_id INTEGER NOT NULL REFERENCES users(id),
  badge_id INTEGER NOT NULL REFERENCES badges(id),
  awarded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, badge_id)
);

-- ===== Site content and admin =====
CREATE TABLE page_seo (
  path TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  intro_html TEXT,
  faq_json TEXT,
  noindex INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);

CREATE TABLE exam_info (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  source_url TEXT,
  last_verified TEXT
);

CREATE TABLE announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL,
  link TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT,
  ends_at TEXT
);

CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL REFERENCES admins(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  diff_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Media bytes live in Workers KV; D1 stores only searchable metadata.
CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  alt TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ===== Indexes =====
CREATE INDEX idx_attempts_leaderboard ON attempts(mock_id, score DESC, time_taken_sec ASC);
CREATE INDEX idx_attempts_user ON attempts(user_id);
CREATE INDEX idx_attempts_guest ON attempts(guest_token);
CREATE UNIQUE INDEX uq_first_attempt ON attempts(user_id, mock_id) WHERE is_first_attempt = 1;
CREATE INDEX idx_questions_subject ON questions(subject_id, status);
CREATE INDEX idx_questions_topic ON questions(topic_id);
CREATE INDEX idx_mocks_status ON mock_tests(status, published_at);
CREATE INDEX idx_mq_mock ON mock_questions(mock_id, section, position);
CREATE INDEX idx_disc_mock ON discussions(mock_id, status, parent_id, created_at DESC);
CREATE INDEX idx_disc_question ON discussions(question_id, status);
CREATE INDEX idx_disc_top ON discussions(mock_id, status, upvotes DESC);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_media_assets_created ON media_assets(created_at DESC);
