import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { all } from "../../../../lib/db";

export const GET: APIRoute = async (context) => {
  const guard = requirePermission(context, "questions.write");
  if (guard.response) return guard.response;

  const url = new URL(context.request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 10), 500);

  const practiceLimit = Math.round(limit * 0.7);
  const mockLimit = limit - practiceLimit;

  const practiceRows = await all<{
    id: number;
    paper_slug: string;
    source_question_no: number | null;
    stem: string;
    correct_option: number | null;
    explanation_source: string;
    explanation_status: string;
    explanation: string | null;
  }>(
    `SELECT id, paper_slug, source_question_no, stem, correct_option,
            explanation_source, explanation_status, explanation
     FROM practice_questions
     WHERE deleted_at IS NULL
     ORDER BY RANDOM()
     LIMIT ?`,
    practiceLimit,
  );

  const mockRows = await all<{
    id: number;
    subject_name: string;
    text: string;
    correct_option: number | null;
    explanation_source: string;
    explanation_status: string;
    explanation: string | null;
  }>(
    `SELECT q.id, s.name AS subject_name, q.text, q.correct_option,
            q.explanation_source, q.explanation_status, q.explanation
     FROM questions q
     JOIN subjects s ON s.id = q.subject_id
     WHERE q.deleted_at IS NULL
     ORDER BY RANDOM()
     LIMIT ?`,
    mockLimit,
  );

  function csvEscape(val: unknown): string {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""').replace(/\r?\n/g, ' ');
    return `"${str}"`;
  }

  const headers = [
    "id",
    "table",
    "context",
    "source_question_no",
    "stem",
    "correct_option",
    "explanation_source",
    "explanation_status",
    "explanation",
    "decision",
    "notes",
  ];

  const lines = [headers.join(",")];

  for (const r of practiceRows) {
    lines.push(
      [
        csvEscape(r.id),
        '"practice_questions"',
        csvEscape(r.paper_slug),
        csvEscape(r.source_question_no),
        csvEscape(r.stem),
        csvEscape(r.correct_option),
        csvEscape(r.explanation_source),
        csvEscape(r.explanation_status),
        csvEscape(r.explanation),
        '""',
        '""',
      ].join(","),
    );
  }

  for (const r of mockRows) {
    lines.push(
      [
        csvEscape(r.id),
        '"questions"',
        csvEscape(r.subject_name),
        csvEscape(r.id),
        csvEscape(r.text),
        csvEscape(r.correct_option),
        csvEscape(r.explanation_source),
        csvEscape(r.explanation_status),
        csvEscape(r.explanation),
        '""',
        '""',
      ].join(","),
    );
  }

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="review_sample_${limit}_${Date.now()}.csv"`,
      "cache-control": "no-store",
    },
  });
};
