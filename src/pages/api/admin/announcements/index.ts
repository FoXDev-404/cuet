import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import { announcementSchema, saveAnnouncement } from "../../../../lib/admin/announcements";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "announcements.write");
  if (guard.response) return guard.response;

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return apiError("Invalid JSON body.");
  }
  const parsed = announcementSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid announcement.");

  try {
    const id = await saveAnnouncement(parsed.data, guard.admin.id);
    await audit({
      adminId: guard.admin.id,
      action: "announcement.create",
      entityType: "announcement",
      entityId: id,
      diff: parsed.data,
    });
    return json({ ok: true, id, redirect: `/admin/announcements?id=${id}` }, 201);
  } catch (error) {
    console.error("announcement create failed", error);
    return apiError(error instanceof Error ? error.message : "Could not save the announcement.", 400);
  }
};
