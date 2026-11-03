PRAGMA foreign_keys = ON;

-- ============================================================================
-- Blueprint v2: split mock identity from immutable published versions, add
-- PYQ provenance, and pin every attempt to the version it was served.
--
-- Compatibility note: mock_tests keeps its legacy duration/marks/marking/
-- instructions/published_at columns as a denormalised projection of the
-- current version. The trigger at the bottom keeps them in sync so older read
-- queries and exports remain valid. All attempt scoring reads the pinned
-- version row, never these cached columns.
-- ============================================================================

CREATE TABLE pyq_papers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exams(id),
  subject_id INTEGER REFERENCES subjects(id),
  year INTEGER NOT NULL,
  shift TEXT,
  title TEXT NOT NULL,
  source_url TEXT,
  rights_note TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published'))
);

CREATE TABLE mock_test_versions (
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
);

ALTER TABLE mock_tests ADD COLUMN pyq_paper_id INTEGER REFERENCES pyq_papers(id);
ALTER TABLE mock_tests ADD COLUMN current_version_id INTEGER REFERENCES mock_test_versions(id);

-- Backfill PYQ provenance rows from the legacy pyq_year/pyq_shift columns.
INSERT INTO pyq_papers (exam_id, subject_id, year, shift, title, status)
SELECT exam_id, subject_id, pyq_year, NULLIF(pyq_shift, ''), title,
       CASE WHEN status = 'published' THEN 'published' ELSE 'draft' END
FROM mock_tests
WHERE type = 'pyq' AND pyq_year IS NOT NULL;

UPDATE mock_tests
SET pyq_paper_id = (
  SELECT p.id FROM pyq_papers p
  WHERE p.exam_id = mock_tests.exam_id
    AND p.year = mock_tests.pyq_year
    AND COALESCE(p.subject_id, 0) = COALESCE(mock_tests.subject_id, 0)
    AND COALESCE(p.shift, '') = COALESCE(NULLIF(mock_tests.pyq_shift, ''), '')
    AND p.title = mock_tests.title
  ORDER BY p.id LIMIT 1
)
WHERE type = 'pyq' AND pyq_year IS NOT NULL;

-- Every existing mock becomes a version row with its current content.
INSERT INTO mock_test_versions
  (mock_id, version_no, duration_min, total_marks, marking_scheme, instructions,
   status, published_at, created_by, created_at)
SELECT id, MAX(version, 1), duration_min, total_marks, marking_scheme, instructions,
       CASE status
         WHEN 'published' THEN 'published'
         WHEN 'in_review' THEN 'in_review'
         WHEN 'archived' THEN 'superseded'
         ELSE 'draft'
       END,
       published_at, created_by, created_at
FROM mock_tests;

UPDATE mock_tests
SET current_version_id = (
  SELECT v.id FROM mock_test_versions v
  WHERE v.mock_id = mock_tests.id
  ORDER BY v.version_no DESC LIMIT 1
);

-- ===== mock_questions now belongs to a version =====
ALTER TABLE mock_questions RENAME TO mock_questions_legacy;

CREATE TABLE mock_questions (
  version_id INTEGER NOT NULL REFERENCES mock_test_versions(id),
  question_id INTEGER NOT NULL REFERENCES questions(id),
  section TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (version_id, question_id)
);

INSERT INTO mock_questions (version_id, question_id, section, position)
SELECT v.id, mq.question_id, mq.section, mq.position
FROM mock_questions_legacy mq
JOIN mock_tests m ON m.id = mq.mock_id
JOIN mock_test_versions v ON v.mock_id = m.id AND v.version_no = MAX(m.version, 1);

DROP TABLE mock_questions_legacy;

-- ===== Attempts pin the version they were served =====
ALTER TABLE attempts RENAME TO attempts_legacy;
ALTER TABLE attempt_answers RENAME TO attempt_answers_legacy;

CREATE TABLE attempts (
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
  is_first_attempt INTEGER NOT NULL DEFAULT 0,
  CHECK (user_id IS NOT NULL OR guest_token IS NOT NULL)
);

CREATE TABLE attempt_answers (
  attempt_id INTEGER NOT NULL REFERENCES attempts(id),
  question_id INTEGER NOT NULL REFERENCES questions(id),
  selected INTEGER,
  time_spent_sec INTEGER NOT NULL DEFAULT 0,
  marked_for_review INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT,
  is_correct INTEGER,
  PRIMARY KEY (attempt_id, question_id)
);

INSERT INTO attempts
  (id, user_id, guest_token, mock_id, version_id, status, score, correct, wrong,
   skipped, time_taken_sec, started_at, deadline_at, submitted_at, is_first_attempt)
SELECT a.id, a.user_id, a.guest_token, a.mock_id,
       (SELECT v.id FROM mock_test_versions v WHERE v.mock_id = a.mock_id
        ORDER BY v.version_no ASC LIMIT 1),
       a.status, a.score, a.correct, a.wrong, a.skipped, a.time_taken_sec,
       a.started_at, a.deadline_at, a.submitted_at, a.is_first_attempt
FROM attempts_legacy a;

INSERT INTO attempt_answers
  (attempt_id, question_id, selected, time_spent_sec, marked_for_review, updated_at, is_correct)
SELECT attempt_id, question_id, selected, time_spent_sec, marked_for_review, NULL, is_correct
FROM attempt_answers_legacy;

DROP TABLE attempt_answers_legacy;
DROP TABLE attempts_legacy;

-- Convenience view for public reads that work with the latest version.
CREATE VIEW mock_questions_current AS
SELECT m.id AS mock_id, mq.version_id, mq.question_id, mq.section, mq.position
FROM mock_tests m
JOIN mock_questions mq ON mq.version_id = m.current_version_id;

-- Keep the legacy projection in sync whenever a version is published.
CREATE TRIGGER trg_mock_current_sync
AFTER UPDATE OF current_version_id ON mock_tests
WHEN NEW.current_version_id IS NOT NULL
BEGIN
  UPDATE mock_tests SET
    duration_min = COALESCE((SELECT duration_min FROM mock_test_versions WHERE id = NEW.current_version_id), duration_min),
    total_marks = COALESCE((SELECT total_marks FROM mock_test_versions WHERE id = NEW.current_version_id), total_marks),
    marking_scheme = COALESCE((SELECT marking_scheme FROM mock_test_versions WHERE id = NEW.current_version_id), marking_scheme),
    instructions = (SELECT instructions FROM mock_test_versions WHERE id = NEW.current_version_id),
    published_at = (SELECT published_at FROM mock_test_versions WHERE id = NEW.current_version_id)
  WHERE id = NEW.id;
END;

-- ===== Indexes =====
DROP INDEX IF EXISTS idx_mq_mock;
DROP INDEX IF EXISTS idx_attempts_leaderboard;
DROP INDEX IF EXISTS idx_attempts_user;
DROP INDEX IF EXISTS idx_attempts_guest;
DROP INDEX IF EXISTS uq_first_attempt;

CREATE INDEX idx_versions_mock ON mock_test_versions(mock_id, status);
CREATE INDEX idx_mq_version ON mock_questions(version_id, section, position);
CREATE INDEX idx_attempts_leaderboard ON attempts(version_id, score DESC, time_taken_sec ASC);
CREATE INDEX idx_attempts_mock ON attempts(mock_id, status);
CREATE INDEX idx_attempts_user ON attempts(user_id);
CREATE INDEX idx_attempts_guest ON attempts(guest_token);
CREATE UNIQUE INDEX uq_first_attempt ON attempts(user_id, mock_id) WHERE is_first_attempt = 1;
CREATE INDEX idx_pyq_year ON pyq_papers(year, subject_id, status);
