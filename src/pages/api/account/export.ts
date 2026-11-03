import type { APIRoute } from "astro";
import { all, first } from "../../../lib/db";
import { apiError } from "../../../lib/http";

/** Personal-data export (blueprint v2 account workflow). */
export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) return apiError("Login required.", 401);

  const profile = await first<Record<string, unknown>>(
    `SELECT username, email, bio, target_exam_date, is_profile_public, streak_count,
            created_at
     FROM users WHERE id = ? AND deleted_at IS NULL`,
    user.id,
  );
  if (!profile) return apiError("Account not found.", 404);

  const [attempts, answers, bookmarks, comments, badges] = await Promise.all([
    all(
      `SELECT a.id, a.mock_id, a.version_id, a.status, a.score, a.correct, a.wrong,
              a.skipped, a.time_taken_sec, a.started_at, a.deadline_at, a.submitted_at,
              a.is_first_attempt, m.title AS mock_title, v.version_no
       FROM attempts a
       JOIN mock_tests m ON m.id = a.mock_id
       JOIN mock_test_versions v ON v.id = a.version_id
       WHERE a.user_id = ? ORDER BY a.id`,
      user.id,
    ),
    all(
      `SELECT aa.attempt_id, aa.question_id, aa.selected, aa.time_spent_sec,
              aa.marked_for_review, aa.is_correct
       FROM attempt_answers aa JOIN attempts a ON a.id = aa.attempt_id
       WHERE a.user_id = ? ORDER BY aa.attempt_id, aa.question_id`,
      user.id,
    ),
    all(
      `SELECT b.question_id, b.note, b.created_at FROM bookmarks b
       WHERE b.user_id = ? ORDER BY b.created_at`,
      user.id,
    ),
    all(
      `SELECT d.id, d.mock_id, d.question_id, d.body, d.status, d.created_at
       FROM discussions d WHERE d.user_id = ? ORDER BY d.id`,
      user.id,
    ),
    all(
      `SELECT b.code, b.name, ub.awarded_at FROM user_badges ub
       JOIN badges b ON b.id = ub.badge_id WHERE ub.user_id = ?`,
      user.id,
    ),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    retention_note:
      "Submitted attempt records are retained after account deletion where needed for leaderboard integrity and legal obligations. Profile identifiers are anonymised.",
    profile,
    attempts,
    answers,
    bookmarks,
    discussions: comments,
    badges,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="cuet-account-${user.id}.json"`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
};
