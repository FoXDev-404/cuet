import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import {
  loadSettings,
  normalizeSettings,
  saveSettings,
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

  const before = await loadSettings();
  const changed = Object.fromEntries(
    Object.entries(values).filter(([key, value]) => before[key] !== value),
  );
  if (Object.keys(changed).length === 0) return json({ ok: true, changed: 0, settings: before });

  try {
    await saveSettings(values);
    await audit({
      adminId: guard.admin.id,
      action: "settings.update",
      entityType: "site_settings",
      diff: changed,
    });
    return json({ ok: true, changed: Object.keys(changed).length, settings: values });
  } catch (error) {
    console.error("settings update failed", error);
    return apiError("Could not save the settings.", 500);
  }
};
