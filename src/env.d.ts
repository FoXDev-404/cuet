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
    MEDIA_KV: KVNamespace;
    MEDIA_R2?: R2Bucket;
    MEDIA_PUBLIC_URL?: string;
    ASSETS?: Fetcher;
    SITE_URL: string;
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
  }
}
