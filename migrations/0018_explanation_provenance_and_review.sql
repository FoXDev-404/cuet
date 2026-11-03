-- Migration: 0018_explanation_provenance_and_review.sql
-- Adds provenance source and editorial review workflow fields to practice and mock questions.

ALTER TABLE practice_questions ADD COLUMN explanation_source TEXT NOT NULL DEFAULT 'none'
  CHECK (explanation_source IN ('official', 'human', 'ai_draft', 'banner', 'none'));
ALTER TABLE practice_questions ADD COLUMN explanation_status TEXT NOT NULL DEFAULT 'unreviewed'
  CHECK (explanation_status IN ('unreviewed', 'reviewed', 'flagged'));
ALTER TABLE practice_questions ADD COLUMN reviewed_by TEXT;
ALTER TABLE practice_questions ADD COLUMN reviewed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_practice_questions_review ON practice_questions(explanation_status, explanation_source);

ALTER TABLE questions ADD COLUMN explanation_source TEXT NOT NULL DEFAULT 'none'
  CHECK (explanation_source IN ('official', 'human', 'ai_draft', 'banner', 'none'));
ALTER TABLE questions ADD COLUMN explanation_status TEXT NOT NULL DEFAULT 'unreviewed'
  CHECK (explanation_status IN ('unreviewed', 'reviewed', 'flagged'));
ALTER TABLE questions ADD COLUMN reviewed_by TEXT;
ALTER TABLE questions ADD COLUMN reviewed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_questions_review ON questions(explanation_status, explanation_source);

