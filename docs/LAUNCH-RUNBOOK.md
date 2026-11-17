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
3. Set `GA4_MEASUREMENT_ID` if you want optional Google Analytics 4. Leave it empty to
   ship no Google analytics script and no consent banner.
4. Deploy.
5. Confirm the verification meta tag and Cloudflare beacon appear only after their
   variables are set. View source with both unset to confirm nothing is emitted.
6. Open a public page in a clean browser profile. Before a choice, there must be no
   `googletagmanager.com` request and the consent banner must be visible. Reject, reload
   and confirm no request. Clear the site's storage, allow analytics and confirm one
   `gtag/js` request that persists across reloads. Reopen the banner from the footer
   control and confirm rejection clears `_ga*` and reloads.
7. Confirm no banner, analytics request or openable privacy control appears on
   `/attempt`, `/result`, `/dashboard`, `/admin`, auth or `/search`.
8. Submit `https://<production-domain>/sitemap.xml` and check the first crawl report.
9. Confirm `/blog` remains `noindex` until a complete guide is published, and that
   attempt/result/dashboard/admin routes stay out of the index.

## 7. AdSense (only after content review and approval)

1. Apply to AdSense and complete site review. Do not add the script before approval.
2. Configure a Google-certified consent mechanism for regions that require it. The
   first-party analytics gate does not satisfy this.
3. Set `ADSENSE_CLIENT` and `ADSENSE_SLOT_ID`.
4. After the CMP is verified live, set `ADSENSE_CMP_ACTIVE=1`. Setting only the client
   and slot is not sufficient: the loader and every ad unit stay off without this
   attestation.
5. Deploy and verify `/ads.txt` returns the publisher record.
6. Check a content page: one unit, labelled, no layout overflow. Check `/attempt/*` and
   `/result/*`: no AdSense script and no `<ins>` unit.
7. Watch policy and performance reports for the first week; remove the slot by clearing
   `ADSENSE_SLOT_ID` or `ADSENSE_CMP_ACTIVE` if fill or layout is poor.

## 8. Staging release path

Staging is a separate Worker (`cuet-astro-staging`) and D1 database
(`cuet-d1-staging`). The **Deploy staging** workflow imports the committed practice
library, deploys the Worker and runs the smoke check; production resources are never
touched.

1. Make sure `CLOUDFLARE_API_TOKEN` has **D1 Edit** as well as Workers and KV write.
   Without D1 permission the migration step fails with Cloudflare error `7403` even
   though the Worker itself could deploy.
2. Dispatch **Deploy staging** from `main` or a `release/*` branch with
   `confirm=deploy-staging`.
3. The committed staging `SITE_URL` is the workers.dev origin until
   `staging.cuetfreemocktest.com` has a DNS record; switch it back and add the
   custom hostname to the Google OAuth redirect URI list once DNS is fixed.
4. Staging responses carry `X-Robots-Tag: noindex, nofollow` and `robots.txt` disallows
   every crawler while `ENV=staging`; do not remove that guard for convenience.
5. Google sign-in on staging needs `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` on the
   staging Worker. Without them `/api/auth/google` returns
   `/login?error=google_not_configured`.
6. The staging D1 database is on the free tier. A full import plus explanation
   backfill can exhaust the daily row-write limit (`7500`); writes then fail until
   midnight UTC. Do not re-run imports just to clear a transient error.

## 9. Production release path

Production data is **Turso**, not D1. The `Deploy production` workflow and the
`db:migrate:remote` / `db:import:*:remote` scripts still target the unused D1 binding;
do not treat them as production data steps.

1. Fetch the release commit and confirm `npm test`, `npm run build` and the E2E suite
   pass on it.
2. Apply pending Turso migrations and verify: `npm run db:turso:migrate` then
   `npm run db:turso:verify`.
3. Deploy the Worker with `npm run deploy` from the release checkout. This builds the
   production environment and never touches staging.
4. Smoke test `https://cuetfreemocktest.com`: `/api/health` must report
   `"engine":"turso"`, and `/`, `/mock-tests`, `/sitemap.xml` and one mock instruction
   page must return 200.
5. Do not push `main` to release the code unless you intend the `Auto deploy production`
   workflow to run. A `[skip deploy]` marker in the commit subject suppresses it, but an
   explicit `npm run deploy` is easier to review.

## 10. Backups

1. Make the GitHub repository private if it is not already.
2. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as Actions secrets.
3. Run the **D1 backup** workflow manually. Confirm it creates a non-empty artifact and
   does not commit a dump.
4. Remove one secret temporarily and confirm the workflow skips with a notice rather
   than failing. Restore the secret.
5. Record where the artifact is stored and who can access it.

## 11. Production QA and sign-off

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
