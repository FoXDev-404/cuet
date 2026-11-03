import type { APIRoute } from "astro";
import { all, first } from "../../../lib/db";
import { apiUnavailableResponse } from "../../../lib/db-resilient";
import { parseMarkingScheme, parseOptions } from "../../../lib/content";
import { apiError, json } from "../../../lib/http";

type MockRow = {
  id: number;
  title: string;
  slug: string;
  type: string;
  status: string;
  subject_id: number | null;
  subject_name: string | null;
  subject_slug: string | null;
  version_id: number;
  version_no: number;
  duration_min: number;
  total_marks: number;
  marking_scheme: string;
  instructions: string | null;
  intro_html: string | null;
  pyq_year: number | null;
  pyq_shift: string | null;
  published_at: string | null;
};

/**
 * Public mock-detail contract. The payload deliberately omits answer keys,
 * explanations and correctness flags so it is safe to fetch before submitting.
 */
export const GET: APIRoute = async ({ params }) => {
  const slug = (params.slug ?? "").trim();
  if (!slug) return apiError("Mock test not found.", 404);

  let mock: MockRow | null = null;
  let questions: {
    id: number;
    section: string;
    position: number;
    subject_id: number;
    subject_name: string;
    topic_name: string | null;
    text: string;
    text_hi: string | null;
    options: string;
    options_hi: string | null;
    image_url: string | null;
    image_alt: string | null;
    passage_id: number | null;
    passage_body: string | null;
    passage_body_hi: string | null;
    passage_image_url: string | null;
    passage_image_alt: string | null;
  }[];
  try {
    mock = await first<MockRow>(
      `SELECT m.id, m.title, m.slug, m.type, m.status, m.subject_id,
              s.name AS subject_name, s.slug AS subject_slug,
              v.id AS version_id, v.version_no, v.duration_min, v.total_marks,
              v.marking_scheme, v.instructions, m.intro_html,
              m.pyq_year, m.pyq_shift, m.published_at
       FROM mock_tests m
       JOIN mock_test_versions v ON v.id = m.current_version_id
       LEFT JOIN subjects s ON s.id = m.subject_id
       WHERE m.slug = ? AND m.status = 'published' AND m.deleted_at IS NULL
         AND v.status = 'published'`,
      slug,
    );
    if (!mock) return apiError("Mock test not found.", 404);

    questions = await all<{
      id: number;
      section: string;
      position: number;
      subject_id: number;
      subject_name: string;
      topic_name: string | null;
      text: string;
      text_hi: string | null;
      options: string;
      options_hi: string | null;
      image_url: string | null;
      image_alt: string | null;
      passage_id: number | null;
      passage_body: string | null;
      passage_body_hi: string | null;
      passage_image_url: string | null;
      passage_image_alt: string | null;
    }>(
      `SELECT q.id, mq.section, mq.position, q.subject_id, s.name AS subject_name,
              t.name AS topic_name, q.text, q.text_hi, q.options, q.options_hi,
              q.image_url, q.image_alt, q.passage_id,
              p.body AS passage_body, p.body_hi AS passage_body_hi,
              p.image_url AS passage_image_url, p.image_alt AS passage_image_alt
       FROM mock_questions mq
       JOIN questions q ON q.id = mq.question_id
       JOIN subjects s ON s.id = q.subject_id
       LEFT JOIN topics t ON t.id = q.topic_id
       LEFT JOIN passages p ON p.id = q.passage_id
       WHERE mq.version_id = ? AND q.deleted_at IS NULL
       ORDER BY mq.position`,
      mock.version_id,
    );
  } catch (error) {
    console.error("Mock detail query failed", error);
    return apiUnavailableResponse();
  }

  const sections = new Map<string, number>();
  for (const question of questions) {
    sections.set(question.section, (sections.get(question.section) ?? 0) + 1);
  }

  const publicQuestions = questions.map((question) => ({
    id: question.id,
    section: question.section,
    position: question.position,
    subject: { id: question.subject_id, name: question.subject_name },
    topic: question.topic_name,
    text: question.text,
    textHi: question.text_hi,
    options: parseOptions(question.options).map((option) => ({
      text: option.text,
      imageUrl: option.image_url,
      alt: option.alt,
    })),
    optionsHi: question.options_hi ? parseOptions(question.options_hi) : null,
    imageUrl: question.image_url,
    imageAlt: question.image_alt,
    passage: question.passage_id
      ? {
          id: question.passage_id,
          body: question.passage_body,
          bodyHi: question.passage_body_hi,
          imageUrl: question.passage_image_url,
          imageAlt: question.passage_image_alt,
        }
      : null,
  }));

  return json({
    ok: true,
    mock: {
      id: mock.id,
      title: mock.title,
      slug: mock.slug,
      href: `/mock/${mock.slug}`,
      type: mock.type,
      subject: mock.subject_id
        ? { id: mock.subject_id, name: mock.subject_name, slug: mock.subject_slug }
        : null,
      version: { id: mock.version_id, no: mock.version_no },
      durationMin: mock.duration_min,
      totalMarks: mock.total_marks,
      markingScheme: parseMarkingScheme(mock.marking_scheme),
      instructions: mock.instructions,
      introHtml: mock.intro_html,
      pyq: mock.pyq_year ? { year: mock.pyq_year, shift: mock.pyq_shift } : null,
      publishedAt: mock.published_at,
      questionCount: publicQuestions.length,
      sections: [...sections.entries()].map(([name, count]) => ({ name, questionCount: count })),
    },
    questions: publicQuestions,
  });
};
