import type { APIRoute } from "astro";
import { all, first } from "../../../lib/db";
import { apiUnavailableResponse } from "../../../lib/db-resilient";
import { json } from "../../../lib/http";

const TYPES = new Set(["full", "subject", "chapter", "pyq"]);

function integer(value: string | null, fallback: number): number {
  const number = Number(value ?? "");
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

export const GET: APIRoute = async ({ url }) => {
  const page = Math.min(integer(url.searchParams.get("page"), 1), 10_000);
  const limit = Math.min(integer(url.searchParams.get("limit"), 12), 50);
  const subject = (url.searchParams.get("subject") ?? "").trim().slice(0, 90);
  const type = (url.searchParams.get("type") ?? "").trim().toLowerCase();
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const sort = url.searchParams.get("sort") === "popular" ? "popular" : "latest";

  const where = [
    "m.status = 'published'",
    "m.deleted_at IS NULL",
    // Imported previous-year papers are listed by the practice library, not
    // the generic mock bank. Their detail endpoint still resolves by slug.
    "m.practice_paper_slug IS NULL",
    "EXISTS (SELECT 1 FROM mock_questions_current mq0 WHERE mq0.mock_id = m.id)",
  ];
  const params: (string | number)[] = [];
  if (subject) {
    where.push(
      `EXISTS (
        SELECT 1 FROM subjects fs
        WHERE fs.slug = ? AND (
          m.subject_id = fs.id OR EXISTS (
            SELECT 1 FROM mock_questions_current mq
            JOIN questions q ON q.id = mq.question_id
            WHERE mq.mock_id = m.id AND q.subject_id = fs.id
          )
        )
      )`,
    );
    params.push(subject);
  }
  if (TYPES.has(type)) {
    where.push("m.type = ?");
    params.push(type);
  }
  if (query) {
    where.push("m.title LIKE ? ESCAPE '\\'");
    params.push(`%${query.replace(/[\\%_]/g, "\\$&")}%`);
  }

  const whereSql = where.join(" AND ");
  const orderSql =
    sort === "popular"
      ? "attempt_count DESC, m.published_at DESC, m.id DESC"
      : "m.published_at DESC, m.id DESC";

  type MockRow = {
    id: number;
    title: string;
    slug: string;
    type: string;
    duration_min: number;
    total_marks: number;
    marking_scheme: string;
    subject_name: string | null;
    question_count: number;
    attempt_count: number;
    published_at: string | null;
  };

  let totalRow: { total: number } | null = null;
  let mocks: MockRow[] = [];
  try {
    [totalRow, mocks] = await Promise.all([
      first<{ total: number }>(
        `SELECT COUNT(*) AS total FROM mock_tests m WHERE ${whereSql}`,
        ...params,
      ),
      all<MockRow>(
        `SELECT m.id, m.title, m.slug, m.type, m.duration_min, m.total_marks, m.marking_scheme,
                s.name AS subject_name,
                (SELECT COUNT(*) FROM mock_questions_current mq WHERE mq.mock_id = m.id) AS question_count,
                (SELECT COUNT(*) FROM attempts a
                  WHERE a.mock_id = m.id AND a.status IN ('submitted','expired')) AS attempt_count,
                m.published_at
         FROM mock_tests m
         LEFT JOIN subjects s ON s.id = m.subject_id
         WHERE ${whereSql}
         ORDER BY ${orderSql}
         LIMIT ? OFFSET ?`,
        ...params,
        limit,
        (page - 1) * limit,
      ),
    ]);
  } catch (error) {
    console.error("Mock list query failed", error);
    return apiUnavailableResponse();
  }

  const total = totalRow?.total ?? 0;
  return json({
    ok: true,
    count: mocks.length,
    mocks: mocks.map((mock) => ({ ...mock, href: `/mock/${mock.slug}` })),
    filters: { subject: subject || null, type: TYPES.has(type) ? type : null, q: query || null, sort },
    pagination: {
      page,
      limit,
      total,
      pages: total === 0 ? 0 : Math.ceil(total / limit),
      hasNext: page * limit < total,
    },
  });
};
