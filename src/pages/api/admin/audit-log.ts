import type { APIRoute } from "astro";
import { requirePermission } from "../../../lib/auth/guard";
import { all } from "../../../lib/db";
import { json } from "../../../lib/http";

/**
 * Read-only audit feed for super admins. The page uses the same source, but the
 * API keeps integrations and operational checks off direct SQL.
 */
export const GET: APIRoute = async (context) => {
  const guard = requirePermission(context, "audit.view");
  if (guard.response) return guard.response;

  const url = new URL(context.request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "50") || 50, 1), 200);
  const action = (url.searchParams.get("action") ?? "").trim().slice(0, 100);
  const entityType = (url.searchParams.get("entity_type") ?? "").trim().slice(0, 80);
  const entityIdRaw = (url.searchParams.get("entity_id") ?? "").trim();
  const actor = (url.searchParams.get("actor") ?? "").trim().slice(0, 120);

  const where: string[] = [];
  const params: (string | number)[] = [];
  if (action) {
    where.push("l.action = ?");
    params.push(action);
  }
  if (entityType) {
    where.push("l.entity_type = ?");
    params.push(entityType);
  }
  if (/^\d+$/.test(entityIdRaw)) {
    where.push("l.entity_id = ?");
    params.push(Number(entityIdRaw));
  }
  if (actor) {
    where.push("a.email LIKE ? ESCAPE '\\'");
    params.push(`%${actor.replace(/[\\%_]/g, "\\$&")}%`);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const entries = await all<{
    id: number;
    action: string;
    entity_type: string;
    entity_id: number | null;
    diff_json: string | null;
    created_at: string;
    email: string;
    role: string;
  }>(
    `SELECT l.id, l.action, l.entity_type, l.entity_id, l.diff_json, l.created_at,
            a.email, a.role
     FROM audit_log l JOIN admins a ON a.id = l.admin_id
     ${clause}
     ORDER BY l.id DESC
     LIMIT ? OFFSET ?`,
    ...params,
    limit,
    (page - 1) * limit,
  );

  return json({
    ok: true,
    count: entries.length,
    entries: entries.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entityType: entry.entity_type,
      entityId: entry.entity_id,
      diff: entry.diff_json ? safeJson(entry.diff_json) : null,
      createdAt: entry.created_at,
      actor: { email: entry.email, role: entry.role },
    })),
    pagination: { page, limit, hasNext: entries.length === limit },
  });
};

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}
