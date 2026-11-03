import { z } from "zod";
import { all, first, run } from "../db";
import { slugify } from "../content";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const blogPayloadSchema = z
  .object({
    title: z.string().trim().min(6).max(180),
    slug: z.string().trim().max(120).optional().default(""),
    description: z.string().trim().min(40).max(320),
    body: z.string().trim().min(1).max(60_000),
    status: z.enum(["draft", "published"]).default("draft"),
  })
  .superRefine((value, ctx) => {
    const slug = value.slug || slugify(value.title);
    if (!SLUG.test(slug) || slug.length < 3) {
      ctx.addIssue({
        code: "custom",
        path: ["slug"],
        message: "Use a lowercase slug with letters, numbers and single hyphens.",
      });
    }
    if (value.status === "published" && value.body.length < 400) {
      ctx.addIssue({
        code: "custom",
        path: ["body"],
        message: "A published guide needs at least 400 characters of original body text.",
      });
    }
    if (value.status === "published" && value.description.length < 80) {
      ctx.addIssue({
        code: "custom",
        path: ["description"],
        message: "A published guide needs an 80-320 character description for search and cards.",
      });
    }
  });

export type BlogPayload = z.infer<typeof blogPayloadSchema>;

export type AdminBlogRow = {
  id: number;
  slug: string;
  title: string;
  description: string;
  body: string;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  admin_email: string | null;
};

export async function listBlogPosts(): Promise<AdminBlogRow[]> {
  return all<AdminBlogRow>(
    `SELECT b.id, b.slug, b.title, b.description, b.body, b.status, b.published_at,
            b.created_at, b.updated_at, b.deleted_at, a.email AS admin_email
     FROM blog_posts b
     LEFT JOIN admins a ON a.id = b.created_by
     WHERE b.deleted_at IS NULL
     ORDER BY b.id DESC`,
  );
}

export async function findBlogPost(id: number): Promise<AdminBlogRow | null> {
  return first<AdminBlogRow>(
    `SELECT b.id, b.slug, b.title, b.description, b.body, b.status, b.published_at,
            b.created_at, b.updated_at, b.deleted_at, a.email AS admin_email
     FROM blog_posts b
     LEFT JOIN admins a ON a.id = b.created_by
     WHERE b.id = ? AND b.deleted_at IS NULL`,
    id,
  );
}

export async function saveBlogPost(
  input: BlogPayload,
  adminId: number,
  id?: number,
): Promise<number> {
  const slug = input.slug || slugify(input.title);
  const conflict = id
    ? await first<{ id: number }>(
        "SELECT id FROM blog_posts WHERE slug = ? AND deleted_at IS NULL AND id != ?",
        slug,
        id,
      )
    : await first<{ id: number }>(
        "SELECT id FROM blog_posts WHERE slug = ? AND deleted_at IS NULL",
        slug,
      );
  if (conflict) throw new Error("Another guide already uses that slug.");

  const now = new Date().toISOString();
  if (id) {
    const existing = await findBlogPost(id);
    if (!existing) throw new Error("Guide not found.");
    const publishedAt =
      input.status === "published"
        ? existing.published_at ?? now
        : existing.published_at;
    await run(
      `UPDATE blog_posts
       SET slug = ?, title = ?, description = ?, body = ?, status = ?, published_at = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
      slug,
      input.title,
      input.description,
      input.body,
      input.status,
      publishedAt,
      now,
      id,
    );
    return id;
  }

  const result = await run(
    `INSERT INTO blog_posts
      (slug, title, description, body, status, published_at, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    slug,
    input.title,
    input.description,
    input.body,
    input.status,
    input.status === "published" ? now : null,
    adminId,
    now,
    now,
  );
  return Number(result.meta.last_row_id);
}

export async function deleteBlogPost(id: number): Promise<void> {
  // blog_posts.slug is globally UNIQUE, so free the old slug when soft-deleting
  // a guide. Otherwise a future article could never reuse a retired slug.
  await run(
    `UPDATE blog_posts
     SET status = 'draft',
         slug = slug || '-deleted-' || id,
         deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ? AND deleted_at IS NULL`,
    id,
  );
}
