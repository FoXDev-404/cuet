import { all, first, run } from "../db";

export type LeaderboardMockRow = {
  id: number;
  title: string;
  slug: string;
  status: string;
  version_id: number | null;
  version_no: number | null;
  ranked_count: number;
  attempt_count: number;
};

export type AdminAttemptRow = {
  id: number;
  user_id: number | null;
  guest_token: string | null;
  username: string | null;
  email: string | null;
  status: "in_progress" | "submitted" | "expired";
  score: number | null;
  correct: number | null;
  wrong: number | null;
  skipped: number | null;
  time_taken_sec: number | null;
  started_at: string;
  submitted_at: string | null;
  is_first_attempt: number;
  disqualified_at: string | null;
  version_id: number;
  version_no: number | null;
};

export async function listLeaderboardMocks(): Promise<LeaderboardMockRow[]> {
  return all<LeaderboardMockRow>(
    `SELECT m.id, m.title, m.slug, m.status, v.id AS version_id, v.version_no,
            (SELECT COUNT(*) FROM attempts a
              WHERE a.mock_id = m.id AND a.version_id = v.id
                AND a.status = 'submitted' AND a.is_first_attempt = 1) AS ranked_count,
            (SELECT COUNT(*) FROM attempts a
              WHERE a.mock_id = m.id AND a.status IN ('submitted', 'expired')) AS attempt_count
     FROM mock_tests m
     LEFT JOIN mock_test_versions v ON v.id = m.current_version_id
     WHERE m.deleted_at IS NULL
     ORDER BY CASE WHEN m.status = 'published' THEN 0 ELSE 1 END,
              m.published_at DESC, m.id DESC`,
  );
}

export async function rankedAttempts(
  mockId: number,
  versionId: number,
): Promise<AdminAttemptRow[]> {
  return all<AdminAttemptRow>(
    `SELECT a.id, a.user_id, a.guest_token, u.username, u.email, a.status,
            a.score, a.correct, a.wrong, a.skipped, a.time_taken_sec,
            a.started_at, a.submitted_at, a.is_first_attempt, a.disqualified_at,
            a.version_id, v.version_no
     FROM attempts a
     LEFT JOIN users u ON u.id = a.user_id
     LEFT JOIN mock_test_versions v ON v.id = a.version_id
     WHERE a.mock_id = ? AND a.version_id = ?
       AND a.status = 'submitted' AND a.is_first_attempt = 1
     ORDER BY a.score DESC, a.time_taken_sec ASC, (CASE WHEN a.correct + a.wrong > 0 THEN a.correct * 1.0 / (a.correct + a.wrong) ELSE 0 END) DESC, a.submitted_at ASC`,
    mockId,
    versionId,
  );
}

export async function recentAttempts(mockId: number, limit = 100): Promise<AdminAttemptRow[]> {
  return all<AdminAttemptRow>(
    `SELECT a.id, a.user_id, a.guest_token, u.username, u.email, a.status,
            a.score, a.correct, a.wrong, a.skipped, a.time_taken_sec,
            a.started_at, a.submitted_at, a.is_first_attempt, a.disqualified_at,
            a.version_id, v.version_no
     FROM attempts a
     LEFT JOIN users u ON u.id = a.user_id
     LEFT JOIN mock_test_versions v ON v.id = a.version_id
     WHERE a.mock_id = ?
     ORDER BY a.started_at DESC, a.id DESC
     LIMIT ?`,
    mockId,
    limit,
  );
}

/**
 * Undo a disqualification. The attempt only returns to the ranked slot when
 * the user has no other ranked attempt on the paper; a retake therefore stays
 * out of the leaderboard even after reinstatement.
 */
export async function reinstateAttempt(
  attemptId: number,
  adminId: number | null,
): Promise<{ ranked: boolean }> {
  const attempt = await first<{
    id: number;
    user_id: number | null;
    mock_id: number;
    status: string;
  }>("SELECT id, user_id, mock_id, status FROM attempts WHERE id = ?", attemptId);
  if (!attempt) throw new Error("Attempt not found.");
  if (attempt.status !== "submitted") throw new Error("Only a submitted attempt can be reinstated.");

  const existing = await first<{ id: number }>(
    `SELECT id FROM attempts
     WHERE user_id = ? AND mock_id = ? AND status = 'submitted'
       AND is_first_attempt = 1 AND id != ?`,
    attempt.user_id,
    attempt.mock_id,
    attemptId,
  );
  const ranked = Boolean(attempt.user_id) && !existing;
  await run(
    `UPDATE attempts
     SET is_first_attempt = ?, disqualified_at = NULL, disqualified_by = ?
     WHERE id = ? AND status = 'submitted'`,
    ranked ? 1 : 0,
    ranked ? null : adminId,
    attemptId,
  );
  return { ranked };
}
