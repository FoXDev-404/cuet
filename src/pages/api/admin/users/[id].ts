import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { can } from "../../../../lib/auth/admin";
import { audit } from "../../../../lib/audit";
import { first } from "../../../../lib/db";
import {
  deleteUserByAdmin,
  findAdminUser,
  muteUser,
  parseMuteUntil,
  setBanned,
  unmuteUser,
} from "../../../../lib/admin/users";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

const MODERATION_ACTIONS = ["mute", "unmute", "ban", "unban"] as const;
const ALL_ACTIONS = [...MODERATION_ACTIONS, "delete"] as const;
type Action = (typeof ALL_ACTIONS)[number];

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("User not found.", 404);

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid request body.");
  }
  const action = String(body.action ?? "") as Action;
  if (!ALL_ACTIONS.includes(action)) return apiError("Unknown user action.");

  const permission = action === "delete" ? "admins.manage" : "moderation.write";
  const guard = requirePermission(context, permission);
  if (guard.response) return guard.response;

  const target = await findAdminUser(id);
  if (!target) return apiError("User not found.", 404);
  if (target.email.toLowerCase() === guard.admin.email.toLowerCase()) {
    return apiError("You cannot moderate your own account.", 400);
  }
  if (action === "delete") {
    const adminRow = await first<{ id: number }>(
      "SELECT id FROM admins WHERE lower(email) = lower(?) LIMIT 1",
      target.email,
    );
    if (adminRow) return apiError("Remove the admin role before deleting this account.", 400);
  }

  try {
    let diff: Record<string, unknown> = { action };
    if (action === "mute") {
      const until = parseMuteUntil(String(body.until ?? ""));
      if (!until) return apiError("Enter a future mute expiry (YYYY-MM-DD or ISO timestamp).");
      await muteUser(id, until);
      diff = { ...diff, until };
    } else if (action === "unmute") {
      await unmuteUser(id);
    } else if (action === "ban") {
      await setBanned(id, true);
      diff = { ...diff, banned_at: new Date().toISOString() };
    } else if (action === "unban") {
      await setBanned(id, false);
    } else if (action === "delete") {
      if (target.deleted_at) return apiError("This account is already deleted.", 409);
      await deleteUserByAdmin(id);
    }

    await audit({
      adminId: guard.admin.id,
      action: `user.${action}`,
      entityType: "user",
      entityId: id,
      diff: { ...diff, email: target.email, username: target.username },
    });

    return json({ ok: true, id, action });
  } catch (error) {
    console.error("admin user action failed", error);
    return apiError("Could not update the account.", 500);
  }
};

export const GET: APIRoute = async (context) => {
  const guard = requirePermission(context, "moderation.write");
  if (guard.response) return guard.response;
  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("User not found.", 404);
  const user = await findAdminUser(id);
  if (!user) return apiError("User not found.", 404);
  return json({ user, canDelete: can(guard.admin.role, "admins.manage") });
};
