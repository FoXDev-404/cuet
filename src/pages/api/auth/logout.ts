import type { APIRoute } from "astro";
import { destroySession } from "../../../lib/auth/session";
import { forbiddenOrigin, isSameOrigin, json } from "../../../lib/http";

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOrigin(request)) return forbiddenOrigin();
  await destroySession(cookies);
  return json({ ok: true, redirect: "/" });
};
