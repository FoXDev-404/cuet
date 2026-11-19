/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

declare namespace App {
  interface Locals {
    user: import("./lib/auth/session").SessionUser | null;
    admin: import("./lib/auth/admin").AdminUser | null;
  }
}

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    /**
     * Turso Cloud credentials. When `TURSO_DATABASE_URL` is present the app
     * talks to Turso over libSQL and the D1 binding stays as a rollback path.
     */
    TURSO_DATABASE_URL?: string;
    TURSO_AUTH_TOKEN?: string;
    MEDIA_KV: KVNamespace;
    MEDIA_R2?: R2Bucket;
    MEDIA_PUBLIC_URL?: string;
    ASSETS?: Fetcher;
    SITE_URL: string;
    /**
     * Optional loopback origin for local preview parity. When set on a
     * localhost request, canonical-host and trailing-slash redirects run as
     * they do in production. Never set this in production.
     */
    PREVIEW_CANONICAL_ORIGIN?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    DEV_SHOW_RESET_LINK?: string;
    ADMIN_AUTH_MODE?: string;
    ADMIN_ALLOW_SESSION_IN_PROD?: string;
    CF_ACCESS_TEAM_DOMAIN?: string;
    CF_ACCESS_AUD?: string;
    /** Legacy aliases retained during the Access variable rename. */
    ACCESS_TEAM_DOMAIN?: string;
    ACCESS_AUD?: string;
    EMAIL_PROVIDER?: string;
    EMAIL_FROM?: string;
    RESEND_API_KEY?: string;
    BREVO_API_KEY?: string;
    CF_ANALYTICS_TOKEN?: string;
    GSC_VERIFICATION?: string;
    ADSENSE_CLIENT?: string;
    ADSENSE_SLOT_ID?: string;
    ADSENSE_CMP_ACTIVE?: string;
  }
}
