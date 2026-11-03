import type { APIRoute } from "astro";
import { all } from "../../lib/db";
import { json } from "../../lib/http";

export const GET: APIRoute = async () => {
  const subjects = await all<{
    id: number;
    name: string;
    slug: string;
    type: string;
    exam_name: string;
    exam_slug: string;
    question_count: number;
    mock_count: number;
  }>(
    `SELECT s.id, s.name, s.slug, s.type, e.name AS exam_name, e.slug AS exam_slug,
            (SELECT COUNT(*) FROM questions q
              WHERE q.subject_id = s.id AND q.status = 'published' AND q.deleted_at IS NULL) AS question_count,
            (SELECT COUNT(DISTINCT m.id) FROM mock_tests m
              WHERE m.status = 'published' AND m.deleted_at IS NULL
                AND m.practice_paper_slug IS NULL
                AND EXISTS (
                  SELECT 1 FROM mock_questions_current mq
                  JOIN questions q2 ON q2.id = mq.question_id
                  WHERE mq.mock_id = m.id AND q2.subject_id = s.id
                )) AS mock_count
     FROM subjects s
     JOIN exams e ON e.id = s.exam_id
     WHERE s.is_active = 1 AND e.is_active = 1
     ORDER BY e.name, s.name`,
  );

  return json({ ok: true, count: subjects.length, subjects });
};
