# Appendix B: Database Schema and Data Integrity

> DDL extracted from `sqlite_master` in Cloudflare D1 local SQLite. Verified across all 39 user and operational tables.

## 1. Schema Overview & Table Catalogue

| Table Name | Purpose / Domain | Row Count | Primary Key | Soft Delete | Indexes |
|---|---|---|---|---|---|
| `admins` | Authentication, RBAC & user accounts | **2** | `id` | Yes (`deleted_at`) | 2 |
| `announcements` | Core system entity | **0** | `id` | Yes (`deleted_at`) | 0 |
| `attempt_answers` | Student test attempts & answer audit | **3,917** | `attempt_id, question_id` | No | 2 |
| `attempts` | Student test attempts & answer audit | **262** | `id` | No | 11 |
| `audit_log` | Admin audit trail & question versioning | **517** | `id` | No | 2 |
| `badges` | Gamification & user achievements | **4** | `id` | Yes (`deleted_at`) | 1 |
| `blog_posts` | Informational content & syllabus | **0** | `id` | Yes (`deleted_at`) | 3 |
| `bookmarks` | Core system entity | **0** | `user_id, question_id` | No | 1 |
| `discussion_reports` | Community Q&A and question discussions | **0** | `id` | No | 2 |
| `discussion_votes` | Community Q&A and question discussions | **0** | `discussion_id, user_id` | No | 1 |
| `discussions` | Community Q&A and question discussions | **8** | `id` | Yes (`deleted_at`) | 4 |
| `email_verifications` | Authentication, RBAC & user accounts | **0** | `id` | No | 1 |
| `exam_info` | Informational content & syllabus | **0** | `key` | No | 1 |
| `exams` | Informational content & syllabus | **1** | `id` | Yes (`deleted_at`) | 2 |
| `media_assets` | Core system entity | **0** | `id` | Yes (`deleted_at`) | 4 |
| `mock_questions` | Mock examination engine & question bank | **11,552** | `version_id, question_id` | No | 3 |
| `mock_test_versions` | Mock examination engine & question bank | **443** | `id` | No | 2 |
| `mock_tests` | Mock examination engine & question bank | **337** | `id` | Yes (`deleted_at`) | 5 |
| `page_seo` | Core system entity | **0** | `path` | No | 1 |
| `passages` | Core system entity | **234** | `id` | Yes (`deleted_at`) | 0 |
| `password_resets` | Authentication, RBAC & user accounts | **0** | `id` | No | 1 |
| `practice_papers` | Previous-year paper practice library | **214** | `id` | Yes (`deleted_at`) | 3 |
| `practice_passages` | Previous-year paper practice library | **128** | `id` | Yes (`deleted_at`) | 3 |
| `practice_questions` | Previous-year paper practice library | **6,603** | `id` | Yes (`deleted_at`) | 2 |
| `pyq_papers` | Core system entity | **0** | `id` | Yes (`deleted_at`) | 2 |
| `question_public_ids` | Viral question sharing & public views | **76** | `public_id` | No | 2 |
| `question_reports` | Core system entity | **0** | `id` | No | 1 |
| `questions` | Core system entity | **12,009** | `id` | Yes (`deleted_at`) | 7 |
| `rescore_jobs` | Core system entity | **0** | `id` | No | 1 |
| `revisions` | Admin audit trail & question versioning | **143** | `id` | No | 2 |
| `sessions` | Authentication, RBAC & user accounts | **474** | `id` | No | 2 |
| `share_events` | Viral question sharing & public views | **0** | `id` | No | 1 |
| `site_settings` | Core system entity | **3** | `key` | No | 1 |
| `slug_redirects` | Core system entity | **0** | `old_slug` | No | 2 |
| `subjects` | Core system entity | **19** | `id` | Yes (`deleted_at`) | 2 |
| `topics` | Core system entity | **0** | `id` | Yes (`deleted_at`) | 2 |
| `user_badges` | Authentication, RBAC & user accounts | **37** | `user_id, badge_id` | No | 1 |
| `user_stats` | Authentication, RBAC & user accounts | **38** | `user_id, subject_id, topic_id` | No | 1 |
| `users` | Authentication, RBAC & user accounts | **115** | `id` | Yes (`deleted_at`) | 5 |

## 2. Data Integrity Checks

| Integrity Check | Metric / Expected | Actual Measured | Status |
|---|---|---|---|
| Orphan Practice Questions (`practice_questions` without paper) | 0 | **0** | ✅ PASS |
| Orphan Mock Questions (`mock_questions` without version/question) | 0 | **0** | ✅ PASS |
| Orphan Mock Versions (`mock_test_versions` without mock test) | 0 | **0** | ✅ PASS |
| Duplicate Practice Paper Slugs (`practice_papers.slug`) | 0 | **0** | ✅ PASS |
| Duplicate Mock Test Slugs (`mock_tests.slug`) | 0 | **0** | ✅ PASS |
| Empty Mock Tests (Mock tests with 0 questions in version) | 0 | **0** | ✅ PASS |
| Unkeyed Practice Questions (`correct_option` is NULL) | Pending reviews only | **332** / 6,603 (95.0% keyed) | ℹ️ Monitored |
| Questions Missing Explanation (`practice_questions.explanation`) | 0 | **0** / 6,603 (100.0% explained) | ✅ PASS |

## 3. Migration History

Total migration files in `migrations/`: **15**

- `0001_init.sql`
- `0002_mock_versions.sql`
- `0002_seed.sql`
- `0003_content_and_ops.sql`
- `0004_immutability_guards.sql`
- `0005_seo_canonical.sql`
- `0006_schema_parity.sql`
- `0007_query_budget_indexes.sql`
- `0008_archive_placeholder_mock.sql`
- `0009_admin_full_control.sql`
- `0010_practice_library.sql`
- `0011_practice_passage_trash.sql`
- `0012_question_share.sql`
- `0013_question_share_indexes.sql`
- `0015_ranked_practice_library.sql`

## 4. Detailed Table Definitions (DDL)

### Table `admins` (2 rows)
**Domain:** Authentication, RBAC & user accounts | **Primary Key:** `id` | **Soft Delete:** Yes (`deleted_at`)

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
- `idx_admins_deleted` (unique: False)
- `sqlite_autoindex_admins_1` (unique: True)

### Table `announcements` (0 rows)
**Domain:** Core system entity | **Primary Key:** `id` | **Soft Delete:** Yes (`deleted_at`)

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

### Table `attempt_answers` (3,917 rows)
**Domain:** Student test attempts & answer audit | **Primary Key:** `attempt_id, question_id` | **Soft Delete:** No

```sql
CREATE TABLE "attempt_answers" (
  attempt_id INTEGER NOT NULL REFERENCES attempts(id),
  question_id INTEGER NOT NULL REFERENCES questions(id),
  selected INTEGER,
  time_spent_sec INTEGER NOT NULL DEFAULT 0,
  marked_for_review INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT,
  is_correct INTEGER,
  PRIMARY KEY (attempt_id, question_id)
)
```

**Indexes:**
- `idx_attempt_answers_question` (unique: False)
- `sqlite_autoindex_attempt_answers_1` (unique: True)

### Table `attempts` (262 rows)
**Domain:** Student test attempts & answer audit | **Primary Key:** `id` | **Soft Delete:** No

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
  is_first_attempt INTEGER NOT NULL DEFAULT 0, disqualified_at TEXT, disqualified_by INTEGER REFERENCES admins(id), voided_at TEXT, void_reason TEXT, voided_by INTEGER REFERENCES admins(id),
  CHECK (user_id IS NOT NULL OR guest_token IS NOT NULL)
)
```

**Indexes:**
- `idx_attempts_status_submitted` (unique: False)
- `idx_attempts_voided` (unique: False)
- `idx_attempts_started` (unique: False)
- `idx_attempts_user_mock_status` (unique: False)
- `idx_attempts_user_finished` (unique: False)
- `idx_attempts_disqualified` (unique: False)
- `uq_first_attempt` (unique: True)
- `idx_attempts_guest` (unique: False)
- `idx_attempts_user` (unique: False)
- `idx_attempts_mock` (unique: False)
- `idx_attempts_leaderboard` (unique: False)

### Table `audit_log` (517 rows)
**Domain:** Admin audit trail & question versioning | **Primary Key:** `id` | **Soft Delete:** No

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
- `idx_audit_entity` (unique: False)
- `idx_audit_admin_created` (unique: False)

### Table `badges` (4 rows)
**Domain:** Gamification & user achievements | **Primary Key:** `id` | **Soft Delete:** Yes (`deleted_at`)

```sql
CREATE TABLE "badges" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT
, deleted_at TEXT)
```

**Indexes:**
- `sqlite_autoindex_badges_1` (unique: True)

### Table `blog_posts` (0 rows)
**Domain:** Informational content & syllabus | **Primary Key:** `id` | **Soft Delete:** Yes (`deleted_at`)

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
- `idx_blog_deleted` (unique: False)
- `idx_blog_posts_status` (unique: False)
- `sqlite_autoindex_blog_posts_1` (unique: True)

### Table `bookmarks` (0 rows)
**Domain:** Core system entity | **Primary Key:** `user_id, question_id` | **Soft Delete:** No

```sql
CREATE TABLE "bookmarks" (
  user_id INTEGER NOT NULL REFERENCES users(id),
  question_id INTEGER NOT NULL REFERENCES questions(id),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, question_id)
)
```

**Indexes:**
- `sqlite_autoindex_bookmarks_1` (unique: True)

### Table `discussion_reports` (0 rows)
**Domain:** Community Q&A and question discussions | **Primary Key:** `id` | **Soft Delete:** No

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
- `idx_discussion_reports_open` (unique: False)
- `sqlite_autoindex_discussion_reports_1` (unique: True)

### Table `discussion_votes` (0 rows)
**Domain:** Community Q&A and question discussions | **Primary Key:** `discussion_id, user_id` | **Soft Delete:** No

```sql
CREATE TABLE "discussion_votes" (
  discussion_id INTEGER NOT NULL REFERENCES discussions(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  PRIMARY KEY (discussion_id, user_id)
)
```

**Indexes:**
- `sqlite_autoindex_discussion_votes_1` (unique: True)

### Table `discussions` (8 rows)
**Domain:** Community Q&A and question discussions | **Primary Key:** `id` | **Soft Delete:** Yes (`deleted_at`)

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
- `idx_discussions_deleted` (unique: False)
- `idx_disc_top` (unique: False)
- `idx_disc_question` (unique: False)
- `idx_disc_mock` (unique: False)

### Table `email_verifications` (0 rows)
**Domain:** Authentication, RBAC & user accounts | **Primary Key:** `id` | **Soft Delete:** No

```sql
CREATE TABLE "email_verifications" (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)
```

**Indexes:**
- `sqlite_autoindex_email_verifications_1` (unique: True)

### Table `exam_info` (0 rows)
**Domain:** Informational content & syllabus | **Primary Key:** `key` | **Soft Delete:** No

```sql
CREATE TABLE "exam_info" (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  source_url TEXT,
  last_verified TEXT
)
```

**Indexes:**
- `sqlite_autoindex_exam_info_1` (unique: True)

### Table `exams` (1 rows)
**Domain:** Informational content & syllabus | **Primary Key:** `id` | **Soft Delete:** Yes (`deleted_at`)

```sql
CREATE TABLE "exams" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1
, deleted_at TEXT)
```

**Indexes:**
- `idx_exams_deleted` (unique: False)
- `sqlite_autoindex_exams_1` (unique: True)

### Table `media_assets` (0 rows)
**Domain:** Core system entity | **Primary Key:** `id` | **Soft Delete:** Yes (`deleted_at`)

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
- `idx_media_deleted` (unique: False)
- `idx_media_assets_created` (unique: False)
- `sqlite_autoindex_media_assets_2` (unique: True)
- `sqlite_autoindex_media_assets_1` (unique: True)

### Table `mock_questions` (11,552 rows)
**Domain:** Mock examination engine & question bank | **Primary Key:** `version_id, question_id` | **Soft Delete:** No

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
- `idx_mq_question` (unique: False)
- `idx_mq_version` (unique: False)
- `sqlite_autoindex_mock_questions_1` (unique: True)

### Table `mock_test_versions` (443 rows)
**Domain:** Mock examination engine & question bank | **Primary Key:** `id` | **Soft Delete:** No

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
- `idx_versions_mock` (unique: False)
- `sqlite_autoindex_mock_test_versions_1` (unique: True)

### Table `mock_tests` (337 rows)
**Domain:** Mock examination engine & question bank | **Primary Key:** `id` | **Soft Delete:** Yes (`deleted_at`)

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
- `idx_mock_tests_practice_paper` (unique: False)
- `idx_mocks_updated` (unique: False)
- `idx_mocks_status_published` (unique: False)
- `idx_mocks_status` (unique: False)
- `sqlite_autoindex_mock_tests_1` (unique: True)

### Table `page_seo` (0 rows)
**Domain:** Core system entity | **Primary Key:** `path` | **Soft Delete:** No

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

**Indexes:**
- `sqlite_autoindex_page_seo_1` (unique: True)

### Table `passages` (234 rows)
**Domain:** Core system entity | **Primary Key:** `id` | **Soft Delete:** Yes (`deleted_at`)

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

### Table `password_resets` (0 rows)
**Domain:** Authentication, RBAC & user accounts | **Primary Key:** `id` | **Soft Delete:** No

```sql
CREATE TABLE "password_resets" (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)
```

**Indexes:**
- `sqlite_autoindex_password_resets_1` (unique: True)

### Table `practice_papers` (214 rows)
**Domain:** Previous-year paper practice library | **Primary Key:** `id` | **Soft Delete:** Yes (`deleted_at`)

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
)
```

**Indexes:**
- `idx_practice_papers_year` (unique: False)
- `idx_practice_papers_subject` (unique: False)
- `sqlite_autoindex_practice_papers_1` (unique: True)

### Table `practice_passages` (128 rows)
**Domain:** Previous-year paper practice library | **Primary Key:** `id` | **Soft Delete:** Yes (`deleted_at`)

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
- `idx_practice_passages_deleted` (unique: False)
- `idx_practice_passages_paper` (unique: False)
- `sqlite_autoindex_practice_passages_1` (unique: True)

### Table `practice_questions` (6,603 rows)
**Domain:** Previous-year paper practice library | **Primary Key:** `id` | **Soft Delete:** Yes (`deleted_at`)

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
  deleted_at TEXT,
  UNIQUE (paper_slug, question_key)
)
```

**Indexes:**
- `idx_practice_questions_paper` (unique: False)
- `sqlite_autoindex_practice_questions_1` (unique: True)

### Table `pyq_papers` (0 rows)
**Domain:** Core system entity | **Primary Key:** `id` | **Soft Delete:** Yes (`deleted_at`)

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
- `idx_pyq_published` (unique: False)
- `idx_pyq_year` (unique: False)

### Table `question_public_ids` (76 rows)
**Domain:** Viral question sharing & public views | **Primary Key:** `public_id` | **Soft Delete:** No

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
- `uq_qpid_current` (unique: True)
- `sqlite_autoindex_question_public_ids_1` (unique: True)

### Table `question_reports` (0 rows)
**Domain:** Core system entity | **Primary Key:** `id` | **Soft Delete:** No

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
- `idx_question_reports_status` (unique: False)

### Table `questions` (12,009 rows)
**Domain:** Core system entity | **Primary Key:** `id` | **Soft Delete:** Yes (`deleted_at`)

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
, assets_json TEXT NOT NULL DEFAULT '[]')
```

**Indexes:**
- `idx_questions_created_by` (unique: False)
- `idx_questions_updated` (unique: False)
- `idx_questions_year_status` (unique: False)
- `idx_questions_topic_status` (unique: False)
- `idx_questions_topic` (unique: False)
- `idx_questions_subject` (unique: False)

### Table `rescore_jobs` (0 rows)
**Domain:** Core system entity | **Primary Key:** `id` | **Soft Delete:** No

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
- `idx_rescore_jobs_status` (unique: False)

### Table `revisions` (143 rows)
**Domain:** Admin audit trail & question versioning | **Primary Key:** `id` | **Soft Delete:** No

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
- `idx_revisions_admin` (unique: False)
- `idx_revisions_entity` (unique: False)

### Table `sessions` (474 rows)
**Domain:** Authentication, RBAC & user accounts | **Primary Key:** `id` | **Soft Delete:** No

```sql
CREATE TABLE "sessions" (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)
```

**Indexes:**
- `idx_sessions_user` (unique: False)
- `sqlite_autoindex_sessions_1` (unique: True)

### Table `share_events` (0 rows)
**Domain:** Viral question sharing & public views | **Primary Key:** `id` | **Soft Delete:** No

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
- `idx_share_events_pid` (unique: False)

### Table `site_settings` (3 rows)
**Domain:** Core system entity | **Primary Key:** `key` | **Soft Delete:** No

```sql
CREATE TABLE "site_settings" (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)
```

**Indexes:**
- `sqlite_autoindex_site_settings_1` (unique: True)

### Table `slug_redirects` (0 rows)
**Domain:** Core system entity | **Primary Key:** `old_slug` | **Soft Delete:** No

```sql
CREATE TABLE "slug_redirects" (
  old_slug TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)
```

**Indexes:**
- `idx_slug_redirects_entity` (unique: False)
- `sqlite_autoindex_slug_redirects_1` (unique: True)

### Table `subjects` (19 rows)
**Domain:** Core system entity | **Primary Key:** `id` | **Soft Delete:** Yes (`deleted_at`)

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
- `idx_subjects_deleted` (unique: False)
- `sqlite_autoindex_subjects_1` (unique: True)

### Table `topics` (0 rows)
**Domain:** Core system entity | **Primary Key:** `id` | **Soft Delete:** Yes (`deleted_at`)

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
- `idx_topics_deleted` (unique: False)
- `sqlite_autoindex_topics_1` (unique: True)

### Table `user_badges` (37 rows)
**Domain:** Authentication, RBAC & user accounts | **Primary Key:** `user_id, badge_id` | **Soft Delete:** No

```sql
CREATE TABLE "user_badges" (
  user_id INTEGER NOT NULL REFERENCES users(id),
  badge_id INTEGER NOT NULL REFERENCES badges(id),
  awarded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, badge_id)
)
```

**Indexes:**
- `sqlite_autoindex_user_badges_1` (unique: True)

### Table `user_stats` (38 rows)
**Domain:** Authentication, RBAC & user accounts | **Primary Key:** `user_id, subject_id, topic_id` | **Soft Delete:** No

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

**Indexes:**
- `sqlite_autoindex_user_stats_1` (unique: True)

### Table `users` (115 rows)
**Domain:** Authentication, RBAC & user accounts | **Primary Key:** `id` | **Soft Delete:** Yes (`deleted_at`)

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
- `idx_users_created` (unique: False)
- `idx_users_banned` (unique: False)
- `sqlite_autoindex_users_3` (unique: True)
- `sqlite_autoindex_users_2` (unique: True)
- `sqlite_autoindex_users_1` (unique: True)
