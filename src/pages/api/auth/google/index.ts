import type { APIRoute } from "astro";
import { randomToken } from "../../../../lib/auth/session";
import { googleAuthUrl, isGoogleConfigured } from "../../../../lib/auth/oauth";
import { safeNext } from "../../../../lib/http";

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  if (!isGoogleConfigured()) {
    return redirect("/login?error=google_not_configured", 303);
  }
  const state = randomToken();
  const next = safeNext(new URL(request.url).searchParams.get("next"), "/dashboard");
  cookies.set("cuet_oauth_state", state, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  cookies.set("cuet_oauth_next", next, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return redirect(googleAuthUrl(request, state), 303);
};
