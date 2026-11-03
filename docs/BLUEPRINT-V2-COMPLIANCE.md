# Blueprint v2 compliance

Source of truth: `docs/CUET_MOCK_TEST_BLUEPRINT_v2.md`. Where v2 and earlier notes
conflict, v2 wins.
This document tracks the Astro implementation at the repository root. The legacy
Next.js app has been retired.

Snapshot: 2026-10-31. Staging Worker `https://cuet-astro.cuet-platform.workers.dev`,
version `93e99cb2-e6ba-4f39-ac6e-4cc92cf2be0f`. Schema migrations `0001_init.sql`,
`0002_seed.sql`, `0002_mock_versions.sql`, `0003_content_and_ops.sql`,
`0004_immutability_guards.sql`, `0005_seo_canonical.sql`,
`0006_schema_parity.sql` and `0007_query_budget_indexes.sql` are applied locally and
remotely. The remote database has 10 immutability/sync triggers plus the first-attempt
index.

## Phase matrix

| Phase | Status | Evidence | Open item |
| --- | --- | --- | --- |
| P0 Foundation | Complete | Astro 7.4.4, `@astrojs/cloudflare` 14.4.3, `output: "server"`, D1 + `SESSION` + `MEDIA_KV` bindings, local/remote databases, violet/mint/navy design tokens, full-domain `BrandLogo`, theme-aware header/navbar and hero, always-dark footer, responsive shell | R2 binding deferred; KV fallback is live |
| P1 Schema | Complete | `0001_init.sql`, taxonomy seed, v2 migrations through `0007_query_budget_indexes.sql`, foreign keys/indexes, `mock_test_versions`, `mock_questions_current`, `pyq_papers`, `blog_posts`; 0 missing blueprint tables/columns; blueprint-parsing schema test and populated legacy→v2 data-migration test | None |
| P2 Admin core | Complete | Access JWT verifier + role middleware, permission-aware admin navigation, question CRUD with subject/year/status filters, KaTeX preview, image upload with magic-byte checks, browser downscaling to WebP and mandatory alt text, CSV/JSON bulk import with preview, duplicate checks and rejected-row download, CSV/JSON question export, versioned mock builder with server-enforced section/question ordering and saved-draft preview, audit log page plus read-only audit API, soft delete | Cloudflare Access application not provisioned; staging uses `ADMIN_AUTH_MODE=session` |
| P3 Test engine | Complete | Instructions, attempt, result and solutions pages; NTA-style question palette with five-state legend, numbered options and NTA action bar; responsive palette drawer; autosave; server-authoritative deadline with 15-second submit grace; server scoring; no answer key before submit; attempts pin `version_id`; unit and HTTP-level expiry tests | None |
| P4 User auth | Complete | Email/password with PBKDF2, KV sessions, guest claim, login/submit/comment limits, Google OAuth code paths | Google OAuth is configured on staging; production redirect URI and consent-screen verification await the final domain |
| P5 Leaderboards | Complete | First registered attempt only, server ranking by score then time then accuracy, per-version ranking, disqualification, admin leaderboard tools | None |
| P6 Dashboard and profile | Complete (v1 subset plus) | Overview, history, weak subjects, wrong questions, private server-graded retry, bookmarks, discussions, settings, export/delete, public profiles | None |
| P7 Discussion and moderation | Complete | Finished-attempt gate, pending by default, trusted-user auto-approval after 3 approved comments, votes, reports, moderation UI, question-level preview, theme-aware Discord-style thread with stored avatars, per-user name colours and coloured reply connectors | None |
| P8 SEO and content tools | Complete | D1 sitemap, runtime `SITE_URL` origin for canonicals/OG/JSON-LD/sitemap/robots with a local request-origin fallback, canonical URLs with validated admin overrides, JSON-LD, `page_seo`, `exam_info`, blog editor, search, PYQ/topic/syllabus gating, private-route `noindex` | Content library still smaller than legacy app (below); Phase D calculator/eligibility pages not built |
| P9 Homepage | Complete | Mockup-aligned homepage: full-domain logo with mint `Free`, theme-aware hero (soft violet/mint in light mode, navy with violet glow in dark mode), theme-aware navbar, D1-only Most Popular card and two library cards with empty states, feature shortcuts, study-rhythm and focus cards, FAQ, violet CTA, dark footer; local 2022 papers appear only in a separate unranked strip | None |
| P10 QA and launch | Code complete; launch operations partial | 104 unit/integration tests, 36 Playwright E2E tests including editor publish, canonical SEO save/render, signed-in attempt IDOR, autosave idempotency, client timer tampering, comment escaping/nesting/mute/rate limits, upload-spoof and 500 KB cap rejection, moderator role boundaries, all optional integrations absent/present and the throttled mobile attempt; 236 local and 240 staging axe scans; 30-check staging smoke; D1 rows-read review with the submit path reduced to a constant query count and migration `0007` indexes; Lighthouse mobile 97-100 performance on public templates with a11y/BP/SEO 100 (blog SEO 66 by intentional noindex), security checks, restore drill, legal pages, Workers observability | Real-phone pass; domain, OAuth redirects, email credentials, Access app, analytics/Search Console values, AdSense approval, backup secrets, editorial review of OCR papers |
| P11 Post-launch | Deferred | Out of launch scope | Ads and extra features after cutover |

## Resolved P2 gap: bulk question import

The v2 admin DoD calls for CSV/JSON bulk import with a validation preview and duplicate
check. It is implemented end to end:

- UI at `/admin/questions/import` and API at `POST /api/admin/questions/import`.
- CSV (RFC 4180 quoting) and JSON (array or `{ "questions": [...] }`) up to 100 rows
  and 1 MB.
- Server-side parsing, subject resolution by ID/slug/name, header aliases, flat
  `option_a`…`option_f` columns, native JSON option arrays, letter or zero-based
  `correct_option`, image URL and alt validation.
- Safe default: `dry_run` omitted or `true` previews and writes nothing. A write needs
  explicit `dry_run: false`.
- All-or-nothing: any invalid or duplicate row returns HTTP 422 and no rows are saved.
- Duplicate key is subject + normalized question text (Unicode NFKC, case and
  whitespace ignored). Duplicates inside the file and against current D1 questions are
  both blocked. Superseded and soft-deleted questions are ignored so corrections are
  not false positives.
- Contributors can import drafts only; publishing statuses require
  `questions.publish`.
- Single create and edit also return HTTP 409 on a duplicate.
- Unit coverage in `tests/unit/question-import.test.ts`; local and staging HTTP QA
  covered preview, blocked write, successful write, database duplicate and cleanup.
- Rejected rows can be downloaded as JSON from the preview, and the question list
  exports the current filtered set as CSV or JSON through
  `GET /api/admin/questions/export`. CSV headers match the importer, including
  `option_a`–`option_f` and image fields, so an export can be corrected and
  re-imported without translation.

## Canonical overrides

`page_seo.canonical_url` (migration `0005_seo_canonical.sql`) lets an editor point a
public page at a different canonical URL without changing app code. The value must be
an absolute `http` or `https` URL and is capped at 500 characters; otherwise the API
returns HTTP 400. `src/lib/canonical.ts` owns validation and normalisation (fragments
are removed), `src/lib/seo.ts` exposes the stored value, and `BaseLayout.astro` renders
the override or falls back to the path-derived URL. Static pages and every dynamic
SEO-managed page pass the override through. The admin form at `/admin/seo` saves it,
and an E2E test writes, renders and removes an override against local D1.

## Mock builder ordering and saved-draft preview

Section and question order is enforced on the server, not just by drag-and-drop in the
browser. `/admin/mocks/[id]` submits an explicit order for every section and question,
and `src/lib/admin/mocks.ts` persists that order with the draft. The preview at
`/admin/mocks/[id]/preview` renders the last saved draft, matching what a learner will
see, while keeping correct options and explanations out of the HTML until the mock is
published and an attempt is submitted.

## Private wrong-question retry

`/dashboard/wrong-questions` links to `/dashboard/wrong-questions/retry`, a private,
`noindex` retry flow. The page requests one question at a time and grades through
`POST /api/me/wrong-questions/retry`; the response omits the key and explanation until
the answer is submitted. Retry results are not attempts, never write leaderboard rows
and never affect first-attempt ranking.

## Media dimensions

Uploaded images store width and height in `media_assets`. Attempt, solutions, preview
and retry pages resolve `/api/media/{id}` URLs through `src/lib/media-dimensions.ts`
and emit `width`/`height` attributes, so images reserve space and do not shift layout.

## Admin audit trail

Every admin write records an `audit_log` row with actor, action, entity and a
sanitised diff. The super-admin page `/admin/audit-log` is backed by the read-only
`GET /api/admin/audit-log` endpoint, which supports pagination plus `action`,
`entity_type`, `entity_id` and actor-email filters. The feed is `noindex`, requires
`audit.view`, and never returns password hashes, tokens or full private payloads.

## OCR previous-year practice library (unranked)

106 CUET/CUCET papers from 2021–2025 across 11 subjects are bundled as JSON.
`src/data/local-papers/index.json` is the index, `src/data/local-papers/keys.json`
(server-only) holds printed keys, and `public/local-papers/papers/` plus
`public/local-papers/assets/` hold the app-loadable paper JSON and exact page crops.
The homepage, PYQ pages, mock-test pages and subject pages link to them as a separate
practice library. This library is deliberately outside the ranked D1 content model:

- No D1 rows are created: no attempts, answers, bookmarks, dashboard history or
  leaderboard entries.
- `/practice` is the `noindex` hub, `/practice/<slug>` is the indexable detail page and
  `/practice/<slug>/take` is the `noindex` runner. Old `/mock/<local-slug>` URLs
  permanently redirect to the detail page.
- Each paper runs for 45 minutes (General Test papers use 60) and is graded on the
  server with +5 / -1 marking via `POST /api/practice/<slug>/submit`. Correct options
  and explanations are absent from the take view and are returned only after submission.
- Answers, deadline and result live in `sessionStorage` for that browser tab. Retake
  clears the entry; clearing storage loses the result.
- Every page labels the paper as OCR practice and unranked.
- The homepage hero, Most Popular card and both library cards read only from D1 and
  keep explicit empty states. The OCR papers appear only in a separate amber
  strip labelled unranked; they are never shown as popular mocks or ranked library
  rows.

Blueprint v2 requires ranked questions to live in D1. These JSON papers are explicitly
local-only and cannot affect first-attempt leaderboards, so they complement the D1
library without changing the scoring or ranking invariants.

The JSON is an OCR recovery draft, not a verified question bank. The current build has
5,322 recovered questions and 4,861 with a matched printed key; 461 remain unscored and
pending, including all of CUCET 2021. Editorial review is required before these papers
can be treated as official past papers or imported into D1.

## Verified invariants

- No correct option, explanation or answer key is returned to the attempt page or its
  API before submit. Solutions appear only after submission.
- The timer and score are server-authoritative; client edits cannot extend the deadline
  or change the score.
- Attempts pin the published mock version used for scoring. Corrections create a new
  version and leave historical attempts untouched; `0004_immutability_guards.sql`
  also rejects edits or deletes of published versions and their question links at the
  D1 layer, not just in application code.
- Expired attempts are settled exactly once with a conditional status update. A late
  submit returns `status: "expired"`, repeated submits stay idempotent, and expired
  attempts never enter the leaderboard.
- Leaderboards rank only the first submitted attempt by a registered user. Guest
  attempts stay unranked until claimed, and expired attempts never rank.
- Private, attempt, result, admin, auth, dashboard and search routes are `noindex`;
  `robots.txt` disallows them as well.
- Cross-origin writes are rejected; guest and signed-in IDOR probes return 404, uploads
  are checked by magic bytes and a 500 KB cap, SVG is rejected, and PBKDF2 stays at the
  Workers maximum of 100,000 iterations.
- Autosave is idempotent: replaying the same PUT or PATCH payload updates the existing
  `attempt_answers` row instead of creating a duplicate.
- Comment bodies are entity-escaped before rich-text rendering, replies are limited to
  one level, muted accounts are blocked and posting is rate-limited per account.
- Optional analytics, Search Console and AdSense output is absent unless a valid value is
  configured. AdSense is opt-in per page and blocked on attempt, result, dashboard,
  admin, auth, search, practice and profile routes; `/ads.txt` is 404 while unset.
- Password reset is disabled with a clear message when no email provider or
  non-production dev link is configured; production never returns or logs a reset token.
- Admin writes create `audit_log` rows; deletes are soft deletes.
- Public content is not invented: exam facts render only from verified `exam_info`
  rows with `source_url` and `last_verified`, and empty topic/PYQ/subject pages 404
  instead of shipping thin indexable pages.
- Local OCR practice never writes attempt or answer rows and never ranks a user; its
  submit API grades from bundled JSON and returns the key only after the request.

## Free-tier query budget

Phase G measured remote D1 rows read and reviewed the 7-day query log. The per-view
figures were homepage ~110, mock hub ~44, mock detail ~46 (67 with the discussion feed),
attempt ~11–13, result ~106 (72 from the two rank counts), autosave ~8 and submit ~20–25.
The submit path no longer grows one statement per question: missing answer rows are
created with one `INSERT OR IGNORE ... SELECT`, correctness is written with one `CASE`
update per 400 questions, and all subject/topic stats are merged in one multi-row
upsert. Autosave sends only answers changed since the last successful save, so a
200-question paper does not rewrite every row every ten seconds.

The top runtime queries were subject-catalogue variants at 6,588, 5,037, 4,958, 4,716
and 3,948 rows read over seven days. Each is bounded by the 18-subject taxonomy and
does not scan attempts; they were left in place. Next were leaderboard `RANK()`
(3,505 rows/65 runs) and the admin attempts list (3,179/31), both indexed reads that
grow with total attempts; KV/aggregate caching is deferred until load justifies it.

`0007_query_budget_indexes.sql` adds
`idx_attempts_user_mock_status(user_id, mock_id, status)` and
`idx_attempts_started(started_at)`. The submit `finalize_earlier` lookup dropped from 37
rows read to 4, and the admin "attempts today" count moved from a full scan to the new
index. This keeps submit and expiry below the free plan's 50-queries-per-invocation
limit for a full paper.

## Deviations and open blockers

1. **Media storage uses KV, not R2.** R2 is not enabled on the Cloudflare account
   (`Please enable R2 through the Cloudflare Dashboard`, code 10042). The adapter
   already prefers `MEDIA_R2` when bound and falls back to `MEDIA_KV`; D1 stores only
   metadata. Uploads larger than 250 KB are downscaled to at most 1600 px and encoded
   as WebP in the browser before the Worker validates the real bytes, 500 KB ceiling
   and pixel dimensions; Workers cannot run a native codec, so this is the practical
   substitute for server-side compression at launch. Exit: enable R2, bind `MEDIA_R2`,
   copy objects, set `MEDIA_PUBLIC_URL=https://img.cuetfreemocktest.com`, then remove
   the KV fallback for new uploads.
2. **Admin auth uses the session fallback on staging.** Access JWT verification is
   implemented and fails closed, but no Access application, team domain or audience
   exists yet. Exit: create the Access app for `/admin`, set
   `ADMIN_AUTH_MODE=access`, `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` (legacy
   `ACCESS_*` aliases still work), then rotate the staging admin password.
3. **Google OAuth is configured on staging, not yet on the final domain.** The web
   client, Worker secrets and staging redirect URI are live; `/api/auth/google` now
   redirects to Google and the callback rejects invalid state. Production still needs
   `https://cuetfreemocktest.com` (and `www` if used) added to the authorised origins
   and redirect URIs, followed by a full sign-in round-trip on that host and consent
   screen verification.
4. **Password-reset email has no provider credentials yet.** Resend and Brevo adapters
   are implemented in `src/lib/email-config.ts` and `src/lib/email.ts`; until
   `EMAIL_PROVIDER`, `EMAIL_FROM` and the matching key are set, production returns a
   clear 503 and the form is disabled. `DEV_SHOW_RESET_LINK=true` remains a local and
   non-production staging aid only. Exit: verify the sending domain and test reset end
   to end.
5. **The launch domain is not registered.** `cuetfreemocktest.com` drives canonical
   URLs and the sitemap but is not live. Exit: register the domain, delegate DNS to
   Cloudflare, add the custom domain to the Worker, set the production `SITE_URL`, and
   update OAuth redirect URIs.
6. **Analytics, Search Console and AdSense values are not configured.** The env-gated
   injection, `/ads.txt` route and ad-route guard are implemented and tested with values
   absent, malformed and present. Exit: create the properties after DNS, set
   `CF_ANALYTICS_TOKEN`, `GSC_VERIFICATION`, `ADSENSE_CLIENT` and `ADSENSE_SLOT_ID`,
   submit the sitemap and verify `noindex` coverage. AdSense also needs approval and a
   consent mechanism for regions that require one.
7. **Scheduled D1 export is not enabled.** The workflow exists at
   `.github/workflows/d1-backup.yml` and now skips with a notice when secrets are absent
   or the repository is public. It needs `CLOUDFLARE_API_TOKEN` and
   `CLOUDFLARE_ACCOUNT_ID` repository secrets. Manual export and a post-v2 restore drill
   passed (see `docs/ASTRO-DEPLOYMENT.md`).
8. **Ranked content parity is not complete.** The 106-paper OCR archive is now
   available in the unranked practice library, but it remains OCR drafts and
   is not D1 rows. Ranked D1 content still has one published starter mock with two
   questions and no `pyq_papers` rows. Exit: editorially review the OCR papers, record
   provenance/rights, and import them into D1 as published mocks and PYQ rows, or
   explicitly accept the starter ranked library plus the OCR practice library for
   launch. Either way, keep the ranked first-attempt rule unchanged.
9. **Cloudflare account-level operations remain manual.** R2 enablement, Access, DNS,
   OAuth and analytics all require dashboard access or secrets that are not in the
   repository.

## Security regression coverage

`tests/unit/admin-permissions.test.ts` pins the exact super/editor/moderator/contributor
matrix plus the guard's 401 (unauthenticated) and 403 (wrong role) responses.
`tests/e2e/security.spec.ts` exercises signed-in cross-user attempt IDOR (read,
autosave, submit and result), PUT/PATCH autosave idempotency, ignored client
deadline/scoring fields, escaped comment HTML, one-level reply rejection, mute
enforcement and the five-comments-per-minute limit. `admin-flow.spec.ts` adds the
500 KB upload rejection. `tests/e2e/slow-network.spec.ts` covers the throttled mobile
attempt. Local run on 2026-10-31: security 6/6, admin 6/6, API contracts 11/11,
attempt flow 4/4, integrations 2/2, local practice 6/6; `npm test` 104/104; `astro check`
0 errors over 224 files; 36 E2E tests defined. The staging slow-network test passed 1/1.
Tests that write local D1 rows skip when `PLAYWRIGHT_BASE_URL` is set, so the suite cannot
mutate staging.

## External integration coverage

`src/lib/integrations.ts` validates the Cloudflare Analytics token, the Search Console
verification value and the AdSense client/slot. Empty, placeholder or malformed values
emit nothing. The AdSense loader is opt-in through the `BaseLayout` `ads` prop and a
second route guard denies attempt, result, dashboard, admin, auth, search, practice and
profile paths. `/ads.txt` returns 404 until a valid publisher client is configured.
`tests/unit/integrations.test.ts` covers absent, malformed and present values plus the
route guard.

`src/lib/email-config.ts` implements Resend and Brevo payloads, sender parsing and
non-production-only dev links. `tests/unit/email-config.test.ts` covers provider
selection, injection rejection, both HTTP payloads, safe failure text and the dev-link
gate. `src/pages/api/auth/forgot.ts` returns a clear 503 and never logs a token when no
provider is configured. Login and signup hide the Google button unless both OAuth values
exist; `tests/unit/oauth-config.test.ts` covers the gate.

`src/lib/auth/access-config.ts` prefers `CF_ACCESS_TEAM_DOMAIN`/`CF_ACCESS_AUD` and
retains the legacy `ACCESS_*` aliases; `tests/unit/access-config.test.ts` covers
precedence, normalisation and exact `access` mode matching.

Production-build verification with optional values set: the content hub served the
Cloudflare beacon, Search Console meta, AdSense loader/unit and a valid `ads.txt`; the
login page received the beacon but no ad script or unit. With a temporary `noindex`
override on the hub, the beacon remained but no AdSense loader or unit was emitted; the
override was removed afterwards. With values unset, the same build served none of them,
`/ads.txt` returned 404, and `/api/auth/forgot` returned 503 with the documented support
message. The backup workflow now skips with a notice when its secrets are absent or the
repository is public. The Phase F build was deployed to staging as
`4ab4cfd3-e48f-4293-bd21-2f4d9ac7e1f0`; smoke passed 30/30, 240 axe scans were clean,
and the live Worker emitted none of the optional tags, returned 404 for `/ads.txt` and
503 for password reset while email was unconfigured. Setup steps are in
`docs/EXTERNAL_SETUP.md`; cutover order is in `docs/LAUNCH-RUNBOOK.md`.

## Cutover sign-off

| Gate | State |
| --- | --- |
| P0–P9 code complete | Yes |
| P10 automated QA | Yes: 104 unit/integration and 36 E2E tests including editor publish, canonical SEO override, signed-in attempt IDOR, autosave idempotency, ignored client timer fields, comment escaping/nesting/mute/rate limits, upload-spoof and 500 KB cap rejection, moderator role boundaries, optional integrations absent/present and the throttled mobile attempt; 236 local and 240 staging axe scans with no WCAG A/AA violations; 30-check staging smoke; D1 query-budget review with migration `0007` and constant-query submit; security checks, restore drill |
| P10 launch operations | No: real-phone pass, production domain, OAuth redirect URIs, email credentials, Access application, analytics/Search Console values, AdSense approval and backup secrets |
| Content parity with legacy six-paper library | Complete: 106 OCR papers from 2021–2025 are browseable in the unranked practice library; the ranked D1 library is still the starter mock |
| Rollback path | Next.js Worker and its D1 remain deployed and untouched |

The Astro app is ready for continued staging review, not for production cutover. The
remaining work is operational plus the explicit content-parity decision above.
