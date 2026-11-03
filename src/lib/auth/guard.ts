import type { APIContext } from "astro";
import { can, type AdminUser, type Permission } from "./admin";
import { apiError } from "../http";

export type GuardedAdmin = { admin: AdminUser; response?: never };
export type GuardFailure = { admin?: never; response: Response };

export function requirePermission(
  context: APIContext,
  permission: Permission,
): GuardedAdmin | GuardFailure {
  const admin = context.locals.admin;
  if (!admin) {
    return { response: apiError("Admin authentication required.", 401) };
  }
  if (!can(admin.role, permission)) {
    return { response: apiError("Your role cannot perform this action.", 403) };
  }
  return { admin };
}

export function requireAdmin(context: APIContext): GuardedAdmin | GuardFailure {
  const admin = context.locals.admin;
  if (!admin) {
    return { response: apiError("Admin authentication required.", 401) };
  }
  return { admin };
}
