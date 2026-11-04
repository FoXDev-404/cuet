# CUET Astro deployment and backup runbook

This document covers the Astro SSR app at the repository root. The legacy Next.js app
has been retired.

## Bindings and environments

| Resource | Binding | Local dev | Production |
| --- | --- | --- | --- |
| D1 | `DB` | `.wrangler/state` | `cuet-blueprint-db` (`77ed64bd-006b-475b-9389-504c1639ced8`) |
| KV (sessions) | `SESSION` | `.wrangler/state` | `cuet-astro-session` (`7ea138189e80421db764cab62751e577`) |
| KV (media) | `MEDIA_KV` | `.wrangler/state` | `cuet-astro-media` (`0c268f3ee06c4ee6928493f58c6e0f46`) |
| R2 (media, optional) | `MEDIA_R2` | not bound | not bound until R2 is enabled |
| Static assets | `ASSETS` | `dist/` | Worker assets |

Media uploads use `MEDIA_R2` when that binding exists and fall back to `MEDIA_KV`
otherwise. R2 is not enabled on this account yet, so KV is the live store and D1 keeps
the searchable metadata in `media_assets`. The question editor downscales images over
250 KB to at most 1600 px and encodes them as WebP in the browser before upload; the
Worker independently validates real bytes, the 500 KB ceiling and pixel dimensions.
When R2 becomes available, bind it as `MEDIA_R2`, set `MEDIA_PUBLIC_URL` to the custom
image host (for example `https://img.cuetfreemocktest.com`), and copy existing objects
before removing KV.

`wrangler.jsonc` pins `compatibility_date` to `2026-10-30`; newer dates fail with the
installed workerd. Change it only after upgrading Wrangler/workerd together.

## Required secrets and variables

Full provider steps, accepted formats and verification commands live in
`docs/EXTERNAL_SETUP.md`; the cutover order is in `docs/LAUNCH-RUNBOOK.md`.

Set credentials with `npx wrangler secret put <NAME>` (never commit real values):

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth web client. Staging values
  are set as Worker secrets. Authorised redirect URI:
  `https://<host>/api/auth/google/callback` for every host used (workers.dev staging
  and the final domain). Add the production origin and redirect URI to the same Google
  client before cutover. Keep both names in secrets only; do not also declare them
  under `vars`, or Cloudflare rejects the duplicate binding. When absent, the Google
  button is hidden and email/password login still works.
- `RESEND_API_KEY` or `BREVO_API_KEY` — transactional email credential. Select the
  provider with `EMAIL_PROVIDER=resend|brevo` and set `EMAIL_FROM` to a verified sender
  such as `CUET Free Mock Test <no-reply@cuetfreemocktest.com>`. Until a provider is
  configured, password reset returns a clear 503 and the form is disabled in production.
  `DEV_SHOW_RESET_LINK=true` is honoured only in non-production builds; never set it on
  a production deployment.
- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub Actions secrets for the
  scheduled backup workflow. The repository must be private because Actions artifacts
  containing D1 dumps are not private on a public repository; the workflow skips with a
  notice when the secrets or a private repository are missing.

Admin authentication has two modes, selected by `ADMIN_AUTH_MODE`:

- `session` — the built-in `/login` form and an admin allow-list row in `admins`.
  This is the staging and local fallback only.
- `access` — Cloudflare Access. The Worker verifies the `Cf-Access-Jwt-Assertion`
  header with the team JWKS, issuer, audience and expiry. Set
  `CF_ACCESS_TEAM_DOMAIN` (for example `https://your-team.cloudflareaccess.com`) and
  `CF_ACCESS_AUD`. The legacy `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` names still work, but
  `CF_ACCESS_*` wins when both are present. Production must use this mode; `session`
  remains available on staging until the Access application and DNS exist.

`ADMIN_AUTH_MODE` lives in `wrangler.jsonc` for local/staging. Change it to `access`
for production and redeploy. Unknown or malformed tokens fail closed; there is no
implicit fallback from Access to a session.

`SITE_URL` is the runtime canonical origin. `src/lib/site-url.ts` reads the Worker
binding for canonicals, Open Graph, JSON-LD, the sitemap and `robots.txt`; local dev
falls back to the request origin, so a local build never emits a deployed host.
Production must set `SITE_URL`; a missing or invalid value throws a clear error
instead of silently shipping the wrong canonical host. An optional per-page override
lives in `page_seo.canonical_url`. Overrides must be absolute `http` or `https` URLs
and are validated by `src/lib/canonical.ts` before they are saved.

Optional public integrations are inert unless configured:

- `CF_ANALYTICS_TOKEN` injects the Cloudflare Web Analytics beacon when it is a plausible
  token. No beacon is emitted for an empty or malformed value.
- `GSC_VERIFICATION` emits the Search Console meta tag. The bare token,
  `google-site-verification=<token>` and a full meta tag are accepted.
- `ADSENSE_CLIENT` loads AdSense only on pages that explicitly opt in with the
  `BaseLayout` `ads` prop. `ADSENSE_SLOT_ID` adds one labelled manual unit. Both values
  are required for a unit; `/ads.txt` is generated from `ADSENSE_CLIENT` and returns 404
  while unset. Attempt, result, dashboard, admin, auth, search, practice and profile
  routes are blocked by a second route guard. Ads must never appear on an active test,
  an in-progress result or a thin page.

Both KV namespaces are declared explicitly, including `SESSION`. Without an explicit
`id`, remote preview sessions fail with `SESSION bindings must have an "id" field`.

## OCR previous-year practice library

The unranked practice library holds 106 CUET/CUCET papers from 2021–2025 across 11
subjects. `src/data/local-papers/index.json` is the paper index;
`src/data/local-papers/keys.json` (server-only) holds printed keys and explanations;
each paper's public JSON lives under `public/local-papers/papers/` and its exact
printed-page crops under `public/local-papers/assets/<slug>/`. The library is loaded at
module scope, so it needs no D1 migration, seed or upload step. Changing a paper is a
code change and a redeploy.

`tools/ocr/_build_local_papers.py` regenerates the whole library from the PaddleOCR-VL
export that must first be restored into `tools/ocr/OCR DATA` (raw exports are
archived outside the repository and ignored by git); `tools/ocr/_validate_library.py`
checks every referenced asset, key and count. Run both after any OCR or parser change.
The build removes stale crops so the published asset tree contains only files a
surviving question references.

- `/mock-tests` is the library hub, `/mock-tests/<slug>` is the paper detail page
  (indexable only once its rights status is cleared), and `/mock-tests/<slug>/take`
  permanently redirects into the ranked `/mock/<slug>/instructions` flow.
- `/practice`, `/practice/<slug>`, `/mock-test` and `/mock-test/<slug>` permanently
  redirect to the matching `/mock-tests` URL, preserving the query string, so old
  links and search results keep working.
- `/mock/<local-slug>` and `/mock/<local-slug>/instructions` permanently redirect to
  the matching `/mock-tests/<slug>` detail page, so old links keep working.
- Previous-year papers run on the same ranked D1 attempt engine as platform mocks:
  starting a paper creates an attempt with a server deadline, answers autosave to D1,
  and submitting grades on the server with the paper's +5 / -1 marking. Results appear
  in dashboard history and the first submitted attempt counts on the leaderboard.
- Correct options and explanations are never included in the attempt payload; they are
  returned only after submission.
- Every paper page labels the paper as OCR-recovered. Papers without cleared rights
  stay `noindex` and ad-free, and must not be promoted in search until provenance,
  rights and editorial review are documented.
- The homepage surfaces the previous-year library through the `/mock-tests` cards; the
  library count and "ready to score" totals come from the committed paper index.

The JSON is an OCR recovery draft, not a verified question bank. The current build has
5,322 recovered questions and 4,861 with a matched printed key; the other 461 stay
pending and unscored, including all of CUCET 2021 and four 2022–2024 papers with no
recoverable key. Spot-check questions and keys before presenting the library as
official past papers.

## Theme and brand shell

The brand palette is violet (`brand-*`) with mint (`accent-*`) highlights on navy
`ink-*` surfaces. The header, navbar and homepage hero follow the stored theme: the
header is white and the hero is soft violet/mint in light mode, while both return to
navy in dark mode. The footer is always dark. When no theme is stored, the app
defaults to dark. The `BrandLogo` component renders the full
`CUETFreeMockTest.com` wordmark with a highlighted `Free` and links to `/`; pass
`tone="dark"` where it sits on a permanently dark surface such as the footer.
Keep these invariants when editing `src/styles/global.css` or `BaseLayout.astro`.

## NTA-style attempt interface

The live attempt page follows the NTA CBT layout: a purple title band with the full
`CUETFreeMockTest.com` wordmark and a mint `Free`, a lavender paper line, the
`Question No. N` heading and rule, numbered options with radio controls, and a
right-hand Question Palette with the five-state legend (Not Visited, Not Answered,
Answered, Marked for Review, Answered & Marked for Review). The legend counts are
mutually exclusive and sum to the total number of questions. The action bar uses the
NTA labels: Save and Next, Clear Response, Save and Mark for Review, and Mark for
Review and Next, plus Previous.

The candidate name, countdown, Submit, section tabs, language toggle, font sizing,
fullscreen and theme toggle remain available. The page stays theme-aware; on mobile
the palette slides in from the right and the action bar wraps. These are presentation
changes only: no answer keys are sent before submit, the server still owns the
deadline and scoring, and attempts remain pinned to an immutable published version.

## D1 query budget

The free plan allows 50 queries per Worker invocation and 100 bound parameters per
query. Phase G found that submit/expiry used one statement per question, so a
200-question paper could exceed the limit before scoring was written. `finalizeAttempt`
now:

1. creates missing `attempt_answers` rows with one `INSERT OR IGNORE ... SELECT`;
2. writes all correctness flags with one `CASE` update per 400 questions; and
3. merges every subject and topic statistic with one multi-row upsert per 100 rows.

The attempt client tracks answers changed since the last successful save and sends only
those. An empty save does not call the API. This keeps a full paper at a constant number
of submit statements and stops a 200-question autosave from rewriting every row.

Measured remote rows read: homepage ~110, mock hub ~44, mock detail ~46 (67 with the
discussion feed), attempt ~11–13, result ~106 (72 from the two rank counts), autosave ~8
and submit ~20–25. The 7-day top runtime queries were subject-catalogue variants at
6,588, 5,037, 4,958, 4,716 and 3,948 rows; they are bounded by the 18-subject taxonomy
and do not scan attempts, so they were left in place. Leaderboard `RANK()` (3,505/65)
and the admin attempts list (3,179/31) are indexed reads that grow with total attempts;
KV or aggregate caching is deferred until measured load justifies it.

`migrations/0007_query_budget_indexes.sql` adds
`idx_attempts_user_mock_status(user_id, mock_id, status)` and
`idx_attempts_started(started_at)`. The submit `finalize_earlier` lookup fell from 37
rows read to 4, and the admin "attempts today" count now uses `idx_attempts_started`.
Both indexes are applied locally and remotely.

## Mobile and slow-network QA

`tests/e2e/slow-network.spec.ts` runs at 390×844 with 400 ms latency, 400 kbps up/down
and 4× CPU throttling. It loads the mock hub and instructions, starts an attempt,
answers, waits for the autosave PUT, reloads and confirms the saved answer returns,
checks there is no horizontal overflow, then submits and reaches the server-scored
result. It passed locally (1.3 min) and against staging `93e99cb2` (11.8 s). The test
does not send a fake `cf-connecting-ip` header when `PLAYWRIGHT_BASE_URL` is set, because
Cloudflare rejects client-supplied values. This is a simulation; a real iOS Safari and
Android Chrome pass is still required.

Password hashing uses PBKDF2-SHA256 with 100,000 iterations. This is the maximum
Cloudflare Workers WebCrypto accepts; higher counts throw
`Pbkdf2 failed: iteration counts above 100000 are not supported`. Do not raise the
count without replacing the KDF or moving hashing off the Worker.

## First production deployment

```powershell
npm ci
npm test
npx playwright test          # requires a published mock in the target database
npm run test:a11y            # requires a running app; see script header
npm run build
npm run db:migrate:remote    # 0001 init, taxonomy seed, mock versions, content/ops
npx wrangler deploy
```

`db:migrate:remote` applies every file in `migrations/`, including `0002_seed.sql`
(taxonomy), `0002_mock_versions.sql`, `0003_content_and_ops.sql`,
`0004_immutability_guards.sql`, `0005_seo_canonical.sql`,
`0006_schema_parity.sql` and `0007_query_budget_indexes.sql`. `db:seed:remote` is only
for re-applying the idempotent taxonomy seed by hand. Do not run the seed against a
database that has edited exam facts; exam facts belong in `exam_info`, never in the
seed.

For a staging deploy, run the same build step and then the repeatable smoke suite
against the Worker URL. Credentials are read from the environment and are never
stored in the repository:

```powershell
$env:STAGING_BASE_URL="https://cuet-astro.cuet-platform.workers.dev"
$env:STAGING_ADMIN_EMAIL="<staging admin email>"
$env:STAGING_ADMIN_PASSWORD="<staging admin password>"
npm run smoke:staging
```

Verify after deploy:

1. `/`, `/cuet-ug-mock-test`, a published mock, `/leaderboard`, legal pages.
2. Register, log out, log in, start → answer → submit → result → solutions.
3. Admin login, question create/edit, bulk import preview and write, media upload,
   mock publish/correction, audit log.
4. `/robots.txt` and `/sitemap.xml` return 200 and contain only indexable pages.
5. `x-robots-tag: noindex` on `/dashboard`, `/admin`, `/attempt/*`, `/result/*`,
   `/login`, `/signup`, `/search`.
6. Security headers (`x-content-type-options`, `x-frame-options`, referrer policy,
   permissions policy) on HTML and API responses.
7. Google OAuth round-trip on the exact hostname that will be canonical.
8. Maintenance mode, `/forbidden` and the 404 page.
9. A guest attempt stays unranked until claimed; a second ranked attempt is rejected.
10. `/blog` and `/blog/<slug>` stay out of the sitemap while no guide is published;
    `/search` is always `noindex`.
11. `/mock-tests` and a local paper open, `/practice` and `/practice/<slug>` redirect
    to their `/mock-tests` equivalents, the old `/mock/<local-slug>` URL redirects,
    answers survive a reload, and submitting creates one ranked D1 attempt.
12. `/admin/seo?path=%2Fabout` saves an absolute canonical override, `/about` renders it
    in `<link rel="canonical">`, and clearing the field restores the path default.
13. `/dashboard/wrong-questions/retry` returns the key only after an answer is submitted
    and does not add a leaderboard row.

Playwright runs against local D1 by default and starts `npm run dev` itself. Setting
`PLAYWRIGHT_BASE_URL` targets a deployed Worker instead, and tests that write local D1
rows (publish, canonical override, moderator creation) skip themselves in that mode.

## Bulk question import

`/admin/questions/import` accepts CSV or JSON up to 100 rows / 1 MB. The browser reads
the file, but parsing, schema validation, image-alt checks, topic/subject rules and
duplicate detection all run on the server. The API defaults to preview:

- `POST /api/admin/questions/import` with `dry_run` omitted or `true` returns a
  per-row preview and writes nothing.
- A write requires the explicit `dry_run: false` flag.
- Invalid or duplicate rows block the whole write with HTTP 422; no partial import.
- Duplicate key is subject + normalized question text (Unicode NFKC, case and
  whitespace ignored). Superseded and soft-deleted questions are ignored so a
  corrected republish is not blocked.
- Contributors may import drafts only. Publishing statuses need `questions.publish`.
- Every successful write is one D1 batch plus one audit entry.

Before importing into production, run the preview against a recent D1 export and keep
that export until the rows have been spot-checked.

The question list exports the current filter as CSV or JSON from
`GET /api/admin/questions/export?format=csv|json&status=&subject=&topic=&year=&q=`. CSV
headers match the importer, so a corrected export can be re-imported. The import
preview also offers a JSON download of only the rejected rows. Both endpoints require
`questions.write`, send `cache-control: no-store` and are `noindex`.

## Audit feed

`GET /api/admin/audit-log` is a paginated read-only feed for super admins
(`audit.view`). Filters are `action`, `entity_type`, `entity_id`, `actor` and
`page`/`limit` (maximum 200). The `/admin/audit-log` page reads the same rows directly.
Audit entries are append-only, and deletes elsewhere remain soft deletes.

## Backup plan

D1 is the source of truth for users, attempts, questions, mocks and moderation state.
Back it up on a schedule and before every migration or content import.

### Scheduled export (GitHub Actions)

`.github/workflows/d1-backup.yml` runs daily at 02:17 UTC and on demand. It exports the
remote database with `wrangler d1 export` and keeps the SQL artifact for 30 days.
Add the two repository secrets listed above before enabling the schedule.

Manual equivalent:

```powershell
npx wrangler d1 export cuet-blueprint-db --remote --output "backup-$(Get-Date -Format yyyy-MM-ddTHH-mm-ssZ).sql"
```

Store exports outside the repository. They contain personal data (emails, password
hashes), so treat them as confidential and delete them when the retention window ends.

### Short-term recovery

Cloudflare D1 Time Travel can restore a database to an earlier bookmark. Check the
current retention window and restore limits in the Cloudflare dashboard before relying
on it. Exports remain the portable, long-term copy.

### Media

Uploaded images live in `MEDIA_KV` until R2 is enabled; D1 only stores metadata and
`media_assets` rows. For the current small library, back up new keys after an upload
session:

```powershell
npx wrangler kv key list --binding MEDIA_KV --remote
npx wrangler kv key get --binding MEDIA_KV --remote "<key>" --output "<file>"
```

If the media library grows, move bytes to R2 with versioning and lifecycle rules, then
keep KV only for metadata or cache. The storage adapter already prefers `MEDIA_R2`
when the binding exists, so the switch is a binding plus object copy, not a code fork.

### Restore drill

1. Create a scratch D1 database and apply `migrations/0001_init.sql`, the seed, and
   every later migration (or run `wrangler d1 migrations apply --local` for a local
   drill).
2. Import the newest export into the scratch database.
3. Spot-check row counts for `users`, `attempts`, `attempt_answers`, `questions`,
   `mock_tests`, `mock_test_versions`, `mock_questions`, `discussions` and
   `audit_log`.
4. Confirm a known user can log in and a known attempt loads its result, including the
   pinned mock version used for scoring.
5. Record the drill date and any mismatches.

Run a drill quarterly and after any schema migration.

#### Drill log

- **2026-10-31:** exported remote `cuet-blueprint-db` (19.7 KB), restored it into an
  in-memory SQLite database with `node:sqlite`, and ran `PRAGMA integrity_check`
  (`ok`). Restored counts: 1 user, 3 attempts, 6 answers, 2 questions, 1 published
  mock, 18 subjects, 1 admin. This validates the export format; the scheduled GitHub
  Actions run still needs repository secrets.
- **2026-10-31 (v2 schema):** exported the remote database after applying
  `0002_mock_versions.sql` and `0003_content_and_ops.sql`, then restored it with
  `node:sqlite` (foreign keys off while loading the export, as SQLite validates
  forward references). `PRAGMA integrity_check` returned `ok`. Counts: 1 user, 0
  attempts, 2 questions, 1 mock, 1 published version, 2 rows through
  `mock_questions_current`, 18 subjects, 1 admin, 1 audit row. The four migration
  names were present and no attempt lacked a `version_id` pin. The export stays
  outside the repository.
- **2026-10-31 (post-0005):** exported the remote database again after applying
  `0004_immutability_guards.sql` and `0005_seo_canonical.sql`, then restored it with
  `node:sqlite`. `PRAGMA integrity_check` returned `ok`. Counts: 1 user, 1 admin, 11
  guest attempts, 22 answers, 2 questions, 1 published mock, 1 published version, 2
  `mock_questions` rows, 1 audit row, 10 guard triggers and 0 `page_seo` overrides.
  All six migration names were present and no attempt lacked a `version_id` pin. The
  export stays outside the repository.
- **2026-10-31 (post-0006):** applied `0006_schema_parity.sql` locally and remotely.
  It is index-only: `idx_mocks_status` now matches blueprint §5.2 `(status, type)` and
  a separate `idx_mocks_status_published` keeps catalogue ordering. Verified both
  definitions in remote `sqlite_master`; no row counts or stored results changed.
- **2026-10-31 (post-0007):** applied `0007_query_budget_indexes.sql` locally and
  remotely. It is index-only:
  `idx_attempts_user_mock_status(user_id, mock_id, status)` and
  `idx_attempts_started(started_at)`. `EXPLAIN QUERY PLAN` confirms the submit
  `finalize_earlier` lookup uses a covering search on the first index and the admin
  "attempts today" count uses the second. No row counts, scores or answer rows changed.

## Staging status (2026-10-31)

Staging Worker: `https://cuet-astro.cuet-platform.workers.dev`, version
`93e99cb2-e6ba-4f39-ac6e-4cc92cf2be0f`.

Schema state: `0001_init.sql`, `0002_seed.sql`, `0002_mock_versions.sql`,
`0003_content_and_ops.sql`, `0004_immutability_guards.sql`,
`0005_seo_canonical.sql`, `0006_schema_parity.sql` and
`0007_query_budget_indexes.sql` are applied locally and remotely. Migration `0004` added
the published-version immutability triggers and supporting indexes; `0005` added
`page_seo.canonical_url`; `0006` aligned the mock catalogue index with blueprint §5.2;
`0007` added the submit/detail and attempts-today indexes. The remote database reports
10 guard triggers. A pre-migration export was taken before the v2 migrations, and the
restore drill below passed.

Verified against the deployed Worker and locally:

- `npm run smoke:staging`: 30/30 checks. Covers health, mock and subject catalogues,
  answer-key absence on mock detail, the first-attempt leaderboard contract,
  private-route `noindex`, `/500`, homepage, local practice, admin login/dashboard,
  admin APIs including the audit feed, question CSV and JSON export, the
  subject/year/status filter, idempotent publish, and a guest start → attempt UX →
  cleanup submit.
- Staging integration absence: the live Worker emitted no Cloudflare analytics beacon,
  AdSense script/unit or Search Console meta tag while the optional values were empty.
  `/ads.txt` returned 404 and `/api/auth/forgot` returned 503 with the support message.
  The Google button stayed visible because staging OAuth is configured.
- Local QA: `npx astro check` reports 0 errors over 224 files, 104 Vitest
  unit/integration tests pass, 36 Playwright E2E tests are defined (including the Phase F
  integrations spec and the Phase G slow-network spec), and the security, admin,
  API-contract, attempt-flow, integration and local-practice specs were re-run in this
  pass (35/35 passing) plus the slow-network spec 1/1 locally and 1/1 on staging. 236
  local axe scans and 240 staging axe scans on `93e99cb2` report no WCAG A/AA violations
  and no horizontal overflow, and the production build succeeds. The staging audit
  includes the authenticated discussion thread alongside the public and admin routes.
  A physical-phone pass has not been run.
- Lighthouse 13.6.0 mobile on `b1ebec63`: `/` scores 97/100/100/100,
  `/cuet-ug-mock-test` 100/100/100/100 and the mock detail page 99/100/100/100 for
  performance/accessibility/best-practices/SEO, with LCP 0.9–1.2 s, TBT 0–70 ms and
  CLS 0. `/blog` is 66 for SEO because it is correctly `noindex` until a guide is
  published.
- Playwright covers the full attempt lifecycle including resume, duplicate submit and
  deadline expiry, plus the admin path: an editor creates and publishes a mock through
  the builder, saves a canonical override that the public page renders, uploads a file
  that lies about its MIME type and is rejected, and a moderator is limited to
  moderation permissions while the hidden navigation and editor-only endpoints return
  403.
- `tests/e2e/slow-network.spec.ts` passed locally and on staging `93e99cb2`: a
  390×844 attempt loaded, answered, autosaved, resumed after reload and submitted under
  400 ms latency, 400 kbps up/down and 4× CPU throttling, with no horizontal overflow.
- D1 query-budget review: rows read per view were homepage ~110, hub ~44, mock detail
  ~46 (67 with discussion), attempt ~11–13, result ~106, autosave ~8 and submit ~20–25.
  The submit path is now constant-query instead of one statement per question, autosave
  sends only dirty answers, and migration `0007` cut the submit `finalize_earlier` read
  from 37 rows to 4 and replaced the admin attempts-today scan with an index.
- Deadline expiry is tested at the HTTP boundary: the E2E suite moves the local D1
  deadline into the past, submit returns `status: "expired"`, a repeated submit stays
  expired, and the result page renders the "Time expired" state with a server score.
- Bulk import was exercised on the deployed Worker: in-file duplicate preview, blocked
  write with HTTP 422, successful write with HTTP 201, database-duplicate preview, and
  cleanup of the QA row. Rejected-row download and filtered CSV/JSON export are
  covered by the smoke suite and admin API tests.
- Media upload wrote to `MEDIA_KV` and D1, served back byte-identical, and rejected a
  missing alt text with HTTP 400. No SVG uploads are accepted.
- Google OAuth is configured on staging with Worker secrets. `/api/auth/google`
  redirects to `accounts.google.com` with the exact staging callback, and a forged
  callback state redirects to `/login?error=google_state`. A human sign-in round-trip
  still needs to be completed in a browser.
- `PBKDF2` is capped at the Workers maximum of 100,000 iterations; signup and login
  both pass in production after the fix.
- Workers observability is enabled in `wrangler.jsonc`, so request logs and unhandled
  errors are retained in the Cloudflare dashboard. No external error tracker is bound.
- The discussion thread renders as a theme-aware Discord-style chat: stored Google
  avatars with deterministic initial fallbacks, per-user name colours, coloured reply
  connectors, reaction-style votes and a reply composer. It stays readable in light and
  dark mode, and the staging axe run includes it.

Remote baseline after the smoke runs and the staged discussion demo: 1 admin, 3 demo
learner accounts, 1 published mock, 2 published questions, guest attempts from smoke
runs, 3 ranked demo entries, audit rows including the demo moderation actions, 10 guard
triggers and 0 `page_seo` overrides. The demo learners, their attempts and their
comments are staging-only; remove them before a pristine production cutover.

Still required before cutover:

- Real-phone attempt on iOS Safari and Android Chrome over a real mobile network. The
  Playwright throttle is a simulation and does not cover browser chrome, keyboard or
  device-specific timer suspension.
- Cloudflare Access application for `/admin` and `ADMIN_AUTH_MODE=access`; rotate the
  temporary staging admin password before launch either way. The verifier and the
  `CF_ACCESS_*` variables are implemented; only the account configuration is external.
- Production Google OAuth: add the canonical origin and `/api/auth/google/callback` to
  the client's authorised origins and redirect URIs, then complete a full sign-in
  round-trip on the canonical host. The button is already hidden when OAuth is absent.
- Transactional email for password reset: choose Resend or Brevo, verify the sending
  domain, set `EMAIL_PROVIDER`, `EMAIL_FROM` and the provider secret. Until then the
  production form is disabled with a clear message and no token is logged.
- Domain registration, DNS and the final `SITE_URL` value. The code side of the runtime
  canonical resolver is complete.
- R2 enablement and media copy if the launch image library outgrows KV. The KV fallback
  uses the same upload API.
- GitHub repository privacy and the two backup-workflow secrets. The workflow now skips
  with a notice when either is missing and refuses to publish dumps from a public repo.
- Analytics, Search Console and AdSense account values. The env-gated injection and
  `ads.txt` route are implemented and tested with variable absent, malformed and present.
- Editorial review, provenance and rights checks for the OCR practice papers
  before they are presented as verified PYQs or imported into ranked D1 content.
- Alerting ownership: Workers observability is on, but no external error tracker or
  threshold alerts are configured.

The post-migration restore drill passed and is recorded above.

## Cutover checklist

- [ ] Feature parity signed off against the live Next.js app, including the bulk import
      preview/write path and duplicate blocking.
- [ ] Ranked content decision recorded: the OCR papers are editorially reviewed and
      imported with provenance, or launch explicitly accepts the starter D1 mock plus
      the unranked OCR practice library.
- [ ] `cuetfreemocktest.com` registered and DNS delegated to Cloudflare.
- [ ] Google OAuth client updated with the production origin and redirect URI, and a
      full sign-in round-trip completed on the canonical host.
- [ ] Transactional email configured and password reset tested end to end.
- [ ] Remote migrations and seed applied; content editors briefed.
- [ ] Cloudflare Access enabled for `/admin`, production `ADMIN_AUTH_MODE=access`, and
      the temporary staging admin password rotated or removed.
- [ ] R2 decision recorded: either `MEDIA_R2` bound and objects copied, or KV accepted
      for the launch library with the backup step above.
- [ ] Legal pages (`/privacy-policy`, `/terms`, `/disclaimer`, `/contact`) reviewed and
      live, including the cookie table.
- [ ] Sitemap submitted and `noindex` verified on private routes.
- [ ] Workers observability reviewed, with a named admin responsible for alerts and
      rollback.
- [ ] Scheduled D1 export succeeded at least once and a restore drill passed.
- [ ] Rollback plan: keep the existing Next.js Worker and its D1 intact for at least
      two weeks after cutover; switch the custom domain back if launch checks fail.
