import type { APIRoute } from "astro";
import { can } from "../../../../lib/auth/admin";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import {
  insertMock,
  mockPayloadSchema,
  prepareMock,
} from "../../../../lib/admin/mocks";
import { all, first } from "../../../../lib/db";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

const EXAM_SLUG = "cuet-ug";

export const GET: APIRoute = async (context) => {
  const guard = requirePermission(context, "mocks.write");
  if (guard.response) return guard.response;

  const url = new URL(context.request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "30") || 30, 1), 100);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const status = (url.searchParams.get("status") ?? "").trim();
  const allowed = new Set(["draft", "in_review", "published", "archived"]);

  const where = ["m.deleted_at IS NULL"];
  const params: (string | number)[] = [];
  if (query) {
    where.push("m.title LIKE ? ESCAPE '\\'");
    params.push(`%${query.replace(/[\\%_]/g, "\\$&")}%`);
  }
  if (allowed.has(status)) {
    where.push("m.status = ?");
    params.push(status);
  }

  const rows = await all<{
    id: number;
    title: string;
    slug: string;
    type: string;
    status: string;
    duration_min: number;
    total_marks: number;
    published_at: string | null;
    updated_at: string | null;
    current_version_id: number | null;
    version_no: number | null;
    version_status: string | null;
    question_count: number;
    attempt_count: number;
  }>(
    `SELECT m.id, m.title, m.slug, m.type, m.status, m.duration_min, m.total_marks,
            m.published_at, m.updated_at, m.current_version_id,
            v.version_no, v.status AS version_status,
            (SELECT COUNT(*) FROM mock_questions_current mq WHERE mq.mock_id = m.id) AS question_count,
            (SELECT COUNT(*) FROM attempts a WHERE a.mock_id = m.id) AS attempt_count
     FROM mock_tests m
     LEFT JOIN mock_test_versions v ON v.id = m.current_version_id
     WHERE ${where.join(" AND ")}
     ORDER BY m.id DESC
     LIMIT ? OFFSET ?`,
    ...params,
    limit,
    (page - 1) * limit,
  );

  return json({
    ok: true,
    count: rows.length,
    mocks: rows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      href: `/admin/mocks/${row.id}`,
      type: row.type,
      status: row.status,
      durationMin: row.duration_min,
      totalMarks: row.total_marks,
      publishedAt: row.published_at,
      updatedAt: row.updated_at,
      currentVersionId: row.current_version_id,
      versionNo: row.version_no,
      versionStatus: row.version_status,
      questionCount: row.question_count,
      attemptCount: row.attempt_count,
    })),
    pagination: { page, limit, hasNext: rows.length === limit },
  });
};

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "mocks.write");
  if (guard.response) return guard.response;

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return apiError("Invalid JSON body.");
  }
  const parsed = mockPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid mock data.");
  }
  if (parsed.data.status === "published" && !can(guard.admin.role, "mocks.publish")) {
    return apiError("Your role cannot publish mock tests.", 403);
  }

  const exam = await first<{ id: number }>("SELECT id FROM exams WHERE slug = ?", EXAM_SLUG);
  if (!exam) return apiError("CUET UG exam row is missing.", 500);

  const prepared = await prepareMock(parsed.data, exam.id);
  if ("error" in prepared) return apiError(prepared.error);

  const slugTaken = await first<{ id: number }>("SELECT id FROM mock_tests WHERE slug = ?", prepared.slug);
  if (slugTaken) return apiError("That slug is already used. Pick another URL slug.", 409);

  try {
    const id = await insertMock(prepared.input, prepared.slug, exam.id, guard.admin.id);
    await audit({
      adminId: guard.admin.id,
      action: parsed.data.status === "published" ? "mock.publish" : "mock.create",
      entityType: "mock_test",
      entityId: id,
      diff: { title: parsed.data.title, questions: parsed.data.questions.length, status: parsed.data.status },
    });
    return json({ ok: true, id, redirect: `/admin/mocks/${id}` }, 201);
  } catch (error) {
    console.error("mock create failed", error);
    return apiError("Could not save the mock test.", 500);
  }
};
