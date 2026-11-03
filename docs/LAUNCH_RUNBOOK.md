# Production Launch Runbook & Operational Checklist

This document details post-domain launch operations, security activations, and infrastructure configurations required when deploying the platform to a custom production domain.

---

## 1. Domain & DNS Configuration
1. **Cloudflare Proxying:**
   - Add custom domain (e.g. `cuetfreemocktest.com`) to Cloudflare.
   - Configure apex and `www` CNAME records pointing to the Cloudflare Worker.
   - Set SSL/TLS encryption mode to **Full (strict)**.
   - Enable **Always Use HTTPS** and **Automatic HTTPS Rewrites**.
   - Enable **HTTP/3 (with QUIC)** and **0-RTT Connection Resumption**.

2. **Security & Anti-Scraping (Activate in Cloudflare Dashboard):**
   - **Bot Fight Mode:** Navigate to *Security > Bots* and toggle **Bot Fight Mode** to ON.
   - **WAF Rate Limiting Rules:** Ensure edge rate limits protect `/api/auth/*` and `/api/attempts/*`.
   - **Security Headers:** Verify HSTS, `X-Content-Type-Options: nosniff`, and frame-busting headers.

---

## 2. Admin Zero Trust Security (Cloudflare Access)
In production, session-cookie admin login is strictly blocked by middleware (`src/middleware.ts`).
1. Navigate to **Cloudflare Zero Trust Dashboard** > *Access > Applications*.
2. Create an Application protecting path `/admin*`.
3. Add Access Policy allowing only authorized administrator email addresses (with MFA).
4. Copy the Application **AUD Tag** and **Team Domain**.
5. Set the production environment variables:
   ```bash
   npx wrangler secret put CF_ACCESS_TEAM_NAME --env production
   npx wrangler secret put CF_ACCESS_AUD_TAG --env production
   ```
6. Verify `/admin` requests validate `cf-access-jwt-assertion` headers via `src/lib/auth/access.ts`.

---

## 3. Google OAuth 2.0 Credentials
1. In Google Cloud Console (*APIs & Services > Credentials*):
   - Update Authorized JavaScript Origins: `https://<your-domain>`
   - Update Authorized Redirect URIs: `https://<your-domain>/api/auth/google/callback`
2. Update production secrets:
   ```bash
   npx wrangler secret put GOOGLE_CLIENT_ID --env production
   npx wrangler secret put GOOGLE_CLIENT_SECRET --env production
   ```

---

## 4. Email Delivery (Transactional Auth & Password Reset)
1. Verify SPF, DKIM, and DMARC DNS records for your sender domain.
2. In Resend / Cloudflare Email:
   - Verify sender identity `noreply@<your-domain>`.
   - Update production secrets:
     ```bash
     npx wrangler secret put RESEND_API_KEY --env production
     ```

---

## 5. SEO & Search Console Activation
1. **Google Search Console:**
   - Verify domain property via DNS TXT record or HTML meta tag (`GOOGLE_SITE_VERIFICATION`).
   - Submit sitemap URL: `https://<your-domain>/sitemap.xml`.
2. **Robots.txt & Sitemap Verification:**
   - Run `npm run seo:check` against the production domain to verify 100% sitemap consistency.
   - Confirm `/admin/`, `/attempt/`, `/result/`, `/dashboard/`, `/dev/` are excluded.

---

## 6. Content Rights & Editorial Review
1. Prior to removing `noindex` from previous-year papers:
   - Ensure an editorial review team audits questions and keys.
   - Mark cleared papers as `cleared` in `/admin/pyq` (which automatically opens them to indexing in `sitemap.xml`).
2. Update exam fact keys in `/admin/exam-info` (specifically `important-dates`) once official NTA notices are published.

---

## 7. Automated Backups & Secrets
1. Configure GitHub Actions Repository Secrets for `.github/workflows/d1-backup.yml`:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
2. Test manual execution via `workflow_dispatch`.
