PRAGMA foreign_keys = ON;

-- ============================================================================
-- Database-level guardrails for the published-version contract.
--
-- Application code already refuses to edit published versions, but attempts
-- pin (mock_id, version_id). A direct SQL edit or a future bug must never be
-- able to rewrite the paper that an attempt was served. These triggers keep
-- the invariant in D1 itself:
--   * published/superseded version metadata cannot be edited or deleted;
--   * the only permitted change to a published version is its transition to
--     superseded when a newer version is published;
--   * question membership for published/superseded versions is frozen;
--   * published question content cannot be rewritten in place (the admin
--     workflow creates a superseding question row instead);
--   * passages attached to a frozen paper cannot be rewritten in place.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_published_version_immutable;
CREATE TRIGGER trg_published_version_immutable
BEFORE UPDATE ON mock_test_versions
FOR EACH ROW
WHEN OLD.status IN ('published', 'superseded')
  AND (
    NEW.mock_id IS NOT OLD.mock_id
    OR NEW.version_no IS NOT OLD.version_no
    OR NEW.duration_min IS NOT OLD.duration_min
    OR NEW.total_marks IS NOT OLD.total_marks
    OR NEW.marking_scheme IS NOT OLD.marking_scheme
    OR NEW.instructions IS NOT OLD.instructions
    OR NEW.published_at IS NOT OLD.published_at
    OR NEW.created_by IS NOT OLD.created_by
    OR NEW.created_at IS NOT OLD.created_at
    OR (OLD.status = 'published' AND NEW.status NOT IN ('published', 'superseded'))
    OR (OLD.status = 'superseded' AND NEW.status IS NOT OLD.status)
  )
BEGIN
  SELECT RAISE(ABORT, 'Published mock versions are immutable; create a new version.');
END;

DROP TRIGGER IF EXISTS trg_published_version_no_delete;
CREATE TRIGGER trg_published_version_no_delete
BEFORE DELETE ON mock_test_versions
FOR EACH ROW
WHEN OLD.status IN ('published', 'superseded')
BEGIN
  SELECT RAISE(ABORT, 'Published mock versions cannot be deleted.');
END;

DROP TRIGGER IF EXISTS trg_frozen_version_question_insert;
CREATE TRIGGER trg_frozen_version_question_insert
BEFORE INSERT ON mock_questions
FOR EACH ROW
WHEN (
  SELECT status FROM mock_test_versions WHERE id = NEW.version_id
) IN ('published', 'superseded')
BEGIN
  SELECT RAISE(ABORT, 'Question membership is frozen after a version is published.');
END;

DROP TRIGGER IF EXISTS trg_frozen_version_question_update;
CREATE TRIGGER trg_frozen_version_question_update
BEFORE UPDATE ON mock_questions
FOR EACH ROW
WHEN (
  SELECT status FROM mock_test_versions WHERE id = OLD.version_id
) IN ('published', 'superseded')
BEGIN
  SELECT RAISE(ABORT, 'Question membership is frozen after a version is published.');
END;

DROP TRIGGER IF EXISTS trg_frozen_version_question_delete;
CREATE TRIGGER trg_frozen_version_question_delete
BEFORE DELETE ON mock_questions
FOR EACH ROW
WHEN (
  SELECT status FROM mock_test_versions WHERE id = OLD.version_id
) IN ('published', 'superseded')
BEGIN
  SELECT RAISE(ABORT, 'Question membership is frozen after a version is published.');
END;

-- A published question may still be soft-deleted (deleted_at changes), but its
-- visible content and answer key cannot change. Corrections must insert a new
-- question row with supersedes_id pointing at the old one.
DROP TRIGGER IF EXISTS trg_published_question_immutable;
CREATE TRIGGER trg_published_question_immutable
BEFORE UPDATE ON questions
FOR EACH ROW
WHEN OLD.status = 'published'
  AND (
    NEW.subject_id IS NOT OLD.subject_id
    OR NEW.topic_id IS NOT OLD.topic_id
    OR NEW.passage_id IS NOT OLD.passage_id
    OR NEW.text IS NOT OLD.text
    OR NEW.text_hi IS NOT OLD.text_hi
    OR NEW.options IS NOT OLD.options
    OR NEW.options_hi IS NOT OLD.options_hi
    OR NEW.correct_option IS NOT OLD.correct_option
    OR NEW.explanation IS NOT OLD.explanation
    OR NEW.explanation_hi IS NOT OLD.explanation_hi
    OR NEW.difficulty IS NOT OLD.difficulty
    OR NEW.year IS NOT OLD.year
    OR NEW.image_url IS NOT OLD.image_url
    OR NEW.image_alt IS NOT OLD.image_alt
    OR NEW.explanation_image_url IS NOT OLD.explanation_image_url
    OR NEW.explanation_image_alt IS NOT OLD.explanation_image_alt
    OR NEW.status IS NOT OLD.status
    OR NEW.supersedes_id IS NOT OLD.supersedes_id
  )
BEGIN
  SELECT RAISE(ABORT, 'Published question content is immutable; create a superseding question.');
END;

DROP TRIGGER IF EXISTS trg_published_question_no_delete;
CREATE TRIGGER trg_published_question_no_delete
BEFORE DELETE ON questions
FOR EACH ROW
WHEN OLD.status = 'published'
BEGIN
  SELECT RAISE(ABORT, 'Published question rows cannot be hard-deleted.');
END;

DROP TRIGGER IF EXISTS trg_frozen_passage_immutable;
CREATE TRIGGER trg_frozen_passage_immutable
BEFORE UPDATE ON passages
FOR EACH ROW
WHEN EXISTS (
  SELECT 1
  FROM questions q
  JOIN mock_questions mq ON mq.question_id = q.id
  JOIN mock_test_versions v ON v.id = mq.version_id
  WHERE q.passage_id = OLD.id AND v.status IN ('published', 'superseded')
)
AND (
  NEW.subject_id IS NOT OLD.subject_id
  OR NEW.body IS NOT OLD.body
  OR NEW.body_hi IS NOT OLD.body_hi
  OR NEW.image_url IS NOT OLD.image_url
  OR NEW.image_alt IS NOT OLD.image_alt
)
BEGIN
  SELECT RAISE(ABORT, 'A passage attached to a published paper is immutable.');
END;

DROP TRIGGER IF EXISTS trg_frozen_passage_no_delete;
CREATE TRIGGER trg_frozen_passage_no_delete
BEFORE DELETE ON passages
FOR EACH ROW
WHEN EXISTS (
  SELECT 1
  FROM questions q
  JOIN mock_questions mq ON mq.question_id = q.id
  JOIN mock_test_versions v ON v.id = mq.version_id
  WHERE q.passage_id = OLD.id AND v.status IN ('published', 'superseded')
)
BEGIN
  SELECT RAISE(ABORT, 'A passage attached to a published paper cannot be deleted.');
END;

-- Dashboard and public API reads filter by user/status/version often.
CREATE INDEX IF NOT EXISTS idx_attempts_user_finished
  ON attempts(user_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_question
  ON attempt_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_question_reports_status
  ON question_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discussion_reports_open
  ON discussion_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_topic_status
  ON questions(topic_id, status, deleted_at);
