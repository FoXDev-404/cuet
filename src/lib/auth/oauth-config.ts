/**
 * Google OAuth configuration detection. The button is hidden unless both a
 * client id and secret are present; email/password login always remains.
 */

export type GoogleOAuthEnv = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
};

export function googleConfigured(envLike: GoogleOAuthEnv): boolean {
  return Boolean(
    (envLike.GOOGLE_CLIENT_ID ?? "").trim() && (envLike.GOOGLE_CLIENT_SECRET ?? "").trim(),
  );
}
