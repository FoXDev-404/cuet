import type { APIContext } from "astro";
import { describe, expect, it, vi } from "vitest";

// The permission matrix is pure; stub the D1 module so this unit test does not
// need the Cloudflare Workers runtime.
vi.mock("../../src/lib/db", () => ({ first: vi.fn() }));

import {
  can,
  PERMISSIONS,
  type AdminRole,
  type AdminUser,
  type Permission,
} from "../../src/lib/auth/admin";
import { requireAdmin, requirePermission } from "../../src/lib/auth/guard";

const ALL_PERMISSIONS: Permission[] = [...PERMISSIONS];

const EXPECTED: Record<AdminRole, Permission[]> = {
  super: ALL_PERMISSIONS,
  editor: [
    "questions.write",
    "questions.publish",
    "questions.delete",
    "taxonomy.write",
    "mocks.write",
    "mocks.publish",
    "media.write",
    "seo.write",
    "exam_info.write",
    "announcements.write",
    "leaderboards.write",
    "moderation.write",
    "attempts.view",
    "users.view",
    "revisions.restore",
    "audit.own",
  ],
  moderator: ["moderation.write", "users.view", "users.mute"],
  contributor: ["questions.write", "media.write"],
};

function admin(role: AdminRole): AdminUser {
  return { id: 7, email: "admin@example.com", role };
}

function context(role: AdminRole | null): APIContext {
  return {
    locals: role ? { admin: admin(role) } : {},
  } as unknown as APIContext;
}

function allowed(role: AdminRole): Set<Permission> {
  return new Set(ALL_PERMISSIONS.filter((permission) => can(role, permission)));
}

describe("admin role permission matrix", () => {
  it.each(Object.keys(EXPECTED) as AdminRole[])(
    "grants exactly the documented permissions to %s",
    (role) => {
      expect(allowed(role)).toEqual(new Set(EXPECTED[role]));
    },
  );

  it("keeps destructive and cross-team permissions away from editors", () => {
    for (const permission of [
      "admins.manage",
      "settings.write",
      "data.manage",
      "trash.manage",
      "audit.view",
      "attempts.void",
      "attempts.rescore",
      "users.manage",
    ] as Permission[]) {
      expect(can("editor", permission)).toBe(false);
    }
  });

  it("lets only super admins manage admins, settings and the audit log", () => {
    for (const role of ["editor", "moderator", "contributor"] as AdminRole[]) {
      expect(can(role, "admins.manage")).toBe(false);
      expect(can(role, "settings.write")).toBe(false);
      expect(can(role, "audit.view")).toBe(false);
    }
  });
});

describe("server-side permission guard", () => {
  it("returns 401 when no admin identity is attached", async () => {
    const guard = requirePermission(context(null), "mocks.write");
    expect(guard.admin).toBeUndefined();
    expect(guard.response?.status).toBe(401);
    expect(await guard.response?.json()).toEqual({ error: "Admin authentication required." });
  });

  it("returns 403 when the admin role lacks the permission", async () => {
    const guard = requirePermission(context("moderator"), "mocks.write");
    expect(guard.admin).toBeUndefined();
    expect(guard.response?.status).toBe(403);
    expect(await guard.response?.json()).toEqual({
      error: "Your role cannot perform this action.",
    });
  });

  it("returns the admin identity when the role has the permission", () => {
    const guard = requirePermission(context("moderator"), "moderation.write");
    expect(guard.response).toBeUndefined();
    expect(guard.admin).toEqual(admin("moderator"));
  });

  it("distinguishes authentication from authorisation for any admin role", async () => {
    expect(requireAdmin(context(null)).response?.status).toBe(401);
    expect(requireAdmin(context("contributor")).admin?.role).toBe("contributor");
  });
});
