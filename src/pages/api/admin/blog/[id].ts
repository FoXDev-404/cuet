import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import {
  blogPayloadSchema,
  deleteBlogPost,
  findBlogPost,
  saveBlogPost,
} from "../../../../lib/admin/blog";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

export const PATCH: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "seo.write");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Guide not found.", 404);
  if (!(await findBlogPost(id))) return apiError("Guide not found.", 404);

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return apiError("Invalid JSON body.");
  }
  const parsed = blogPayloadSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid guide.");

  try {
    await saveBlogPost(parsed.data, guard.admin.id, id);
    await audit({
      adminId: guard.admin.id,
      action: "blog.update",
      entityType: "blog_post",
      entityId: id,
      diff: { title: parsed.data.title, status: parsed.data.status },
    });
    return json({ ok: true, id, redirect: `/admin/blog?id=${id}` });
  } catch (error) {
    console.error("blog update failed", error);
    return apiError(error instanceof Error ? error.message : "Could not save the guide.", 400);
  }
};

export const DELETE: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "seo.write");
  if (guard.response) return guard.response;

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return apiError("Guide not found.", 404);
  try {
    await deleteBlogPost(id);
    await audit({
      adminId: guard.admin.id,
      action: "blog.delete",
      entityType: "blog_post",
      entityId: id,
    });
    return json({ ok: true, id });
  } catch (error) {
    console.error("blog delete failed", error);
    return apiError("Could not delete the guide.", 400);
  }
};
