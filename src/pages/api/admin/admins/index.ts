import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import {
  createAdmin,
  listAdmins,
  normalizeEmail,
  validRole,
} from "../../../../lib/admin/admins";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

export const GET: APIRoute = async (context) => {
  const guard = requirePermission(context, "admins.manage");
  if (guard.response) return guard.response;
  const query = context.url.searchParams.get("q") ?? "";
  const includeDeleted = context.url.searchParams.get("deleted") === "1";
  return json({ admins: await listAdmins(query, includeDeleted) });
};

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "admins.manage");
  if (guard.response) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Expected a JSON body.");
  }

  const email = normalizeEmail(body.email);
  const role = validRole(body.role);
  if (!email) return apiError("Enter a valid email address.");
  if (!role) return apiError("Choose a valid role.");

  try {
    const id = await createAdmin(email, role);
    await audit({
      adminId: guard.admin.id,
      action: "admin.create",
      entityType: "admins",
      entityId: id,
      diff: { email, role },
    });
    return json({ ok: true, id }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return apiError(
      message.toLowerCase().includes("unique")
        ? "That email already has an admin role. Edit the existing row instead."
        : message.slice(0, 300),
      400,
    );
  }
};

export const prerender = false;
