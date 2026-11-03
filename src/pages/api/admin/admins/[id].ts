import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import {
  deleteAdmin,
  findAdmin,
  normalizeEmail,
  removalWouldOrphan,
  updateAdmin,
  validRole,
} from "../../../../lib/admin/admins";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

export const PATCH: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "admins.manage");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Admin not found.", 404);
  const existing = await findAdmin(id);
  if (!existing || existing.deleted_at) return apiError("Admin not found.", 404);

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Expected a JSON body.");
  }

  const email = body.email === undefined ? existing.email : normalizeEmail(body.email);
  if (!email) return apiError("Enter a valid email address.");
  const role = body.role === undefined ? existing.role : validRole(body.role);
  if (!role) return apiError("Choose a valid role.");
  const isActive =
    body.is_active === undefined ? Boolean(existing.is_active) : body.is_active === true || body.is_active === 1 || body.is_active === "1";

  if (id === guard.admin.id && !isActive) {
    return apiError("You cannot deactivate your own admin account.", 400);
  }
  const losingSuper = existing.role === "super" && (role !== "super" || !isActive);
  if (losingSuper && (await removalWouldOrphan(id))) {
    return apiError("At least one active Super Admin must remain.", 400);
  }
  if (role === "super" && !isActive && existing.role !== "super") {
    return apiError("An inactive row cannot be promoted straight to Super. Activate it first.", 400);
  }

  try {
    await updateAdmin(id, { email, role, isActive });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return apiError(
      message.toLowerCase().includes("unique")
        ? "That email already has an admin role."
        : message.slice(0, 300),
      400,
    );
  }

  await audit({
    adminId: guard.admin.id,
    action: "admin.update",
    entityType: "admins",
    entityId: id,
    diff: {
      before: { email: existing.email, role: existing.role, is_active: existing.is_active },
      after: { email, role, is_active: isActive ? 1 : 0 },
    },
  });
  return json({ ok: true, id });
};

export const DELETE: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "admins.manage");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Admin not found.", 404);
  const existing = await findAdmin(id);
  if (!existing || existing.deleted_at) return apiError("Admin not found.", 404);
  if (id === guard.admin.id) return apiError("You cannot remove your own admin account.", 400);
  if (await removalWouldOrphan(id)) {
    return apiError("At least one active Super Admin must remain.", 400);
  }

  await deleteAdmin(id);
  await audit({
    adminId: guard.admin.id,
    action: "admin.delete",
    entityType: "admins",
    entityId: id,
    diff: { email: existing.email, role: existing.role },
  });
  return json({ ok: true });
};

export const prerender = false;
