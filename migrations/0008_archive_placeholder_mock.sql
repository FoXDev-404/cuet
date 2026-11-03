-- Remove the two-question English starter placeholder from the public library.
--
-- The refined previous-year library under /practice is the published content;
-- the placeholder should never appear as a "most popular" paper again.
--
-- Only the mock identity is archived. Its published version row is left
-- untouched because migration 0004 freezes published versions (the only
-- permitted transition is to "superseded", which would falsely claim a newer
-- version exists).
UPDATE mock_tests
SET status = 'archived',
    deleted_at = COALESCE(deleted_at, datetime('now'))
WHERE slug = 'cuet-ug-english-starter-mock'
   OR title = 'CUET UG English Starter Mock';
