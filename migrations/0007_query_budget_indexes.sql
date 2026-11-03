-- Phase G query-budget indexes.
--
-- Submit and mock-detail checks filter attempts by user + mock + status. The
-- existing single-column indexes force SQLite to read every attempt for the
-- mock (via idx_attempts_mock) or every attempt for the user before filtering.
-- The composite index bounds those reads to the user's own attempts.
CREATE INDEX IF NOT EXISTS idx_attempts_user_mock_status
  ON attempts(user_id, mock_id, status);

-- The admin dashboard counts today's attempts with a started_at range. Without
-- this index the count scans the whole attempts table as the site grows.
CREATE INDEX IF NOT EXISTS idx_attempts_started
  ON attempts(started_at);
