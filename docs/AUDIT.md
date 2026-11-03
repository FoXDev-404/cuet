# Phase A audit — Astro implementation

Date: 2026-10-31. Phase G close-out. Staging Worker:
`https://cuet-astro.cuet-platform.workers.dev`, currently version
`93e99cb2-e6ba-4f39-ac6e-4cc92cf2be0f`. The broad Lighthouse and accessibility baseline
was captured on `b1ebec63`; Phase F was checked on `4ab4cfd3` and Phase G was re-checked
with 240 axe scans, 30/30 smoke checks, the slow-network attempt and the D1 query-budget
review recorded in §4.

Sources: `docs/CUET_MOCK_TEST_BLUEPRINT_v2.md`, the master agent prompt, the repository, and the
existing evidence in `docs/BLUEPRINT-V2-COMPLIANCE.md` and
`docs/ASTRO-DEPLOYMENT.md`. `CUET_KEYWORD_MAP.md` was not supplied; keyword targets
below come from the prompt's Phase D table and the existing page copy.

Method: local D1 schema inventory, remote D1 content counts, route inventory from
`src/pages`, source review of env/SEO paths, test inventory, and the
staging evidence already run on the versions above (240 axe scans on `b1ebec63`, again
on `4ab4cfd3`, and again on `93e99cb2`, 30-check smoke, 26/26 canonical and `og:url`
checks, Lighthouse mobile, 104 unit/integration tests, 36 E2E tests defined with 31
re-run plus the staging slow-network test in this pass, astro check).
Checks not re-run in this pass are marked **not re-run**.

## 1. Schema vs blueprint §5.2

All 27 blueprint tables exist in local D1:

`exams`, `subjects`, `topics`, `users`, `sessions`, `admins`, `passages`,
`questions`, `mock_tests`, `mock_test_versions`, `mock_questions`, `pyq_papers`,
`attempts`, `attempt_answers`, `question_reports`, `discussions`,
`discussion_votes`, `discussion_reports`, `bookmarks`, `user_stats`, `badges`,
`user_badges`, `page_seo`, `exam_info`, `announcements`, `site_settings`,
`audit_log`.

Implementation extras (supported by later blueprint sections, not §5.2):
`blog_posts`, `email_verifications`, `media_assets`, `password_resets`.

Verified constraints and indexes at the SQLite inventory level:

- `uq_first_attempt` partial unique index for the first-attempt rule.
- 28 application indexes including attempt, leaderboard, discussion, question and
  version lookups.
- 10 triggers: frozen published versions/passages, immutable question links on
  frozen versions, published-question immutability, and current-version sync.
- `mock_questions.version_id` and `attempts.version_id` are present; the attempt
  page pins the published version it started on.

Migrations `0001_init.sql` through `0007_query_budget_indexes.sql` are applied locally and
remotely. A fresh column-by-column diff against blueprint §5.2 found **0 missing
tables and 0 missing columns** across all 27 blueprint tables. The only schema
differences are intentional additions:

| Table | Extra columns | Reason |
| --- | --- | --- |
| `users` | `banned_at`, `updated_at` | moderation and account updates (0003) |
| `questions` | `explanation_image_alt` | accessible solution images |
| `mock_tests` | legacy `duration_min`, `total_marks`, `marking_scheme`, `instructions`, `pyq_year`, `pyq_shift`, `version`, `previous_version_id`, `published_at` | compatibility projection; kept in sync from the current version |
| `pyq_papers` | `created_at`, `updated_at`, `deleted_at` | provenance lifecycle and soft delete (0003) |
| `attempts` | `disqualified_at`, `disqualified_by` | leaderboard disqualification (0003) |
| `page_seo` | `canonical_url` | validated editor override (0005) |
| `announcements` | `created_at`, `updated_at`, `created_by`, `deleted_at` | audit fields and soft delete (0003) |

Index parity: every blueprint index name exists. `idx_mocks_status` was originally
`(status, published_at)`; `0006_schema_parity.sql` replaces it with the blueprint's
`(status, type)` and keeps a separate `(status, published_at DESC)` index for
catalogue/search ordering. `idx_attempts_leaderboard` deliberately keys on
`version_id` rather than `mock_id` so rankings stay pinned to the version a candidate
actually sat. `tests/integration/schema.test.ts` now parses the blueprint SQL, applies
every migration to an empty database, and asserts every blueprint table and column.
A second test applies `0001` only, inserts a populated legacy mock with a stored
attempt and PYQ provenance, then applies `0002`-`0007` and asserts the score, answer
timings, version pin and PYQ link are unchanged.

## 2. Routes vs blueprint §13

All required blueprint route families exist. Extra routes are documented features:
`/practice`, `/practice/[slug]`, `/practice/[slug]/take`, `/cuet-mock-test`,
`/search`, `/leaderboard`, public profiles, and the admin discussion/version tools.

Missing from the master prompt's Phase D table (not the blueprint's §13 list):

- `/cuet-ug-eligibility`
- `/cuet-ug-subject-combination`
- `/cuet-ug-cutoff`
- `/tools/cuet-score-calculator`
- `/tools/cuet-percentile-calculator`

Blueprint §15 defers the score calculator and percentile predictor to post-launch, and
only permits a college predictor with verified official cut-off data. Because the
blueprint wins over the prompt's phase table, these five routes are treated as
post-launch, not launch blockers. They must not be built from invented eligibility,
cut-off or percentile statistics.

Optional per blueprint and still absent: `/rss.xml`.

`/pyq/2026` and `/pyq/2025` are implemented dynamically, but the ranked database has
no `pyq_papers` rows, so those pages currently have no playable paper and must stay
gated/noindex per the existing PYQ rules.

## 3. Security gates vs blueprint §16

| Gate | Evidence | State |
| --- | --- | --- |
| No answer/explanation before submit | `tests/e2e/api-contracts.spec.ts` (“public mock detail never leaks answer keys or explanations”), `attempt-flow.spec.ts`, `local-practice.spec.ts` (“take view never ships the answer key”) | Pass |
| Attempt ownership (IDOR) | `api-contracts.spec.ts` blocks a guest stranger; `security.spec.ts` proves a second signed-in student cannot read, autosave into, submit or view the result of another student's attempt | Pass |
| Autosave idempotency | `security.spec.ts` replays the same PUT and PATCH payload and asserts one `attempt_answers` row and the same saved values | Pass |
| Server timer and score | `tests/unit/attempt-time.test.ts`, `tests/unit/scoring.test.ts`, `attempt-flow.spec.ts` (deadline expiry), `security.spec.ts` (client-supplied `startedAt`, `deadlineAt`, duration, status and score are ignored; DB deadline equals `started_at + duration_min`) | Pass |
| Prepared statements | D1 access goes through `src/lib/db.ts` (`prepare(...).bind(...)`); schema tests in `tests/integration/schema.test.ts` | Pass by review |
| Question/comment sanitisation | `tests/unit/rich-text.test.ts`, `content.test.ts`, `moderation.test.ts`, `security.spec.ts` (script/image payload is entity-escaped; replies reject a second level) | Pass |
| Upload byte checks, SVG rejection, size cap | `tests/unit/image.test.ts`, admin E2E “media upload rejects a file that only claims to be an image” and “media upload rejects a file above the 500 KB limit” | Pass |
| Admin role checks / Access JWT | `tests/unit/admin-permissions.test.ts` (exact super/editor/moderator/contributor matrix plus guard 401/403), `api-contracts.spec.ts` private endpoints, `admin-flow.spec.ts` moderator boundary; `src/lib/auth/access.ts` fails closed | Pass (Access app not provisioned) |
| CSRF / strict CORS | `src/lib/http.ts`, `api-contracts.spec.ts` “cross-origin writes are rejected” | Pass |
| Rate limits (login, submit, comments) | `api-contracts.spec.ts` login rate limit; `security.spec.ts` comment limiter returns 429 after five posts; limit helpers in `src/lib/auth/rate-limit.ts` | Pass |
| Soft delete, audit log, backups | Migrations + `/admin/audit-log`; `.github/workflows/d1-backup.yml` exists | Code pass; backup secrets missing |
| Unit tests: scoring, ranking, first attempt, auto-approve | `tests/unit/scoring.test.ts`, `ranking.test.ts`, `moderation.test.ts` | Pass |
| E2E start → answer → submit → result | `tests/e2e/attempt-flow.spec.ts` (registered and guest) | Pass |
| Accessibility and mobile network | 240 staging axe scans on `b1ebec63`, `4ab4cfd3` and `93e99cb2` clean; targeted attempt page clean at 1440/390; throttled 390×844 attempt (400 ms, 400 kbps, 4× CPU) loaded, autosaved, resumed and submitted on local and staging; no physical-device run recorded | Partial (real phone remains) |
| Legal pages and NTA disclaimer | `/about`, `/contact`, `/privacy-policy`, `/terms`, `/disclaimer`; disclaimer states non-affiliation | Pass |

## 4. SEO state

- Every page renders one title, description, canonical and Open Graph tags through
  `src/layouts/BaseLayout.astro`; `page_seo` can override title, description,
  canonical, intro and FAQ, and the canonical override is validated server-side.
- `sitemap.xml` is generated from D1 plus the local practice library and only emits
  gated, non-empty routes. `robots.txt` disallows admin, API, attempt, result,
  dashboard, auth, search, forbidden, maintenance and 500.
- Private routes render `noindex`; the attempt smoke test and E2E robots test cover
  this. Empty topic/PYQ/subject pages are gated rather than indexed.
- JSON-LD: Organization, BreadcrumbList, Article, ItemList and AboutPage objects
  match visible content. `faqJsonLd()` exists but is unused, so no FAQPage markup is
  emitted.
- **P1 gap (fixed after this audit):** the production domain was hard-coded.
  `astro.config.mjs` set `site: "https://cuetfreemocktest.com"`; `src/lib/seo.ts`
  exported a hard-coded `SITE_URL`; `BaseLayout.astro`, `sitemap.xml.ts`,
  `robots.txt.ts` and 25 page frontmatters built URLs from `Astro.site` with the same
  literal fallback, while the `SITE_URL` binding was declared but unused. Staging
  therefore emitted production canonicals, sitemap and robots URL. The fix adds
  `src/lib/site-url.ts`: deployed requests use the runtime `SITE_URL` binding, local
  dev uses the request origin, and missing/invalid values throw a clear error.
  Staging now emits `https://cuet-astro.cuet-platform.workers.dev` canonicals,
  sitemap entries and robots sitemap URL.
- Lighthouse 13.6.0 mobile, one run per template on staging version
  `b1ebec63-8cb4-4a56-9d5f-9ae41bb57896`:

  | Template | Performance | Accessibility | Best practices | SEO | LCP | TBT | CLS |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | `/` | 97 | 100 | 100 | 100 | 1.2 s | 10 ms | 0 |
  | `/cuet-ug-mock-test` | 100 | 100 | 100 | 100 | 0.9 s | 0 ms | 0 |
  | `/mock/cuet-ug-english-starter-mock` | 99 | 100 | 100 | 100 | 1.0 s | 70 ms | 0 |
  | `/blog` | 100 | 100 | 100 | 66 | 0.9 s | 0 ms | 0 |

  `/blog` scores 66 for SEO because it is intentionally `noindex` while no guide is
  published; that is correct gating, not a defect. The first run scored 96 for Best
  Practices on every public page because `/favicon.ico` returned 404; the fix adds
  `public/favicon.svg` and icon links in every layout.
- Optional analytics, Search Console verification and AdSense are env-gated by
  `src/lib/integrations.ts`. Empty, placeholder or malformed values emit nothing; the
  AdSense loader is opt-in per page and a second route guard blocks private, attempt,
  result and thin routes. `/ads.txt` returns 404 until a valid publisher client is set.
  A production-build check with a temporary `noindex` override confirmed that the
  content hub kept the analytics beacon but emitted no AdSense loader or unit; the
  override was removed afterwards. The live staging deploy `4ab4cfd3` served no
  analytics, ads or Search Console output, returned 404 for `/ads.txt`, and returned 503
  for password reset while email was unconfigured; smoke passed 30/30 and 240 axe scans
  were clean.

### D1 free-tier query budget (Phase G)

Remote `wrangler d1 execute --json` measurements after the Phase G fixes:

| View or operation | Rows read | Notes |
| --- | --- | --- |
| Homepage | ~110 | Includes 43 for the mock cards and 61 for the subject grid |
| Mock hub `/cuet-ug-mock-test` | ~44 | 43 from the mock catalogue |
| Mock detail | ~46 | 67 when the discussion feed is enabled; 37 from the attempt count |
| Attempt screen | ~11–13 | Attempt, paper title, questions and saved answers |
| Result | ~106 | 72 from the two first-attempt rank counts |
| Autosave | ~8 | Bounded by attempt lookup and answer upsert |
| Submit | ~20–25 | Constant query count; no longer grows one statement per question |

The 7-day `wrangler d1 insights` list (migration statements excluded) was dominated by
subject-catalogue variants: 6,588 rows/108 runs, 5,037/69, 4,958/67, 4,716/131 and
3,948/42. Each is bounded by the 18-subject taxonomy and reads tens of rows, not the
attempt tables, so they were left in place. The next two are the leaderboard `RANK()`
query (3,505/65) and the admin attempts list (3,179/31); both use
`idx_attempts_leaderboard` / `idx_attempts_mock` and grow with total attempts. KV or
aggregate caching is deferred until real load justifies it.

Two scans were fixed:

1. Submit/expiry used one statement per question (up to 200 on a full paper), which can
   exceed the free plan's 50-queries-per-invocation limit. `finalizeAttempt` now creates
   missing rows with one `INSERT OR IGNORE ... SELECT`, updates correctness with one
   `CASE` statement per 400 questions, and merges all subject/topic stats in one
   multi-row upsert. Autosave now sends only dirty answers instead of rewriting every
   question on each save.
2. `finalize_earlier` filtered by user + mock + status and previously read 37 rows (all
   attempts for the mock). Migration `0007_query_budget_indexes.sql` adds
   `idx_attempts_user_mock_status(user_id, mock_id, status)`; the same lookup now reads
   4 rows. `idx_attempts_started(started_at)` replaces the full scan behind the admin
   "attempts today" count. Both indexes are applied locally and remotely.

## 5. Content state

Verified against remote D1 on 2026-10-31:

| Item | Count |
| --- | --- |
| Mocks (not deleted) | 1 |
| Published mocks | 1 |
| Published versions | 1 |
| Questions (not deleted) | 2 |
| Published questions | 2 |
| Draft questions | 0 |
| `pyq_papers` | 0 |
| Attempts (staging QA data) | 42 |

The 106-paper OCR library is bundled JSON, labelled unranked OCR practice, and
remains OCR drafts. The papers never write attempts, rankings or D1 rows. Ranked
content is still the one starter mock with two questions; no ranked MOQ/PYQ library
exists yet.

## 6. Env/config state

| Variable | Read by | Behaviour when missing |
| --- | --- | --- |
| `DB` | `src/lib/db.ts` | Throws a clear binding error |
| `MEDIA_KV` | `src/lib/media.ts`, rate limiter | Required for media/limits on staging |
| `MEDIA_R2` | `src/lib/media.ts` | Falls back to KV |
| `MEDIA_PUBLIC_URL` | `src/lib/media.ts` | Serves through `/api/media/:id` |
| `SITE_URL` | `src/lib/site-url.ts` | Deployed requests throw a clear error when missing/invalid; local dev uses the request origin |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `src/lib/auth/oauth.ts` | Google button hidden; email login still works |
| `DEV_SHOW_RESET_LINK` | `api/auth/forgot.ts`, `forgot-password.astro` | Ignored in production; outside production, `true` returns a dev-only reset link |
| `ADMIN_AUTH_MODE`, `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` | `src/lib/auth/access.ts` | Session admin fallback; Access mode fails closed |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `BREVO_API_KEY`, `EMAIL_FROM` | `src/lib/email.ts` | Password reset returns a clear 503 and the form is disabled in production |
| `CF_ANALYTICS_TOKEN`, `GSC_VERIFICATION`, `ADSENSE_CLIENT`, `ADSENSE_SLOT_ID` | `src/lib/integrations.ts` | No beacon, meta tag, ad loader/unit or `ads.txt`; `/ads.txt` is 404 |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | `.github/workflows/d1-backup.yml` | Workflow skips with a notice instead of failing |

Test-only variables (`A11Y_*`, `STAGING_*`, `E2E_*`, `PLAYWRIGHT_BASE_URL`) are not
part of the runtime contract.

## 7. Prioritised gaps

**P0 — trust or security breaches found:** none in the code paths covered by tests.

**P1 — SEO/launch:**

1. ~~Replace the hard-coded domain with a runtime `SITE_URL` resolver~~ — fixed and
   verified on staging; see `src/lib/site-url.ts`.
2. Phase D SEO pages: eligibility, subject combination and cut-off pages need verified
   `exam_info` rows before they can be indexed; the score and percentile calculators
   are post-launch per blueprint §15. Build them only with verified data and tests.
3. ~~Add the email-provider adapter behind env flags, or keep password reset disabled
   in production until a provider is chosen~~ — Resend/Brevo support is implemented;
   production stays disabled with a clear message until credentials are supplied.
4. ~~Measure Lighthouse mobile on the public templates and record real numbers~~ —
   done; see §4. `/blog` is correctly `noindex` until a guide is published.

**P2 — nice to have:**

1. ~~Analytics, Search Console and AdSense flags with no-op defaults~~ — implemented and
   tested with values absent, malformed and present; see `docs/EXTERNAL_SETUP.md`.
2. ~~Backup workflow skip guard and failure notice when secrets are absent~~ —
   implemented, including a public-repository safeguard.
3. Optional `/rss.xml`.
4. ~~Slow-network attempt test~~ — passed locally and on staging at 390×844 with 400 ms
   latency, 400 kbps and 4× CPU. A real-phone pass is still outstanding.
5. ~~D1 rows-read measurement per page view and per attempt~~ — done; see §4. The
   submit query count is now constant and the two obvious scans are indexed.

**Blocked on accounts/editorial (not code):** domain registration/DNS, production
OAuth redirect URIs and consent verification, Cloudflare Access app, R2 enablement,
email provider credentials, analytics/Search Console/AdSense accounts, GitHub backup
secrets, two-person review of the OCR practice papers, and final exam-fact verification.

## 8. Next step

Phase G is closed except for a real-phone pass: the slow-network attempt, D1 query-budget
review, two index fixes, constant-query submit and dirty-only autosave are verified on
staging `93e99cb2`. Phase D's verified-data SEO pages remain blocked on official exam
facts, and the calculators stay post-launch per blueprint §15. Run a real iOS/Android
attempt next, then proceed with the operational cutover once the external accounts exist.
