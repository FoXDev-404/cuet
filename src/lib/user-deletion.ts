import { run } from "./db";

/**
 * Soft-delete an account and remove or anonymise the rows that identify it.
 *
 * Historical attempts are intentionally retained for leaderboard integrity and
 * reference the now-anonymised user row. Comments are hidden and their text is
 * replaced in place so replies from other users do not become orphaned.
 * The update is guarded by `deleted_at IS NULL`, so a repeated call is a no-op
 * for the profile but still cleans up any rows created between calls.
 */
export async function softDeleteUserAccount(id: number): Promise<void> {
  await run(
    `UPDATE users SET
       deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
       email = 'deleted-' || id || '@invalid.local',
       username = 'deleted-' || id,
       password_hash = NULL,
       google_id = NULL,
       avatar_url = NULL,
       bio = NULL,
       target_exam_date = NULL,
       is_profile_public = 0,
       muted_until = NULL,
       banned_at = NULL,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ? AND deleted_at IS NULL`,
    id,
  );
  await run("DELETE FROM sessions WHERE user_id = ?", id);
  await run("DELETE FROM password_resets WHERE user_id = ?", id);
  await run("DELETE FROM email_verifications WHERE user_id = ?", id);
  await run("DELETE FROM bookmarks WHERE user_id = ?", id);
  await run("DELETE FROM discussion_votes WHERE user_id = ?", id);
  await run("DELETE FROM discussion_reports WHERE user_id = ?", id);
  await run("DELETE FROM question_reports WHERE user_id = ?", id);
  await run("DELETE FROM share_events WHERE user_id = ?", id);
  await run("DELETE FROM user_stats WHERE user_id = ?", id);
  await run("DELETE FROM user_badges WHERE user_id = ?", id);
  // Comments and replies can remain as a thread but must not retain the
  // deleted account's text or identity. Hide and anonymise them instead of
  // deleting a row another user has replied to.
  await run(
    `UPDATE discussions
     SET body = '[deleted by user]', status = 'hidden', is_pinned = 0, is_best_answer = 0
     WHERE user_id = ?`,
    id,
  );
}
