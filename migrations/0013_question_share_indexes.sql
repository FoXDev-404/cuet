PRAGMA foreign_keys = ON;

-- ============================================================================
-- 0013 — indexes used by the public shared-question page.
--
-- The eligibility and SEO checks ask whether any question in a lineage is a
-- member of a currently published ranked mock. `mock_questions` is keyed by
-- (version_id, question_id), so a question-id lookup would otherwise scan the
-- table. The check API also looks up submitted answers by question id; that
-- index already exists from migration 0004.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_mq_question ON mock_questions(question_id);
