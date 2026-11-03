import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import { blogPayloadSchema, saveBlogPost } from "../../../../lib/admin/blog";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "seo.write");
  if (guard.response) return guard.response;

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return apiError("Invalid JSON body.");
  }
  const parsed = blogPayloadSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid guide.");

  try {
    const id = await saveBlogPost(parsed.data, guard.admin.id);
    await audit({
      adminId: guard.admin.id,
      action: "blog.create",
      entityType: "blog_post",
      entityId: id,
      diff: { title: parsed.data.title, status: parsed.data.status },
    });
    return json({ ok: true, id, redirect: `/admin/blog?id=${id}` }, 201);
  } catch (error) {
    console.error("blog create failed", error);
    return apiError(error instanceof Error ? error.message : "Could not save the guide.", 400);
  }
};
