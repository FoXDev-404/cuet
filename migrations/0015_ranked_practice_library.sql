PRAGMA foreign_keys = ON;

-- ============================================================================
-- Ranked practice library.
--
-- The 106 previous-year practice papers now run through the same ranked engine
-- as D1 mocks. Their content lives in mock_tests / mock_test_versions /
-- questions / mock_questions, while practice_papers keeps the public library
-- index (title, subject, year, provenance and recovered-question counts).
--
-- `practice_paper_slug` identifies mocks imported from that library so generic
-- mock and PYQ listings can avoid showing a second card for the same paper.
-- ============================================================================

ALTER TABLE mock_tests ADD COLUMN practice_paper_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_mock_tests_practice_paper
  ON mock_tests(practice_paper_slug);

-- Extra printed figures/tables for a question. `image_url` still carries the
-- primary visual so existing readers keep working; this list keeps the rest of
-- the page crops (including combined option images) available to the attempt
-- and solutions screens.
ALTER TABLE questions ADD COLUMN assets_json TEXT NOT NULL DEFAULT '[]';

-- Attempt counters now come from real ranked attempts, so the separate
-- aggregate table added during the unranked pilot is no longer needed.
DROP TABLE IF EXISTS practice_paper_attempts;
