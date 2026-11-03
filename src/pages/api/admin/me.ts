import type { APIRoute } from "astro";
import { permissionsFor } from "../../../lib/auth/admin";
import { apiError, json } from "../../../lib/http";

/**
 * Authoritative capability list for the signed-in admin. The UI renders from
 * this response; the API enforces the same ROLE_PERMISSIONS matrix.
 */
export const GET: APIRoute = async ({ locals }) => {
  const admin = locals.admin;
  if (!admin) return apiError("Admin authentication required.", 401);
  return json({
    id: admin.id,
    email: admin.email,
    role: admin.role,
    permissions: permissionsFor(admin.role),
    isSuper: admin.role === "super",
  });
};
