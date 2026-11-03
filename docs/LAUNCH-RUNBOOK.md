# Launch runbook

One ordered pass from a verified build to a live production domain. Full variable
details and provider steps live in `docs/EXTERNAL_SETUP.md`. Do not skip the checks in
each step; a later step assumes the previous one is working.

## 0. Preflight (before touching DNS)

```sh
npm ci
npm test
npx astro check
npm run build
```

- Confirm the local D1 migrations are applied and the remote schema matches:
  `npx wrangler d1 migrations apply cuet-blueprint-db --remote`.
- Confirm the ranked library contains only reviewed content. The intended launch state
  is one reviewed mock; the OCR papers stay unranked, with only their detail pages
  indexable and the hub and timed runner `noindex`.
- Confirm the legal pages (About, Contact, Privacy, Terms, Disclaimer) are live and the
  privacy text matches the integrations you are about to enable.
- Record the current staging Worker version and the Git commit being promoted.

## 1. Domain and DNS

1. Register the production domain. Add the zone to Cloudflare and set the registrar's
   nameservers to the Cloudflare pair.
2. Wait until the zone status is **Active** and the nameservers resolve publicly.
3. Do not attach the custom domain until DNS is active; this avoids certificate
   retries and a half-configured origin.

## 2. Worker custom domain and `SITE_URL`

1. In Workers & Pages, open `cuet-astro` → Settings → Domains & Routes → add the apex
   and `www` hostnames as required. Cloudflare creates DNS records and certificates.
2. Set `SITE_URL` to the canonical HTTPS origin (no trailing slash). Pick one hostname
   as canonical and redirect the other at the edge if both are attached.
3. Deploy the production configuration.
4. Verify:
   - `/` returns 200 over HTTPS.
   - `canonical` and `og:url` use the production origin.
   - `/sitemap.xml` and `/robots.txt` use the production origin.
   - An unknown path returns the branded 404, not a Worker exception.
5. Keep the previous Worker version noted for rollback.

## 3. Google OAuth

1. Add `https://<production-domain>/api/auth/google/callback` to the Google OAuth
   client's authorised redirect URIs. Keep the staging and localhost URIs.
2. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as Worker secrets.
3. Deploy or confirm the active version uses the new secrets.
4. Test sign-in on the production origin and confirm the account lands on the dashboard
   with a session. Test the cancel path as well.
5. If the button is missing, one of the two values is absent; email/password must still
   work while you fix it.

## 4. Transactional email

1. Verify the sending domain with Resend or Brevo, including SPF, DKIM and DMARC.
2. Set `EMAIL_PROVIDER`, `EMAIL_FROM`, and the matching provider secret
   (`RESEND_API_KEY` or `BREVO_API_KEY`).
3. Ensure `DEV_SHOW_RESET_LINK` is empty in production.
4. Deploy and request a reset for a real test account. Confirm the email arrives, the
   link works once, and an expired link is rejected.
5. Confirm the API returns HTTP 503 and the page shows the support notice when the
   provider is deliberately unset. Restore the configuration afterwards.

## 5. Cloudflare Access and admin roles

1. Create the Access application for the production hostname covering `/admin` and
   `/api/admin`.
2. Add an allow policy for the operators. Record the AUD tag and team domain.
3. Set `ADMIN_AUTH_MODE=access`, `CF_ACCESS_TEAM_DOMAIN`, and `CF_ACCESS_AUD`.
4. Ensure each operator has an active `admins` row with the least-privilege role.
5. Deploy and verify:
   - `/admin` without an Access session is denied.
   - An allowed operator reaches the dashboard.
   - An authenticated non-admin is refused.
   - The audit log records an admin action.
6. Remove or disable any temporary session-mode admin credentials after cutover.

## 6. Search Console and analytics

1. Add the production property in Search Console and verify it using the meta tag from
   `GSC_VERIFICATION` (or DNS verification).
2. Set the Cloudflare Web Analytics token in `CF_ANALYTICS_TOKEN` if you want the
   beacon. Disable automatic dashboard injection to avoid double counting.
3. Deploy.
4. Confirm the verification meta tag and analytics beacon appear only after their
   variables are set. View source with both unset to confirm nothing is emitted.
5. Submit `https://<production-domain>/sitemap.xml` and check the first crawl report.
6. Confirm `/blog` remains `noindex` until a complete guide is published, and that
   attempt/result/dashboard/admin routes stay out of the index.

## 7. AdSense (only after content review and approval)

1. Apply to AdSense and complete site review. Do not add the script before approval.
2. Configure a Google-certified consent mechanism for regions that require it.
3. Set `ADSENSE_CLIENT` and `ADSENSE_SLOT_ID`.
4. Deploy and verify `/ads.txt` returns the publisher record.
5. Check a content page: one unit, labelled, no layout overflow. Check `/attempt/*` and
   `/result/*`: no AdSense script and no `<ins>` unit.
6. Watch policy and performance reports for the first week; remove the slot by clearing
   `ADSENSE_SLOT_ID` if fill or layout is poor.

## 8. Backups

1. Make the GitHub repository private if it is not already.
2. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as Actions secrets.
3. Run the **D1 backup** workflow manually. Confirm it creates a non-empty artifact and
   does not commit a dump.
4. Remove one secret temporarily and confirm the workflow skips with a notice rather
   than failing. Restore the secret.
5. Record where the artifact is stored and who can access it.

## 9. Production QA and sign-off

```sh
STAGING_BASE_URL=https://<production-domain> \
STAGING_ADMIN_EMAIL=<operator> \
STAGING_ADMIN_PASSWORD=<password> \
npm run smoke:staging
```

- Run the accessibility audit against production with an Access-capable admin session.
- Run Lighthouse mobile on `/`, `/cuet-ug-mock-test` and a mock detail page.
- Complete one guest attempt, one signed-in attempt, one resume and one submit on a real
  phone or throttled connection. Confirm the timer, autosave and server-scored result.
- Confirm the rollback Worker version and the D1 backup are both available.
- Update `docs/PROGRESS.md` with the production version, date and any remaining
  editorial blockers.

## Rollback

If a release fails, route the custom domain back to the previous Worker version in
Cloudflare. D1 migrations are additive; do not reverse a migration on production
without a tested down-script. Restore content from the most recent verified artifact if
a data change is at fault, and keep the failed version available for diagnosis.
