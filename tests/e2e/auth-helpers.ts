/**
 * Shared E2E auth helpers.
 *
 * Email/password auth has been retired from the product — sign-in is Google
 * OAuth only. Tests cannot drive real Google flows, so they seed users and
 * sessions directly into the local D1 database and attach the session cookie
 * to their Playwright contexts. The session id stored in D1 is the SHA-256
 * hex of the cookie token, matching src/lib/auth/session.ts.
 */
import { createHash, randomBytes } from "node:crypto";
import { executeLocalD1WithRetry, queryLocalD1 } from "../../scripts/lib/local-d1.mjs";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:4321";

export const SESSION_COOKIE = "__Host-cuet_session";
export const LEGACY_SESSION_COOKIE = "cuet_session";

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function d1Rows<T>(sql: string): T[] {
  return queryLocalD1<T>(sql);
}

export type SeededUser = {
  email: string;
  username: string;
  /** Set this cookie on a BrowserContext or pass it as a Cookie header on API requests. */
  token: string;
};

/**
 * Inserts the user (and optionally an admins row) if missing, creates a live
 * session, and returns the cookie token. Existing rows are never overwritten,
 * so admin edits made during a test stay intact.
 */
export function seedUser(options: {
  email: string;
  username?: string;
  admin?: boolean;
  role?: "super" | "editor" | "moderator" | "contributor";
}): SeededUser {
  const email = options.email.toLowerCase();
  const username = options.username ?? `e2e_${email.split("@")[0].replace(/[^a-z0-9_]/gi, "_").slice(0, 24)}`;

  executeLocalD1WithRetry(
    `INSERT OR IGNORE INTO users (username, email, password_hash, created_at)
     VALUES (${sqlString(username)}, ${sqlString(email)}, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));`,
  );
  if (options.admin) {
    executeLocalD1WithRetry(
      `INSERT OR IGNORE INTO admins (email, role, is_active, created_at)
       VALUES (${sqlString(email)}, ${sqlString(options.role ?? "super")}, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));`,
    );
  }

  const rows = d1Rows<{ id: number }>(`SELECT id FROM users WHERE email = ${sqlString(email)}`);
  const userId = rows[0]?.id;
  if (!userId) throw new Error(`Could not seed the user row for ${email}`);

  const token = randomBytes(32).toString("hex");
  const sessionId = createHash("sha256").update(token).digest("hex");
  executeLocalD1WithRetry(
    `INSERT OR IGNORE INTO sessions (id, user_id, expires_at) VALUES (${sqlString(sessionId)}, ${userId}, datetime('now', '+30 days'));`,
  );

  return { email, username, token };
}

/** Cookie object for BrowserContext.addCookies / APIRequestContext cookies. */
export function sessionCookie(token: string): {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
} {
  return {
    name: SESSION_COOKIE,
    value: token,
    domain: new URL(BASE_URL).hostname,
    path: "/",
    secure: true,
  };
}

/** Cookie header for APIRequestContext calls created without a browser context. */
export function sessionHeader(token: string): Record<string, string> {
  return { cookie: `${SESSION_COOKIE}=${token}` };
}

/** Creates a fresh session for an existing seeded user and returns the token. */
export function sessionTokenFor(email: string): string {
  const emailLower = email.toLowerCase();
  const rows = d1Rows<{ id: number }>(`SELECT id FROM users WHERE email = ${sqlString(emailLower)}`);
  const userId = rows[0]?.id;
  if (!userId) throw new Error(`No user row for ${email} — call seedUser first.`);
  const token = randomBytes(32).toString("hex");
  const sessionId = createHash("sha256").update(token).digest("hex");
  executeLocalD1WithRetry(
    `INSERT OR IGNORE INTO sessions (id, user_id, expires_at) VALUES (${sqlString(sessionId)}, ${userId}, datetime('now', '+30 days'));`,
  );
  return token;
}
