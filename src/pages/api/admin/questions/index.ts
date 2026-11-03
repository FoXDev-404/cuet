import type { APIRoute } from "astro";
import { can } from "../../../../lib/auth/admin";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import { questionPayloadSchema } from "../../../../lib/content";
import { insertQuestion, findDuplicateQuestion, prepareQuestion } from "../../../../lib/admin/questions";
import { all } from "../../../../lib/db";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

export const GET: APIRoute = async (context) => {
  const guard = requirePermission(context, "questions.write");
  if (guard.response) return guard.response;

  const url = new URL(context.request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "30") || 30, 1), 100);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const status = (url.searchParams.get("status") ?? "").trim();
  const subject = Number(url.searchParams.get("subject") ?? "");
  const topic = Number(url.searchParams.get("topic") ?? "");
  const requestedYear = Number(url.searchParams.get("year") ?? "");
  const year =
    Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100
      ? requestedYear
      : 0;
  const allowed = new Set(["draft", "in_review", "published"]);

  const where = ["q.deleted_at IS NULL"];
  const params: (string | number)[] = [];
  if (query) {
    where.push("q.text LIKE ? ESCAPE '\\'");
    params.push(`%${query.replace(/[\\%_]/g, "\\$&")}%`);
  }
  if (allowed.has(status)) {
    where.push("q.status = ?");
    params.push(status);
  }
  if (Number.isInteger(subject) && subject > 0) {
    where.push("q.subject_id = ?");
    params.push(subject);
  }
  if (Number.isInteger(topic) && topic > 0) {
    where.push("q.topic_id = ?");
    params.push(topic);
  }
  if (year > 0) {
    where.push("q.year = ?");
    params.push(year);
  }

  const rows = await all<{
    id: number;
    subject_id: number;
    subject_name: string;
    topic_id: number | null;
    topic_name: string | null;
    text: string;
    status: string;
    difficulty: string | null;
    year: number | null;
    created_at: string;
    updated_at: string | null;
    supersedes_id: number | null;
  }>(
    `SELECT q.id, q.subject_id, s.name AS subject_name, q.topic_id, t.name AS topic_name,
            q.text, q.status, q.difficulty, q.year, q.created_at, q.updated_at, q.supersedes_id
     FROM questions q
     JOIN subjects s ON s.id = q.subject_id
     LEFT JOIN topics t ON t.id = q.topic_id
     WHERE ${where.join(" AND ")}
     ORDER BY q.id DESC
     LIMIT ? OFFSET ?`,
    ...params,
    limit,
    (page - 1) * limit,
  );

  return json({
    ok: true,
    count: rows.length,
    questions: rows.map((row) => ({
      id: row.id,
      href: `/admin/questions/${row.id}`,
      subject: { id: row.subject_id, name: row.subject_name },
      topic: row.topic_id ? { id: row.topic_id, name: row.topic_name } : null,
      text: row.text,
      status: row.status,
      difficulty: row.difficulty,
      year: row.year,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      supersedesId: row.supersedes_id,
    })),
    pagination: { page, limit, hasNext: rows.length === limit },
  });
};

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "questions.write");
  if (guard.response) return guard.response;

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return apiError("Invalid JSON body.");
  }

  const parsed = questionPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid question data.");
  }
  if (
    parsed.data.status !== "draft" &&
    !can(guard.admin.role, "questions.publish")
  ) {
    return apiError("Contributors can only save drafts. An editor must publish.", 403);
  }

  const prepared = await prepareQuestion(parsed.data);
  if ("error" in prepared) return apiError(prepared.error);

  const duplicate = await findDuplicateQuestion(prepared.input.subject_id, prepared.input.text);
  if (duplicate) {
    return apiError(
      `A question with the same text already exists in this subject (#${duplicate.id}, ${duplicate.status}). Edit that question instead of creating a duplicate.`,
      409,
    );
  }

  try {
    const id = await insertQuestion(prepared.input, guard.admin.id);
    await audit({
      adminId: guard.admin.id,
      action: "question.create",
      entityType: "question",
      entityId: id,
      diff: { status: prepared.input.status, subject_id: prepared.input.subject_id },
    });
    return json({ ok: true, id, redirect: `/admin/questions/${id}` }, 201);
  } catch (error) {
    console.error("question create failed", error);
    return apiError("Could not save the question.", 500);
  }
};
