import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import { run } from "../../../../lib/db";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const PUT: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "exam_info.write");
  if (guard.response) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid request body.");
  }

  const key = String(body.key ?? "").trim();
  const value = String(body.value ?? "").trim();
  const sourceUrl = String(body.source_url ?? "").trim();
  const lastVerified = String(body.last_verified ?? "").trim();

  if (!/^[a-z0-9-]{2,60}$/.test(key)) return apiError("Use a lowercase key such as exam-pattern.");
  if (value.length < 2 || value.length > 20_000) return apiError("Value must be between 2 and 20,000 characters.");
  if (sourceUrl) {
    try {
      const parsed = new URL(sourceUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) return apiError("Source URL must use http or https.");
    } catch {
      return apiError("Enter a valid source URL.");
    }
  }
  if (lastVerified && !validDate(lastVerified)) return apiError("Last verified must be a valid YYYY-MM-DD date.");

  try {
    await run(
      `INSERT INTO exam_info (key, value, source_url, last_verified)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         source_url = excluded.source_url,
         last_verified = excluded.last_verified`,
      key,
      value,
      sourceUrl || null,
      lastVerified || null,
    );
  } catch (error) {
    console.error("exam info save failed", error);
    return apiError("Could not save the exam information.", 500);
  }

  await audit({
    adminId: guard.admin.id,
    action: "exam_info.update",
    entityType: "exam_info",
    entityId: null,
    diff: { key, source_url: sourceUrl, last_verified: lastVerified },
  });

  return json({ ok: true, key, source_url: sourceUrl || null, last_verified: lastVerified || null });
};

export const DELETE: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "exam_info.write");
  if (guard.response) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid request body.");
  }
  const key = String(body.key ?? "").trim();
  if (!/^[a-z0-9-]{2,60}$/.test(key)) return apiError("Unknown exam-info key.");

  await run("DELETE FROM exam_info WHERE key = ?", key);
  await audit({
    adminId: guard.admin.id,
    action: "exam_info.delete",
    entityType: "exam_info",
    entityId: null,
    diff: { key },
  });
  return json({ ok: true, key });
};
