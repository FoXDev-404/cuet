import { env } from "cloudflare:workers";
import { googleConfigured } from "./oauth-config";

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

export function isGoogleConfigured(): boolean {
  return googleConfigured(env);
}

function googleCredentials(): { id: string; secret: string } {
  const id = (env.GOOGLE_CLIENT_ID ?? "").trim();
  const secret = (env.GOOGLE_CLIENT_SECRET ?? "").trim();
  if (!id || !secret) {
    throw new Error("Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  }
  return { id, secret };
}

export function googleRedirectUri(request: Request): string {
  return new URL("/api/auth/google/callback", request.url).toString();
}

export function googleAuthUrl(request: Request, state: string): string {
  const credentials = googleCredentials();
  const params = new URLSearchParams({
    client_id: credentials.id,
    redirect_uri: googleRedirectUri(request),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    access_type: "online",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(
  request: Request,
  code: string,
): Promise<{ accessToken: string } | { error: string }> {
  if (!isGoogleConfigured()) return { error: "Google login is not configured." };
  const credentials = googleCredentials();
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: credentials.id,
        client_secret: credentials.secret,
        redirect_uri: googleRedirectUri(request),
        grant_type: "authorization_code",
      }),
    });
    if (!response.ok) return { error: "Google rejected the login request." };
    const data = (await response.json()) as { access_token?: string };
    if (!data.access_token) return { error: "Google did not return an access token." };
    return { accessToken: data.access_token };
  } catch {
    return { error: "Could not reach Google. Try again." };
  }
}

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile | null> {
  try {
    const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${accessToken}` },
      cf: { cacheTtl: 0, cacheEverything: false },
    } as RequestInit);
    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, unknown>;
    if (typeof data.sub !== "string" || typeof data.email !== "string") return null;
    return {
      sub: data.sub,
      email: data.email,
      emailVerified: data.email_verified === true,
      name: typeof data.name === "string" ? data.name : null,
      picture: typeof data.picture === "string" ? data.picture : null,
    };
  } catch {
    return null;
  }
}
