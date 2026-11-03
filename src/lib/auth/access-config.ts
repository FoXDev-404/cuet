/**
 * Cloudflare Access configuration parsing.
 *
 * `CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD` are the documented names.
 * `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` remain supported so existing staging
 * bindings keep working during the rename.
 */

export type AccessEnv = {
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
};

export type AccessConfig = {
  teamDomain: string;
  audience: string;
};

/** Accept a bare team domain or a full https origin; strip a trailing slash. */
export function normalizeAccessTeamDomain(raw: string | undefined): string {
  return (raw ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

export function readAccessConfig(envLike: AccessEnv): AccessConfig | null {
  const teamDomain = normalizeAccessTeamDomain(
    (envLike.CF_ACCESS_TEAM_DOMAIN ?? "").trim() ||
      (envLike.ACCESS_TEAM_DOMAIN ?? "").trim(),
  );
  const audience =
    (envLike.CF_ACCESS_AUD ?? "").trim() || (envLike.ACCESS_AUD ?? "").trim();
  if (!teamDomain || !audience) return null;
  return { teamDomain, audience };
}

/** Only the exact value `access` enables JWT-only admin authentication. */
export function accessModeEnabledFor(value: string | undefined): boolean {
  return (value ?? "").trim().toLowerCase() === "access";
}
