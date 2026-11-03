# External integration setup

Everything below is optional except `SITE_URL` in a deployed environment. Each
integration is inert when its variables are absent or malformed: no script, tag or
button is emitted, and no request is made. Values live in `wrangler.jsonc`
under `vars` when they are public, or as Worker secrets when they are credentials.
Local values go in `.dev.vars` (gitignored; start from `.dev.vars.example`).

## Variable reference

| Variable | Kind | Required | Effect when absent |
| --- | --- | --- | --- |
| `SITE_URL` | Public var | Yes when deployed | Local dev uses the request origin. A deployed Worker throws a clear error instead of shipping a wrong canonical host. |
| `GOOGLE_CLIENT_ID` | Secret | No | Google button hidden on login/signup; email/password still works. |
| `GOOGLE_CLIENT_SECRET` | Secret | No | Same as above. Both values are required together. |
| `EMAIL_PROVIDER` | Public var | No | Password reset by email returns a clear 503 and the form is disabled in production. |
| `EMAIL_FROM` | Public var | No | Same as above. Accepts `Name <address>` or a bare address. |
| `RESEND_API_KEY` | Secret | No | Resend cannot be selected without it. |
| `BREVO_API_KEY` | Secret | No | Brevo cannot be selected without it. |
| `DEV_SHOW_RESET_LINK` | Public var | No | Ignored in production builds. In local/staging non-production builds, `true` returns a dev-only reset link in the API response. |
| `ADMIN_AUTH_MODE` | Public var | No | Defaults to `session`. Set to `access` for JWT-only admin authentication. |
| `CF_ACCESS_TEAM_DOMAIN` | Public var | No | Access mode fails closed if missing. |
| `CF_ACCESS_AUD` | Public var | No | Access mode fails closed if missing. |
| `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` | Public var | No | Legacy aliases; `CF_ACCESS_*` wins when both are present. |
| `MEDIA_R2` | R2 binding | No | Uploads use the `MEDIA_KV` fallback. |
| `MEDIA_PUBLIC_URL` | Public var | No | R2 media is served through `/api/media/<id>`. |
| `CF_ANALYTICS_TOKEN` | Public var | No | No Cloudflare Web Analytics beacon is injected. |
| `GSC_VERIFICATION` | Public var | No | No `google-site-verification` meta tag is emitted. |
| `ADSENSE_CLIENT` | Public var | No | No AdSense loader, no ad units, and `/ads.txt` returns 404. |
| `ADSENSE_SLOT_ID` | Public var | No | The loader can run, but manual ad units render nothing until a numeric slot is set. |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | GitHub secrets | No | The scheduled backup job skips with a notice. |

Public values can be edited in `wrangler.jsonc` or the Cloudflare dashboard. Credentials
must use `npx wrangler secret put <NAME>` and must never be committed. Confirm the active
Worker version after changing secrets or vars.

## 1. Domain and `SITE_URL`

1. Register the domain and add it as a zone in Cloudflare. Point the registrar at the
   assigned Cloudflare nameservers and wait for the zone to become active.
2. Attach the production hostname to the `cuet-astro` Worker (Workers & Pages → the
   Worker → Settings → Domains & Routes → Add custom domain). Cloudflare creates the
   DNS record and certificate.
3. Set `SITE_URL` to the final HTTPS origin, with no trailing slash, for example
   `https://cuetfreemocktest.com`.
4. Deploy and verify a page's `canonical`, `og:url`, `/sitemap.xml` and `/robots.txt`
   all use that origin. A missing or invalid `SITE_URL` fails the request with a clear
   error rather than silently using `workers.dev`.

The current `wrangler.jsonc` value points at staging. Replace it for production or use a
separate Wrangler environment with its own `SITE_URL` and `vars`.

## 2. Google OAuth

1. In Google Cloud Console create (or select) a project and configure the OAuth consent
   screen. Add the site name, support email and authorised domains.
2. Create an OAuth 2.0 Client ID of type **Web application**.
3. Add authorised redirect URIs for every host you use:
   - `http://localhost:4321/api/auth/google/callback`
   - `https://<staging-host>/api/auth/google/callback`
   - `https://<production-domain>/api/auth/google/callback`
4. Set the credentials:
   ```sh
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   ```
5. Deploy. The Google button appears on `/login` and `/signup` only when both values are
   present. If either is missing, the button is hidden and email/password login remains.
6. Test a full sign-in on the final origin. A redirect mismatch usually means the exact
   callback URL is missing from the Google client.

## 3. Password-reset email (Resend or Brevo)

Password reset is intentionally disabled until a provider is configured. The API
returns HTTP 503 with a support message, and the form is disabled. No reset token is
logged. `DEV_SHOW_RESET_LINK=true` is honoured only in non-production builds.

### Resend

1. Create a Resend account and add the sending domain.
2. Add the DNS records Resend shows (SPF, DKIM, and a DMARC record for the domain).
   Wait until the domain is verified.
3. Create an API key with permission to send email.
4. Set the secret and public values:
   ```sh
   npx wrangler secret put RESEND_API_KEY
   ```
   ```jsonc
   "EMAIL_PROVIDER": "resend",
   "EMAIL_FROM": "CUET Free Mock Test <no-reply@cuetfreemocktest.com>"
   ```
5. Deploy, request a reset for a real test account, and confirm delivery and the
   one-hour link. The API always returns the same message for known and unknown
   addresses; provider failures are logged by status only.

### Brevo

1. Create a Brevo account and authenticate the sender domain.
2. Add the DKIM/SPF/DMARC records Brevo shows and wait for verification.
3. Create an API key (SMTP & API → API keys).
4. Set:
   ```sh
   npx wrangler secret put BREVO_API_KEY
   ```
   ```jsonc
   "EMAIL_PROVIDER": "brevo",
   "EMAIL_FROM": "CUET Free Mock Test <no-reply@cuetfreemocktest.com>"
   ```
5. Deploy and repeat the delivery test.

Local development can keep `EMAIL_PROVIDER` empty and use
`DEV_SHOW_RESET_LINK=true`; never set that flag on a production deployment.

## 4. Cloudflare Access for admin

1. In Cloudflare Zero Trust create an Access application for the production hostname,
   covering `/admin` and `/api/admin` (or the whole host with a bypass for public paths).
2. Add a policy that allows only the operators who should administer the site. Passwords,
   one-time PIN or an identity provider are all acceptable; the Worker only trusts a
   verified JWT.
3. Copy the application's **Application Audience (AUD) tag** and the team domain
   (`https://<team>.cloudflareaccess.com`).
4. Set:
   ```jsonc
   "ADMIN_AUTH_MODE": "access",
   "CF_ACCESS_TEAM_DOMAIN": "https://<team>.cloudflareaccess.com",
   "CF_ACCESS_AUD": "<application-aud-tag>"
   ```
5. Ensure every admin email also exists as an active row in the `admins` table with the
   intended role. Access proves identity; the D1 row grants the role.
6. Deploy and verify that `/admin` without an Access session is denied, and that a
   signed-in operator reaches the expected role. The verifier checks the JWT signature,
   issuer, audience and expiry; there is no fallback to a session cookie in `access`
   mode.

The legacy names `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` still work, but new deployments
should use `CF_ACCESS_*`.

## 5. Media on R2 (optional)

1. Enable R2 and create a bucket, for example `cuet-astro-media`.
2. Add the binding:
   ```jsonc
   "r2_buckets": [
     { "binding": "MEDIA_R2", "bucket_name": "cuet-astro-media" }
   ]
   ```
3. Connect a custom image hostname to the bucket and set `MEDIA_PUBLIC_URL`, for example
   `https://img.cuetfreemocktest.com`.
4. Deploy. `src/lib/media.ts` uses R2 when the binding exists and KV otherwise. New
   uploads go to R2. Copy existing KV objects to R2 before removing the KV fallback.

## 6. Cloudflare Web Analytics

1. In the Cloudflare dashboard open **Web Analytics**, add the production hostname, and
   copy the beacon token.
2. Set `CF_ANALYTICS_TOKEN` in `wrangler.jsonc` or the dashboard.
3. Deploy and confirm the beacon script is present only on pages you expect. The code
   emits nothing for an empty, short or malformed token.
4. If Cloudflare's automatic dashboard injection is also enabled, disable one method to
   avoid double counting. The Worker injection is the reproducible option.

Cloudflare Web Analytics is aggregate and cookie-free. No consent banner is required
for the beacon itself, but review the current Cloudflare terms for your jurisdiction.

## 7. Google Search Console

1. Add the production site as a **Domain** property (DNS verification) or a **URL-prefix**
   property (meta tag verification).
2. For meta-tag verification, copy the content value or the full meta tag. Set:
   ```jsonc
   "GSC_VERIFICATION": "<content value or full meta tag>"
   ```
   The parser accepts a bare token, `google-site-verification=<token>`, or a full
   `<meta name="google-site-verification" content="...">` tag.
3. Deploy and click **Verify** in Search Console.
4. Submit `https://<production-domain>/sitemap.xml`. The sitemap is generated from D1 and
   includes only canonical, indexable, published pages.
5. Recheck coverage after the first crawl. `/blog` stays `noindex` until a guide is
   published; attempt, result, dashboard, admin, auth and search routes stay private.

## 8. Google AdSense

Do not enable ads before the site has enough original, useful content and the legal
pages are live. Approval is not guaranteed.

1. Apply to AdSense with the production domain. Complete any identity, payment and
   site-review steps in the AdSense dashboard.
2. After approval, create a responsive display ad unit and copy its numeric slot ID.
3. Set:
   ```jsonc
   "ADSENSE_CLIENT": "ca-pub-<publisher-id>",
   "ADSENSE_SLOT_ID": "<numeric-slot-id>"
   ```
4. Deploy. The loader is emitted only on pages that opt in with the BaseLayout `ads`
   prop; currently the mock-test hub and published blog articles. `/ads.txt` is served
   automatically from `ADSENSE_CLIENT` and returns 404 while unset.
5. Configure Google's consent management platform (or another Google-certified CMP) in
   AdSense before serving ads in regions that require consent. The code does not replace
   a CMP.
6. Verify that no `adsbygoogle` script or `<ins>` unit appears on `/attempt/*`,
   `/result/*`, `/dashboard/*`, `/admin/*`, auth, search or practice routes. The route
   guard and the explicit `ads` opt-in both enforce this.

## 9. D1 backups

The workflow is `.github/workflows/d1-backup.yml`.

1. Create a Cloudflare API token with D1 read/export permission for the account and copy
   the account ID.
2. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub Actions secrets.
3. Keep the repository private. Actions artifacts inherit repository visibility, and the
   dump contains user and attempt data. The workflow skips with a warning on a public
   repository rather than uploading a public dump.
4. Run the workflow manually once and confirm the artifact contains a non-empty SQL file.
5. If the secrets are missing, the job exits successfully with a notice instead of a red
   failure. Artifacts are retained for 30 days and are never committed.

## Verification checklist

```sh
npm test
npx astro check
npm run build
```

Then, against the deployed origin:

```sh
curl -sS https://<host>/robots.txt
curl -sS https://<host>/sitemap.xml | head
curl -sS -o /dev/null -w '%{http_code}\n' https://<host>/ads.txt
```

- View source: no `cloudflareinsights`, `adsbygoogle` or `google-site-verification`
  output when the corresponding variable is empty.
- `/login` hides the Google button when OAuth is not configured.
- `/forgot-password` shows the disabled notice when neither email nor the dev flag is
  available.
- `/admin` denies access in `access` mode without a valid Access JWT.
