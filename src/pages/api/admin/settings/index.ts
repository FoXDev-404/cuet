import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import {
  publishDraftSettings,
  normalizeSettings,
  restoreSettingsRevision,
  saveDraftSettings,
} from "../../../../lib/admin/settings";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

export const PUT: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "settings.write");
  if (guard.response) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid request body.");
  }

  let values: Record<string, string>;
  try {
    values = normalizeSettings(body);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Invalid settings.");
  }

  let result: Awaited<ReturnType<typeof saveDraftSettings>>;
  try {
    result = await saveDraftSettings(values, guard.admin.id);
  } catch (error) {
    console.error("site builder draft update failed", error);
    return apiError("Could not save the site builder draft.", 500);
  }

  try {
    if (Object.keys(result.changed).length > 0) {
      await audit({
        adminId: guard.admin.id,
        action: "settings.draft.update",
        entityType: "site_settings",
        diff: result.changed,
      });
    }
    return json({
      ok: true,
      changed: Object.keys(result.changed).length,
      settings: result.settings,
      hasDraft: result.hasDraft,
    });
  } catch (error) {
    console.error("site builder draft audit failed", error);
    return apiError("Draft was saved, but its audit record could not be completed.", 500);
  }
};

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "settings.write");
  if (guard.response) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid request body.");
  }

  if (body.action === "publish") {
    try {
      const result = await publishDraftSettings(guard.admin.id);
      if (result.published) {
        await audit({
          adminId: guard.admin.id,
          action: "settings.publish",
          entityType: "site_settings",
          diff: { keys: Object.keys(result.changed) },
        });
      }
      return json({ ok: true, ...result });
    } catch (error) {
      console.error("site builder publish failed", error);
      return apiError("Could not publish the site builder draft.", 500);
    }
  }

  if (body.action === "restore" && typeof body.revisionId === "string") {
    try {
      const result = await restoreSettingsRevision(body.revisionId, guard.admin.id);
      if (!result) return apiError("Site settings revision not found.", 404);
      if (Object.keys(result.changed).length > 0) {
        await audit({
          adminId: guard.admin.id,
          action: "settings.revision.restore",
          entityType: "site_settings",
          diff: { revisionId: body.revisionId, stagedAsDraft: true },
        });
      }
      return json({ ok: true, ...result });
    } catch (error) {
      console.error("site builder revision restore failed", error);
      return apiError("Could not restore the site settings revision as a draft.", 500);
    }
  }

  return apiError("Unknown site settings action.");
};
