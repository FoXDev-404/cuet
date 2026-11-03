import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import { createPassage, listPassages, parsePassageInput } from "../../../../lib/admin/passages";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

export const GET: APIRoute = async (context) => {
  const guard = requirePermission(context, "taxonomy.write");
  if (guard.response) return guard.response;
  const params = context.url.searchParams;
  return json({
    passages: await listPassages(
      params.get("q") ?? "",
      Number(params.get("subject") ?? 0),
      params.get("deleted") === "1",
    ),
  });
};

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "taxonomy.write");
  if (guard.response) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Expected a JSON body.");
  }
  const parsed = parsePassageInput(body);
  if ("error" in parsed) return apiError(parsed.error);

  const id = await createPassage(parsed.input);
  await audit({
    adminId: guard.admin.id,
    action: "passage.create",
    entityType: "passages",
    entityId: id,
    diff: { subject_id: parsed.input.subject_id },
  });
  return json({ ok: true, id, redirect: `/admin/passages?id=${id}` }, 201);
};

export const prerender = false;
