import type { APIRoute } from "astro";
import { apiUnavailableResponse } from "../../lib/db-resilient";
import { json } from "../../lib/http";
import { getSubjectStats } from "../../lib/subject-stats";

export const GET: APIRoute = async () => {
  let subjects: {
    id: number;
    name: string;
    slug: string;
    type: string;
    exam_name: string;
    exam_slug: string;
    question_count: number;
    mock_count: number;
  }[];
  try {
    subjects = (await getSubjectStats()).map((subject) => ({
      id: subject.id,
      name: subject.name,
      slug: subject.slug,
      type: subject.type,
      exam_name: subject.exam_name,
      exam_slug: subject.exam_slug,
      question_count: subject.published_question_count,
      mock_count: subject.question_mock_count,
    }));
  } catch (error) {
    console.error("Subjects query failed", error);
    return apiUnavailableResponse();
  }

  return json({ ok: true, count: subjects.length, subjects });
};
