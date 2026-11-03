import type { APIRoute } from "astro";
import { createSession, GUEST_COOKIE } from "../../../../lib/auth/session";
import { exchangeGoogleCode, fetchGoogleProfile, isGoogleConfigured } from "../../../../lib/auth/oauth";
import {
  claimGuestAttempts,
  createGoogleUser,
  findUserByEmail,
  findUserByGoogleId,
  linkGoogleUser,
} from "../../../../lib/auth/users";
import { safeNext, withQuery } from "../../../../lib/http";

function fail(message: string): Response {
  return new Response(null, {
    status: 303,
    headers: { location: `/login?error=${encodeURIComponent(message)}` },
  });
}

export const GET: APIRoute = async ({ request, cookies }) => {
  if (!isGoogleConfigured()) return fail("google_not_configured");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = cookies.get("cuet_oauth_state")?.value;
  const next = safeNext(cookies.get("cuet_oauth_next")?.value, "/dashboard");

  cookies.delete("cuet_oauth_state", { path: "/" });
  cookies.delete("cuet_oauth_next", { path: "/" });

  if (!code) return fail("google_cancelled");
  if (!state || !expectedState || state !== expectedState) return fail("google_state");

  const exchange = await exchangeGoogleCode(request, code);
  if ("error" in exchange) return fail("google_token");

  const profile = await fetchGoogleProfile(exchange.accessToken);
  if (!profile) return fail("google_profile");
  if (!profile.emailVerified) return fail("google_email_unverified");

  let user = await findUserByGoogleId(profile.sub);
  if (!user) {
    const existing = await findUserByEmail(profile.email);
    if (existing) {
      if (existing.deleted_at) return fail("account_disabled");
      await linkGoogleUser(existing.id, profile.sub, profile.picture);
      user = existing;
    } else {
      user = await createGoogleUser({
        email: profile.email,
        googleId: profile.sub,
        username: profile.name?.replace(/\s+/g, "_") ?? undefined,
        avatarUrl: profile.picture,
      });
    }
  }
  if (user.deleted_at) return fail("account_disabled");

  await createSession(cookies, user.id);
  const claimed = await claimGuestAttempts(user.id, cookies.get(GUEST_COOKIE)?.value);
  cookies.delete(GUEST_COOKIE, { path: "/" });

  return new Response(null, {
    status: 303,
    headers: { location: claimed > 0 ? withQuery(next, "claimed", String(claimed)) : next },
  });
};
