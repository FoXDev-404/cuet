import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { listUsers, type AdminUserRow } from "../../../../lib/admin/users";
import { json } from "../../../../lib/http";

export const GET: APIRoute = async (context) => {
  const guard = requirePermission(context, "moderation.write");
  if (guard.response) return guard.response;

  const url = new URL(context.request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const includeDeleted = url.searchParams.get("deleted") === "1";
  const users = await listUsers(query, includeDeleted);

  return json({
    ok: true,
    count: users.length,
    users: users.map((user: AdminUserRow) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      href: `/admin/users?q=${encodeURIComponent(user.email)}`,
      createdAt: user.created_at,
      deletedAt: user.deleted_at,
      bannedAt: user.banned_at,
      mutedUntil: user.muted_until,
      approvedComments: user.approved_comments,
      attemptCount: user.attempt_count,
      commentCount: user.comment_count,
      lastAttemptAt: user.last_attempt_at,
    })),
  });
};
