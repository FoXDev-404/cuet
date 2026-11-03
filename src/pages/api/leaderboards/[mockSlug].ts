import type { APIRoute } from "astro";
import { all, first } from "../../../lib/db";
import { percentileFor } from "../../../lib/ranking";
import { apiError, json } from "../../../lib/http";

/**
 * Public first-attempt leaderboard feed. Output is username-only, matching the
 * page contract: no email, user id or other private profile fields.
 */
export const GET: APIRoute = async (context) => {
  const slug = (context.params.mockSlug ?? "").trim();
  if (!slug) return apiError("Leaderboard not found.", 404);

  const mock = await first<{
    id: number;
    title: string;
    slug: string;
    total_marks: number;
    duration_min: number;
    version_id: number;
  }>(
    `SELECT m.id, m.title, m.slug, v.total_marks, v.duration_min, v.id AS version_id
     FROM mock_tests m JOIN mock_test_versions v ON v.id = m.current_version_id
     WHERE m.slug = ? AND m.status = 'published' AND m.deleted_at IS NULL`,
    slug,
  );
  if (!mock) return apiError("Leaderboard not found.", 404);

  const [rows, summary] = await Promise.all([
    all<{
      rank: number;
      username: string;
      score: number;
      correct: number;
      wrong: number;
      time_taken_sec: number;
      submitted_at: string;
    }>(
      `SELECT rank, username, score, correct, wrong, time_taken_sec, submitted_at FROM (
         SELECT u.username, a.score, a.correct, a.wrong, a.time_taken_sec, a.submitted_at,
                RANK() OVER (ORDER BY a.score DESC, a.time_taken_sec ASC, (CASE WHEN a.correct + a.wrong > 0 THEN a.correct * 1.0 / (a.correct + a.wrong) ELSE 0 END) DESC) AS rank
         FROM attempts a JOIN users u ON u.id = a.user_id
         WHERE a.version_id = ? AND a.status = 'submitted' AND a.is_first_attempt = 1
           AND u.deleted_at IS NULL
       ) ORDER BY rank, submitted_at LIMIT 100`,
      mock.version_id,
    ),
    first<{ eligible: number; average: number | null; best: number | null }>(
      `SELECT COUNT(*) AS eligible, AVG(a.score) AS average, MAX(a.score) AS best
       FROM attempts a JOIN users u ON u.id = a.user_id
       WHERE a.version_id = ? AND a.status = 'submitted' AND a.is_first_attempt = 1
         AND u.deleted_at IS NULL`,
      mock.version_id,
    ),
  ]);

  const eligible = summary?.eligible ?? 0;
  return json({
    ok: true,
    mock: {
      id: mock.id,
      title: mock.title,
      slug: mock.slug,
      href: `/leaderboard/${mock.slug}`,
      totalMarks: mock.total_marks,
      durationMin: mock.duration_min,
      versionId: mock.version_id,
    },
    rule: "first-attempt-only",
    eligible,
    average: summary?.average ?? null,
    best: summary?.best ?? null,
    percentileDefinition:
      "Percentile = share of ranked first attempts scoring at or below this attempt, rounded up.",
    entries: rows.map((row) => {
      const answered = row.correct + row.wrong;
      return {
        rank: row.rank,
        username: row.username,
        score: row.score,
        correct: row.correct,
        wrong: row.wrong,
        accuracy: answered > 0 ? Math.round((row.correct / answered) * 1000) / 10 : 0,
        timeTakenSec: row.time_taken_sec,
        submittedAt: row.submitted_at,
        percentile: percentileFor(row.rank, eligible),
      };
    }),
  });
};
