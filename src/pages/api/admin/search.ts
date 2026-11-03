import type { APIRoute } from "astro";
import { requireAdmin } from "../../../lib/auth/guard";
import { adminSearch } from "../../../lib/admin/search";
import { json } from "../../../lib/http";

export const GET: APIRoute = async (context) => {
  const guard = requireAdmin(context);
  if (guard.response) return guard.response;
  const query = context.url.searchParams.get("q") ?? "";
  return json({ query, groups: await adminSearch(guard.admin.role, query) });
};

export const prerender = false;
