import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import {
  announcementSchema,
  deleteAnnouncement,
  findAnnouncement,
  saveAnnouncement,
} from "../../../../lib/admin/announcements";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

export const PATCH: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "announcements.write");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Announcement not found.", 404);
  const existing = await findAnnouncement(id);
  if (!existing) return apiError("Announcement not found.", 404);

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return apiError("Invalid JSON body.");
  }
  const parsed = announcementSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid announcement.");

  try {
    await saveAnnouncement(parsed.data, guard.admin.id, id);
    await audit({
      adminId: guard.admin.id,
      action: "announcement.update",
      entityType: "announcement",
      entityId: id,
      diff: parsed.data,
    });
    return json({ ok: true, id, redirect: `/admin/announcements?id=${id}` });
  } catch (error) {
    console.error("announcement update failed", error);
    return apiError(error instanceof Error ? error.message : "Could not save the announcement.", 400);
  }
};

export const DELETE: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "announcements.write");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Announcement not found.", 404);
  try {
    await deleteAnnouncement(id);
    await audit({
      adminId: guard.admin.id,
      action: "announcement.delete",
      entityType: "announcement",
      entityId: id,
    });
    return json({ ok: true, id });
  } catch (error) {
    console.error("announcement delete failed", error);
    return apiError("Could not delete the announcement.", 400);
  }
};
