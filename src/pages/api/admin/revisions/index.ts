import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { listRevisions } from "../../../../lib/admin/revisions";
import { apiError, json } from "../../../../lib/http";

export const GET: APIRoute = async (context) => {
  const guard = requirePermission(context, "revisions.restore");
  if (guard.response) return guard.response;

  const entity = context.url.searchParams.get("entity") ?? "";
  const id = Number(context.url.searchParams.get("id") ?? 0);
  if (!entity || !Number.isInteger(id) || id <= 0) return apiError("Provide entity and id.");

  const revisions = await listRevisions(entity, id);
  return json({ revisions });
};

export const prerender = false;
