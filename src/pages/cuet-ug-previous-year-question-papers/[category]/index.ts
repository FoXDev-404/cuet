import type { APIRoute } from "astro";
import { resolvePyqCategoryRoot } from "../../../lib/pyq-subject-path";

/**
 * Category roots (`.../general-aptitude-test-pyqs`, `.../language-pyqs`,
 * `.../domain-subject-pyqs`) are sections of the PYQ archive, not standalone
 * pages. Legacy and hand-typed URLs land on the archive; unknown categories
 * stay 404.
 */
export const GET: APIRoute = ({ params, redirect }) => {
  const target = resolvePyqCategoryRoot(params.category ?? "");
  if (!target) return new Response("Category not found", { status: 404 });
  return redirect(target, 301);
};
