-- Migration 0021: Repair the published-question immutability guard.
--
-- Some existing databases still carry an older version of
-- trg_published_question_immutable that reads
-- mock_test_versions.publication_status and questions.version_id. Neither
-- column exists in the current schema, so every UPDATE on questions fails
-- with "no such column: publication_status" even when the row is not
-- published. Recreate the trigger with the current definition from 0004 so
-- soft-deleting a published question works while its content stays immutable.

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
