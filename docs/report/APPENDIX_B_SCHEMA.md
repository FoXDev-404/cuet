# Appendix B: Database Schema & Entity Catalogue

_Extracted directly from local Cloudflare D1 miniflare SQLite database on 2026-11-04T20:12:11.329Z._

## Database Overview

- **Total Catalogued Tables:** 40
- **Total Database Rows:** 42,993
- **Applied Migrations:** 20 (from `0001_init.sql` through `0020_exam_info_seed.sql`)

## Table Catalogue Summary

| Table Name | Row Count | Columns | Indexes | Primary Purpose | Soft Delete? |
| :--- | :---: | :---: | :---: | :--- | :---: |
| `admins` | 2 | 7 | 2 | Admin accounts, roles (super, editor, moderator, contributor) | Yes (`deleted_at`) |
| `announcements` | 0 | 10 | 0 | Auxiliary / Join Table | Yes (`deleted_at`) |
| `attempt_answers` | 8,278 | 8 | 2 | User answer submissions per attempt question | No |
| `attempts` | 445 | 22 | 11 | Attempt instances, scores, deadlines, sequence ordering | No |
| `audit_log` | 797 | 7 | 2 | Auxiliary / Join Table | No |
| `badges` | 4 | 5 | 1 | Auxiliary / Join Table | Yes (`deleted_at`) |
| `blog_posts` | 0 | 11 | 3 | Auxiliary / Join Table | Yes (`deleted_at`) |
| `bookmarks` | 0 | 4 | 1 | Auxiliary / Join Table | No |
| `d1_migrations` | 19 | 3 | 1 | Auxiliary / Join Table | No |
| `discussion_reports` | 0 | 6 | 2 | Auxiliary / Join Table | No |
| `discussion_votes` | 0 | 2 | 1 | Auxiliary / Join Table | No |
| `discussions` | 20 | 12 | 4 | Discussion threads attached to questions | Yes (`deleted_at`) |
| `email_verifications` | 0 | 5 | 1 | Auxiliary / Join Table | No |
| `exam_info` | 6 | 4 | 1 | Verified CUET UG exam facts, dates, and patterns | No |
| `exams` | 1 | 5 | 2 | Auxiliary / Join Table | Yes (`deleted_at`) |
| `media_assets` | 0 | 10 | 4 | Auxiliary / Join Table | Yes (`deleted_at`) |
| `mock_questions` | 11,624 | 4 | 3 | Question-to-mock version mappings with ordering | No |
| `mock_test_versions` | 515 | 11 | 2 | Immutable versions of mock tests | No |
| `mock_tests` | 409 | 24 | 5 | Mock tests, published papers, slugs, types | Yes (`deleted_at`) |
| `page_seo` | 0 | 8 | 1 | Auxiliary / Join Table | No |
| `passages` | 234 | 7 | 0 | Reading comprehension passages linked to questions | Yes (`deleted_at`) |
| `password_resets` | 0 | 5 | 1 | Auxiliary / Join Table | No |
| `practice_papers` | 214 | 24 | 5 | Previous-year practice paper metadata & rights status | Yes (`deleted_at`) |
| `practice_passages` | 128 | 6 | 3 | Auxiliary / Join Table | Yes (`deleted_at`) |
| `practice_questions` | 6,603 | 24 | 3 | Auxiliary / Join Table | Yes (`deleted_at`) |
| `pyq_papers` | 0 | 12 | 2 | Auxiliary / Join Table | Yes (`deleted_at`) |
| `question_public_ids` | 123 | 7 | 2 | Base62 public IDs and share policies for questions | No |
| `question_reports` | 0 | 6 | 1 | Auxiliary / Join Table | No |
| `questions` | 12,372 | 28 | 8 | Master question item bank with revision tracking | Yes (`deleted_at`) |
| `rescore_jobs` | 0 | 10 | 1 | Auxiliary / Join Table | No |
| `revisions` | 230 | 7 | 2 | Auxiliary / Join Table | No |
| `sessions` | 685 | 4 | 2 | User session tokens, SHA-256 hashes, expiration | No |
| `share_events` | 0 | 7 | 1 | Auxiliary / Join Table | No |
| `site_settings` | 5 | 2 | 1 | Auxiliary / Join Table | No |
| `slug_redirects` | 0 | 4 | 2 | Auxiliary / Join Table | No |
| `subjects` | 19 | 8 | 2 | Academic domain subjects (English, Physics, etc.) | Yes (`deleted_at`) |
| `topics` | 0 | 5 | 2 | Syllabus topics under subjects | Yes (`deleted_at`) |
| `user_badges` | 50 | 3 | 1 | Auxiliary / Join Table | No |
| `user_stats` | 51 | 6 | 1 | Auxiliary / Join Table | No |
| `users` | 159 | 17 | 5 | User accounts, auth hashes, ban/mute state, streaks | Yes (`deleted_at`) |

---

## Complete DDL Schemas (from `sqlite_master`)

### Table: `admins`

- **Current Row Count:** 2
- **Columns:** 7

```sql
CREATE TABLE "admins" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('super', 'editor', 'moderator', 'contributor')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
, updated_at TEXT, deleted_at TEXT)
```

**Indexes:**

```sql
CREATE INDEX idx_admins_deleted ON "admins"(deleted_at);
```

### Table: `announcements`

- **Current Row Count:** 0
- **Columns:** 10

```sql
CREATE TABLE "announcements" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL,
  link TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT,
  ends_at TEXT
, created_at TEXT, updated_at TEXT, created_by INTEGER REFERENCES admins(id), deleted_at TEXT)
```

### Table: `attempt_answers`

- **Current Row Count:** 8,278
- **Columns:** 8

```sql
CREATE TABLE "attempt_answers" (
  attempt_id INTEGER NOT NULL REFERENCES attempts(id),
  question_id INTEGER NOT NULL REFERENCES questions(id),
  selected INTEGER,
  time_spent_sec INTEGER NOT NULL DEFAULT 0,
  marked_for_review INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT,
  is_correct INTEGER, client_seq INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (attempt_id, question_id)
)
```

**Indexes:**

```sql
CREATE INDEX idx_attempt_answers_question
  ON "attempt_answers"(question_id);
```

### Table: `attempts`

- **Current Row Count:** 445
- **Columns:** 22

```sql
CREATE TABLE "attempts" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  guest_token TEXT,
  mock_id INTEGER NOT NULL REFERENCES mock_tests(id),
  version_id INTEGER NOT NULL REFERENCES mock_test_versions(id),
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'submitted', 'expired')),
  score REAL,
  correct INTEGER,
  wrong INTEGER,
  skipped INTEGER,
  time_taken_sec INTEGER,
  started_at TEXT NOT NULL,
  deadline_at TEXT NOT NULL,
  submitted_at TEXT,
  is_first_attempt INTEGER NOT NULL DEFAULT 0, disqualified_at TEXT, disqualified_by INTEGER REFERENCES admins(id), voided_at TEXT, void_reason TEXT, voided_by INTEGER REFERENCES admins(id), last_client_seq INTEGER NOT NULL DEFAULT 0, section_summary TEXT,
  CHECK (user_id IS NOT NULL OR guest_token IS NOT NULL)
)
```

**Indexes:**

```sql
CREATE INDEX idx_attempts_leaderboard ON "attempts"(version_id, score DESC, time_taken_sec ASC);
CREATE INDEX idx_attempts_mock ON "attempts"(mock_id, status);
CREATE INDEX idx_attempts_user ON "attempts"(user_id);
CREATE INDEX idx_attempts_guest ON "attempts"(guest_token);
CREATE UNIQUE INDEX uq_first_attempt ON "attempts"(user_id, mock_id) WHERE is_first_attempt = 1;
CREATE INDEX idx_attempts_disqualified ON "attempts"(disqualified_at);
CREATE INDEX idx_attempts_user_finished
  ON "attempts"(user_id, status, submitted_at DESC);
CREATE INDEX idx_attempts_user_mock_status
  ON "attempts"(user_id, mock_id, status);
CREATE INDEX idx_attempts_started
  ON "attempts"(started_at);
CREATE INDEX idx_attempts_voided
  ON "attempts"(voided_at, submitted_at DESC);
CREATE INDEX idx_attempts_status_submitted
  ON "attempts"(status, submitted_at DESC);
```

### Table: `audit_log`

- **Current Row Count:** 797
- **Columns:** 7

```sql
CREATE TABLE "audit_log" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL REFERENCES admins(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  diff_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)
```

**Indexes:**

```sql
CREATE INDEX idx_audit_admin_created
  ON "audit_log"(admin_id, created_at DESC);
CREATE INDEX idx_audit_entity
  ON "audit_log"(entity_type, entity_id, created_at DESC);
```

### Table: `badges`

- **Current Row Count:** 4
- **Columns:** 5

```sql
CREATE TABLE "badges" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT
, deleted_at TEXT)
```

### Table: `blog_posts`

- **Current Row Count:** 0
- **Columns:** 11

```sql
CREATE TABLE "blog_posts" (
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
)
```

**Indexes:**

```sql
CREATE INDEX idx_blog_posts_status ON "blog_posts"(status, published_at DESC);
CREATE INDEX idx_blog_deleted
  ON "blog_posts"(deleted_at, status);
```

### Table: `bookmarks`

- **Current Row Count:** 0
- **Columns:** 4

```sql
CREATE TABLE "bookmarks" (
  user_id INTEGER NOT NULL REFERENCES users(id),
  question_id INTEGER NOT NULL REFERENCES questions(id),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, question_id)
)
```

### Table: `d1_migrations`

- **Current Row Count:** 19
- **Columns:** 3

```sql
CREATE TABLE "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
)
```

### Table: `discussion_reports`

- **Current Row Count:** 0
- **Columns:** 6

```sql
CREATE TABLE "discussion_reports" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discussion_id INTEGER NOT NULL REFERENCES discussions(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (discussion_id, user_id)
)
```

**Indexes:**

```sql
CREATE INDEX idx_discussion_reports_open
  ON "discussion_reports"(status, created_at DESC);
```

### Table: `discussion_votes`

- **Current Row Count:** 0
- **Columns:** 2

```sql
CREATE TABLE "discussion_votes" (
  discussion_id INTEGER NOT NULL REFERENCES discussions(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  PRIMARY KEY (discussion_id, user_id)
)
```

### Table: `discussions`

- **Current Row Count:** 20
- **Columns:** 12

```sql
CREATE TABLE "discussions" (
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
, deleted_at TEXT)
```

**Indexes:**

```sql
CREATE INDEX idx_disc_mock ON "discussions"(mock_id, status, parent_id, created_at DESC);
CREATE INDEX idx_disc_question ON "discussions"(question_id, status);
CREATE INDEX idx_disc_top ON "discussions"(mock_id, status, upvotes DESC);
CREATE INDEX idx_discussions_deleted ON "discussions"(deleted_at);
```

### Table: `email_verifications`

- **Current Row Count:** 0
- **Columns:** 5

```sql
CREATE TABLE "email_verifications" (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)
```

### Table: `exam_info`

- **Current Row Count:** 6
- **Columns:** 4

```sql
CREATE TABLE "exam_info" (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  source_url TEXT,
  last_verified TEXT
)
```

### Table: `exams`

- **Current Row Count:** 1
- **Columns:** 5

```sql
CREATE TABLE "exams" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1
, deleted_at TEXT)
```

**Indexes:**

```sql
CREATE INDEX idx_exams_deleted ON "exams"(deleted_at);
```

### Table: `media_assets`

- **Current Row Count:** 0
- **Columns:** 10

```sql
CREATE TABLE "media_assets" (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  alt TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
, deleted_at TEXT)
```

**Indexes:**

```sql
CREATE INDEX idx_media_assets_created ON "media_assets"(created_at DESC);
CREATE INDEX idx_media_deleted ON "media_assets"(deleted_at);
```

### Table: `mock_questions`

- **Current Row Count:** 11,624
- **Columns:** 4

```sql
CREATE TABLE "mock_questions" (
  version_id INTEGER NOT NULL REFERENCES mock_test_versions(id),
  question_id INTEGER NOT NULL REFERENCES questions(id),
  section TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (version_id, question_id)
)
```

**Indexes:**

```sql
CREATE INDEX idx_mq_version ON "mock_questions"(version_id, section, position);
CREATE INDEX idx_mq_question ON "mock_questions"(question_id);
```

### Table: `mock_test_versions`

- **Current Row Count:** 515
- **Columns:** 11

```sql
CREATE TABLE "mock_test_versions" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mock_id INTEGER NOT NULL REFERENCES mock_tests(id),
  version_no INTEGER NOT NULL,
  duration_min INTEGER NOT NULL,
  total_marks REAL NOT NULL,
  marking_scheme TEXT NOT NULL,
  instructions TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'published', 'superseded')),
  published_at TEXT,
  created_by INTEGER REFERENCES admins(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (mock_id, version_no)
)
```

**Indexes:**

```sql
CREATE INDEX idx_versions_mock ON "mock_test_versions"(mock_id, status);
```

### Table: `mock_tests`

- **Current Row Count:** 409
- **Columns:** 24

```sql
CREATE TABLE "mock_tests" (
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
, pyq_paper_id INTEGER REFERENCES pyq_papers(id), current_version_id INTEGER REFERENCES mock_test_versions(id), practice_paper_slug TEXT)
```

**Indexes:**

```sql
CREATE INDEX idx_mocks_status ON "mock_tests"(status, type);
CREATE INDEX idx_mocks_status_published ON "mock_tests"(status, published_at DESC);
CREATE INDEX idx_mocks_updated
  ON "mock_tests"(updated_at DESC);
CREATE INDEX idx_mock_tests_practice_paper
  ON "mock_tests"(practice_paper_slug);
```

### Table: `page_seo`

- **Current Row Count:** 0
- **Columns:** 8

```sql
CREATE TABLE "page_seo" (
  path TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  intro_html TEXT,
  faq_json TEXT,
  noindex INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
, canonical_url TEXT)
```

### Table: `passages`

- **Current Row Count:** 234
- **Columns:** 7

```sql
CREATE TABLE "passages" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  body TEXT NOT NULL,
  body_hi TEXT,
  image_url TEXT,
  image_alt TEXT,
  deleted_at TEXT
)
```

### Table: `password_resets`

- **Current Row Count:** 0
- **Columns:** 5

```sql
CREATE TABLE "password_resets" (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)
```

### Table: `practice_papers`

- **Current Row Count:** 214
- **Columns:** 24

```sql
CREATE TABLE "practice_papers" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  meta_description TEXT NOT NULL DEFAULT '',
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  year INTEGER NOT NULL,
  exam_date TEXT,
  date_label TEXT NOT NULL DEFAULT '',
  shift TEXT,
  duration_min INTEGER NOT NULL DEFAULT 45,
  source_file TEXT,
  source_method TEXT,
  source_question_count INTEGER NOT NULL DEFAULT 0,
  publication_status TEXT NOT NULL DEFAULT 'published'
    CHECK (publication_status IN ('draft', 'published')),
  review_required INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT,
  deleted_at TEXT
, source_url TEXT, source_type TEXT NOT NULL DEFAULT 'unknown'
  CHECK (source_type IN ('official_public', 'licensed', 'original', 'unknown')), rights_status TEXT NOT NULL DEFAULT 'unknown'
  CHECK (rights_status IN ('unknown', 'cleared', 'restricted')), rights_note TEXT, verified_by TEXT, verified_at TEXT)
```

**Indexes:**

```sql
CREATE INDEX idx_practice_papers_subject ON "practice_papers"(subject_id);
CREATE INDEX idx_practice_papers_year ON "practice_papers"(year);
CREATE INDEX idx_practice_papers_rights ON practice_papers(rights_status);
CREATE INDEX idx_practice_papers_source_type ON practice_papers(source_type);
```

### Table: `practice_passages`

- **Current Row Count:** 128
- **Columns:** 6

```sql
CREATE TABLE "practice_passages" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paper_slug TEXT NOT NULL REFERENCES "practice_papers"(slug) ON DELETE CASCADE,
  passage_key TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL, deleted_at TEXT,
  UNIQUE (paper_slug, passage_key)
)
```

**Indexes:**

```sql
CREATE INDEX idx_practice_passages_paper ON "practice_passages"(paper_slug);
CREATE INDEX idx_practice_passages_deleted
  ON "practice_passages"(paper_slug, deleted_at);
```

### Table: `practice_questions`

- **Current Row Count:** 6,603
- **Columns:** 24

```sql
CREATE TABLE "practice_questions" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paper_slug TEXT NOT NULL REFERENCES "practice_papers"(slug) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  source_question_no INTEGER,
  position INTEGER NOT NULL,
  stem TEXT NOT NULL DEFAULT '',
  options_json TEXT NOT NULL DEFAULT '[]',
  options_are_images INTEGER NOT NULL DEFAULT 0,
  correct_option TEXT,
  explanation TEXT,
  passage_key TEXT,
  match_list_json TEXT,
  arrangement_json TEXT NOT NULL DEFAULT '[]',
  assets_json TEXT NOT NULL DEFAULT '[]',
  source_pages_json TEXT NOT NULL DEFAULT '[]',
  review_status TEXT,
  review_flags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT,
  deleted_at TEXT, explanation_source TEXT NOT NULL DEFAULT 'none'
  CHECK (explanation_source IN ('official', 'human', 'ai_draft', 'banner', 'none')), explanation_status TEXT NOT NULL DEFAULT 'unreviewed'
  CHECK (explanation_status IN ('unreviewed', 'reviewed', 'flagged')), reviewed_by TEXT, reviewed_at TEXT,
  UNIQUE (paper_slug, question_key)
)
```

**Indexes:**

```sql
CREATE INDEX idx_practice_questions_paper ON "practice_questions"(paper_slug, position);
CREATE INDEX idx_practice_questions_review ON practice_questions(explanation_status, explanation_source);
```

### Table: `pyq_papers`

- **Current Row Count:** 0
- **Columns:** 12

```sql
CREATE TABLE "pyq_papers" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exams(id),
  subject_id INTEGER REFERENCES subjects(id),
  year INTEGER NOT NULL,
  shift TEXT,
  title TEXT NOT NULL,
  source_url TEXT,
  rights_note TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published'))
, created_at TEXT, updated_at TEXT, deleted_at TEXT)
```

**Indexes:**

```sql
CREATE INDEX idx_pyq_year ON "pyq_papers"(year, subject_id, status);
CREATE INDEX idx_pyq_published ON "pyq_papers"(status, year);
```

### Table: `question_public_ids`

- **Current Row Count:** 123
- **Columns:** 7

```sql
CREATE TABLE "question_public_ids" (
  public_id TEXT PRIMARY KEY,
  current_question_id INTEGER NOT NULL REFERENCES questions(id),
  share_enabled INTEGER NOT NULL DEFAULT 1,
  reveal_policy TEXT NOT NULL DEFAULT 'attempted_only'
    CHECK (reveal_policy IN ('attempted_only','public')),
  seo_indexable INTEGER NOT NULL DEFAULT 0,
  rights_ok INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

**Indexes:**

```sql
CREATE UNIQUE INDEX uq_qpid_current
  ON "question_public_ids"(current_question_id);
```

### Table: `question_reports`

- **Current Row Count:** 0
- **Columns:** 6

```sql
CREATE TABLE "question_reports" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES questions(id),
  user_id INTEGER REFERENCES users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)
```

**Indexes:**

```sql
CREATE INDEX idx_question_reports_status
  ON "question_reports"(status, created_at DESC);
```

### Table: `questions`

- **Current Row Count:** 12,372
- **Columns:** 28

```sql
CREATE TABLE "questions" (
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
, assets_json TEXT NOT NULL DEFAULT '[]', explanation_source TEXT NOT NULL DEFAULT 'none'
  CHECK (explanation_source IN ('official', 'human', 'ai_draft', 'banner', 'none')), explanation_status TEXT NOT NULL DEFAULT 'unreviewed'
  CHECK (explanation_status IN ('unreviewed', 'reviewed', 'flagged')), reviewed_by TEXT, reviewed_at TEXT)
```

**Indexes:**

```sql
CREATE INDEX idx_questions_subject ON "questions"(subject_id, status);
CREATE INDEX idx_questions_topic ON "questions"(topic_id);
CREATE INDEX idx_questions_topic_status
  ON "questions"(topic_id, status, deleted_at);
CREATE INDEX idx_questions_year_status
  ON "questions"(year, status, subject_id);
CREATE INDEX idx_questions_updated
  ON "questions"(updated_at DESC);
CREATE INDEX idx_questions_created_by
  ON "questions"(created_by, deleted_at);
CREATE INDEX idx_questions_status_deleted ON questions(status, deleted_at, subject_id);
CREATE INDEX idx_questions_review ON questions(explanation_status, explanation_source);
```

### Table: `rescore_jobs`

- **Current Row Count:** 0
- **Columns:** 10

```sql
CREATE TABLE "rescore_jobs" (
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
)
```

**Indexes:**

```sql
CREATE INDEX idx_rescore_jobs_status
  ON "rescore_jobs"(status, created_at DESC);
```

### Table: `revisions`

- **Current Row Count:** 230
- **Columns:** 7

```sql
CREATE TABLE "revisions" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  reason TEXT,
  admin_id INTEGER REFERENCES admins(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)
```

**Indexes:**

```sql
CREATE INDEX idx_revisions_entity
  ON "revisions"(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_revisions_admin
  ON "revisions"(admin_id, created_at DESC);
```

### Table: `sessions`

- **Current Row Count:** 685
- **Columns:** 4

```sql
CREATE TABLE "sessions" (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)
```

**Indexes:**

```sql
CREATE INDEX idx_sessions_user ON "sessions"(user_id);
```

### Table: `share_events`

- **Current Row Count:** 0
- **Columns:** 7

```sql
CREATE TABLE "share_events" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT,                     -- null when sharing a mock link
  mock_id INTEGER,
  user_id INTEGER,
  context TEXT NOT NULL CHECK (context IN ('attempt','solutions','practice','public_page')),
  channel TEXT NOT NULL,              -- 'native','whatsapp','telegram','copy','download'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

**Indexes:**

```sql
CREATE INDEX idx_share_events_pid
  ON "share_events"(public_id, created_at);
```

### Table: `site_settings`

- **Current Row Count:** 5
- **Columns:** 2

```sql
CREATE TABLE "site_settings" (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)
```

### Table: `slug_redirects`

- **Current Row Count:** 0
- **Columns:** 4

```sql
CREATE TABLE "slug_redirects" (
  old_slug TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)
```

**Indexes:**

```sql
CREATE INDEX idx_slug_redirects_entity
  ON "slug_redirects"(entity_type, entity_id);
```

### Table: `subjects`

- **Current Row Count:** 19
- **Columns:** 8

```sql
CREATE TABLE "subjects" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exams(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('language', 'domain', 'general')),
  is_active INTEGER NOT NULL DEFAULT 1
, deleted_at TEXT, code TEXT)
```

**Indexes:**

```sql
CREATE INDEX idx_subjects_deleted ON "subjects"(deleted_at);
```

### Table: `topics`

- **Current Row Count:** 0
- **Columns:** 5

```sql
CREATE TABLE "topics" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL, deleted_at TEXT,
  UNIQUE (subject_id, slug)
)
```

**Indexes:**

```sql
CREATE INDEX idx_topics_deleted ON "topics"(deleted_at);
```

### Table: `user_badges`

- **Current Row Count:** 50
- **Columns:** 3

```sql
CREATE TABLE "user_badges" (
  user_id INTEGER NOT NULL REFERENCES users(id),
  badge_id INTEGER NOT NULL REFERENCES badges(id),
  awarded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, badge_id)
)
```

### Table: `user_stats`

- **Current Row Count:** 51
- **Columns:** 6

```sql
CREATE TABLE "user_stats" (
  user_id INTEGER NOT NULL REFERENCES users(id),
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  topic_id INTEGER NOT NULL DEFAULT 0,
  attempted INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  avg_time_sec REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, subject_id, topic_id)
)
```

### Table: `users`

- **Current Row Count:** 159
- **Columns:** 17

```sql
CREATE TABLE "users" (
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
, banned_at TEXT, updated_at TEXT)
```

**Indexes:**

```sql
CREATE INDEX idx_users_banned ON "users"(banned_at);
CREATE INDEX idx_users_created
  ON "users"(created_at DESC);
```
