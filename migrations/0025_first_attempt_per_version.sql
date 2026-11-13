-- Republishing a paper creates a fresh leaderboard for the new immutable
-- version. Keep one ranked first attempt per user and version, not per mock.
DROP INDEX IF EXISTS uq_first_attempt;

CREATE UNIQUE INDEX uq_first_attempt
  ON attempts(user_id, version_id)
  WHERE is_first_attempt = 1;
