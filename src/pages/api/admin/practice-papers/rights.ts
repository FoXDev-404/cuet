import type { APIRoute } from "astro";
import { z } from "zod";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import { run } from "../../../../lib/db";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

const updateRightsSchema = z.object({
  paperIds: z.array(z.number().int().positive()).min(1),
  rights_status: z.enum(["unknown", "cleared", "restricted"]).optional(),
  source_type: z.enum(["official_public", "licensed", "original", "unknown"]).optional(),
  source_url: z.string().trim().max(1000).optional(),
  rights_note: z.string().trim().max(2000).optional(),
});

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

  const parsed = updateRightsSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid rights payload.");
  }

  const { paperIds, rights_status, source_type, source_url, rights_note } = parsed.data;

  const updates: string[] = [];
  const bindings: any[] = [];

  if (rights_status !== undefined) {
    updates.push("rights_status = ?");
    bindings.push(rights_status);
  }
  if (source_type !== undefined) {
    updates.push("source_type = ?");
    bindings.push(source_type);
  }
  if (source_url !== undefined) {
    updates.push("source_url = ?");
    bindings.push(source_url || null);
  }
  if (rights_note !== undefined) {
    updates.push("rights_note = ?");
    bindings.push(rights_note || null);
  }

  updates.push("verified_by = ?");
  bindings.push(guard.admin.email);

  updates.push("verified_at = ?");
  bindings.push(new Date().toISOString());

  updates.push("updated_at = ?");
  bindings.push(new Date().toISOString());

  const placeholders = paperIds.map(() => "?").join(",");
  const sql = `UPDATE practice_papers SET ${updates.join(", ")} WHERE id IN (${placeholders}) AND deleted_at IS NULL`;

  try {
    await run(sql, ...bindings, ...paperIds);

    await audit({
      adminId: guard.admin.id,
      action: "practice_paper.rights_update",
      entityType: "practice_paper",
      entityId: paperIds[0],
      diff: {
        paperIds,
        rights_status,
        source_type,
        source_url,
        count: paperIds.length,
      },
    });

    return json({ ok: true, updatedCount: paperIds.length });
  } catch (err: any) {
    console.error("practice paper rights update failed:", err);
    return apiError(err.message || "Could not update paper rights.", 500);
  }
};

