import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { env } from "cloudflare:workers";
import {
  accessModeEnabledFor,
  readAccessConfig,
  type AccessConfig,
} from "./access-config";

/**
 * Cloudflare Access verification for /admin and /api/admin.
 *
 * Access sits in front of the Worker in production and injects a signed
 * Cf-Access-Jwt-Assertion. We verify it against the team's JWKS and match the
 * verified email to an active admins row. A header alone is never trusted.
 */
export type AccessIdentity = { email: string };

const jwksCache = new Map<string, JWTVerifyGetKey>();

function readConfig(): AccessConfig | null {
  return readAccessConfig(env);
}

export function accessConfigured(): boolean {
  return readConfig() !== null;
}

export function accessModeEnabled(): boolean {
  return accessModeEnabledFor(env.ADMIN_AUTH_MODE);
}

function jwksFor(teamDomain: string): JWTVerifyGetKey {
  const cached = jwksCache.get(teamDomain);
  if (cached) return cached;
  const jwks = createRemoteJWKSet(
    new URL(`https://${teamDomain}/cdn-cgi/access/certs`),
  );
  jwksCache.set(teamDomain, jwks);
  return jwks;
}

export async function verifyAccessRequest(request: Request): Promise<AccessIdentity | null> {
  const config = readConfig();
  if (!config) return null;
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, jwksFor(config.teamDomain), {
      issuer: `https://${config.teamDomain}`,
      audience: config.audience,
      clockTolerance: 30,
    });
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!email) return null;
    return { email };
  } catch (error) {
    console.warn("Cloudflare Access JWT verification failed", error instanceof Error ? error.message : error);
    return null;
  }
}
