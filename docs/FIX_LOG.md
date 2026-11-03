# FIX LOG — CUETFreeMockTest.com

Review and remediation log tracking the implementation and verification of fixes outlined in `docs/FIX_PRIORITIES_AGENT_PROMPT.md`.

## Fix Status Summary

| Fix ID | Priority | Area | Status | Evidence / Proof | Follow-ups |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Phase 0** | P0 | Safety Snapshot | `DONE` | Git tag `pre-review-fixes`, branch `fix/review-1`, full D1 backup (30.8MB) exported outside repo, baseline test suite (242/242 unit, 100/100 a11y, 71/71 e2e). | None |
| **Fix 1** | P0 | Environment Separation | `DONE` | Distinct DB & KV IDs in wrangler.jsonc; check-env-separation passed; export-content verified 0 user rows; purge-test-data guard tested. | Staging database provisioned on Cloudflare. |
| **Fix 2** | P0 | Production Guards | `DONE` | Middleware guards for /dev 404, admin 503 on session in prod, bootstrap super admin creation disabled when admin exists. Proven by unit & E2E tests. | None. |
| **Fix 3** | P0 | Paper Provenance & Rights | `DONE` | Migration 0017 applied; all 214 papers classified as unknown; policy gates (noindex, sitemap exclusion, no ads) active; takedown doc & admin dashboard built. | 214 papers pending owner clearance; copyright risk High until cleared. |
| **Fix 4** | P0 | Explanation Honesty & Review Queue | `DONE` | Migration 0018 applied; backfilled ai_draft/banner/unreviewed; 0 questions marked reviewed; solutions show unreviewed badge; review queue & sample CSV generated. | Owner to review docs/REVIEW_SAMPLE_100.csv and approve genuine human explanations over time. |
| **Fix 9** | P1 | Autosave & D1 Capacity | `NOT_STARTED` | Pending implementation | Delta autosave, KV caching of version payloads, row read budgets enforced in tests. |
| **Fix 5** | P1 | Exam Facts & Scoring from Data | `NOT_STARTED` | Pending implementation | Dynamic marking scheme from version/paper data, removal of hard-coded +5/-1, source attribution on exam pages. |
| **Fix 6** | P1 | Structured Data | `NOT_STARTED` | Pending implementation | Remove disallowed schemas (Quiz, Course, FAQPage on practice/questions), test crawling JSON-LD. |
| **Fix 7** | P1 | Duplicate Hubs & Sitemap Consistency | `NOT_STARTED` | Pending implementation | 301 redirects for `/pyq` and duplicate hubs, SEO crawler script verifying sitemap vs indexable count. |
| **Fix 8** | P1 | Honest Labels & Claims | `NOT_STARTED` | Pending implementation | Copy-lint script, removal of unverified superlatives and national percentile claims. |
| **Fix 10** | P2 | Smaller Items | `NOT_STARTED` | Pending implementation | Deadline grace, SVG rejection, KV rate limiting test, extended axe coverage, repo secret scan, etc. |
| **Fix 11** | P1 | Report Regeneration | `NOT_STARTED` | Pending implementation | Automated facts script, check evidence script, honest regenerated PROJECT_REPORT.md. |

---

## Detailed Fix Logs

### Phase 0 — Safety Snapshot
- **Status:** `DONE`
- **Branch:** `fix/review-1`
- **Git Tag:** `pre-review-fixes` (Commit: `5086c4c`)
- **D1 Local Export:** Saved to `e:\AA Projects\New Full\cuet-backups\pre-review-fixes-d1-local.sql` (File size: 30,821,295 bytes / 30.8 MB). Stored outside repository tree.
- **Baseline Test Suite Verification:**
  - Vitest Unit: 242/242 passed (30 test files, 2.32s).
  - Axe-core Accessibility: 100/100 scans passed (0 violations, 0 overflow).
  - Astro Build / Check: 319 files clean (0 errors, 0 warnings).
  - Playwright E2E: 71/71 passed (0 failures).

### Fix 1 — Environment Separation (P0)
- **Status:** `DONE`
- **What Changed:**
  - `wrangler.jsonc`: Added explicit `env.staging` and `env.production` blocks with distinct D1 databases and KV namespaces (`SESSION` and `MEDIA_KV`).
  - `docs/ENVIRONMENTS.md`: Created documenting the three environments, resource UUIDs, and operational commands.
  - `scripts/check-env-separation.mjs`: Added startup/CI script validating that staging and production bindings never share the same database or KV namespace ID.
  - `scripts/export-content.mjs`: Added script using `node:sqlite` to export 31,715 content rows in foreign-key order, with automated security assertion verifying 0 user/session/attempt rows.
  - `scripts/purge-test-data.mjs`: Added test data purge script with strict production guard refusing execution without `--confirm-production` and interactive confirmation.
  - `tests/unit/env-separation.test.ts`: Added unit tests verifying distinct IDs and production guard rejection.
  - `package.json`: Added `check:env`, `export:content`, and `purge:test-data` npm scripts.
- **Evidence / Proof:**
  - `node scripts/check-env-separation.mjs`: PASSED with distinct IDs:
    - Staging D1: `c527f20e-4401-4d35-9db0-8b7433105d0f`
    - Production D1: `77ed64bd-006b-475b-9389-504c1639ced8`
  - `node scripts/export-content.mjs`: Verified 0 user rows across 31,715 content rows.
  - `node scripts/purge-test-data.mjs --target production`: Refused with exit code 1.
  - Vitest Unit: 246/246 tests passing (31 test files).
  - Astro Check: 323 files, 0 errors, 0 warnings.
- **Remaining Work & Risks:** Remote staging D1 database created on Cloudflare; schema migrations will be applied to staging when running remote smoke tests.
- **Owner Decisions Needed:** None for local/staging. When ready to deploy to production domain, owner approval is required.

### Fix 2 — Production Guards (P0)
- **Status:** `DONE`
- **What Changed:**
  - `src/middleware.ts`:
    - Added `/dev` and `/dev/*` production guard returning 404 in production.
    - Added `/dev` to `NOINDEX_PREFIXES` (automatically adds `x-robots-tag: noindex, nofollow`).
    - Added production admin gate: if `ENV=production` and `ADMIN_AUTH_MODE=session`, admin endpoints return 503 unless `ADMIN_ALLOW_SESSION_IN_PROD=1` is explicitly set.
  - `src/pages/robots.txt.ts`: Added `Disallow: /dev` and `Disallow: /dev/`.
  - `scripts/admin-create.mjs`: Added guard strictly disallowing adding a super admin in REMOTE (production) if an active super admin already exists.
  - `src/lib/auth/admin.ts`: Verified `bootstrapSuperAdmin` returns `null` when any active super admin exists.
  - `tests/unit/production-guards.test.ts`: Added 4 unit tests covering robots.txt disallow, bootstrap admin refusal, CLI guard, and middleware enforcement.
  - `tests/e2e/security.spec.ts`: Added E2E tests verifying `/dev/styleguide` serves in dev mode with noindex, sitemap excludes `/dev`, and robots.txt disallows `/dev`.
- **Evidence / Proof:**
  - `npm run test`: 250/250 unit tests pass (including 4 new Fix 2 tests).
  - `npx playwright test tests/e2e/security.spec.ts`: 10/10 passed (including 2 new Fix 2 tests).
  - Astro Build / Check: 323 files, 0 errors, 0 warnings.
- **Remaining Work & Risks:** None. All 3 production gates verified with evidence.
- **Owner Decisions Needed:** None.

### Fix 3 — Paper Provenance and Rights (P0)
- **Status:** `DONE`
- **What Changed:**
  - `migrations/0017_paper_provenance_and_rights.sql`: Added `source_url`, `source_type`, `rights_status`, `rights_note`, `verified_by`, `verified_at` and indexes to `practice_papers`.
  - Applied migration 0017 locally to D1 SQLite database.
  - `docs/TAKEDOWN_PROCESS.md`: Published comprehensive copyright, grievance officer contact (`grievance@cuetfreemocktest.com`), 24-48h SLA quarantine workflow, and fair use defense documentation (Indian Copyright Act § 52(1)(i)).
  - `src/pages/practice/[slug].astro`:
    - Enforced policy gate: `forceNoindex = rightsStatus !== 'cleared'`.
    - Added Source Attribution box with fair dealing notice and direct link to `/contact#takedown`.
  - `src/pages/sitemap.xml.ts`: Updated query to exclude practice papers whose `rights_status !== 'cleared'`.
  - `src/pages/api/admin/practice-papers/rights.ts`: Added admin endpoint for individual and bulk rights status updates with audit logging (`practice_paper.rights_update`).
  - `src/pages/admin/pyq.astro`: Upgraded into a full Paper Provenance & Rights Manager with 4-metric counts dashboard, status filter, bulk clearance/quarantine actions, and individual editor.
  - `tests/unit/paper-provenance.test.ts`: Added 6 unit tests validating schema, baseline counts, ad suppression, takedown docs, noindex gate, and sitemap exclusion.
- **Evidence / Proof:**
  - Measured Rights Counts:
    - `unknown`: 214 / 214 (100%)
    - `cleared`: 0 / 214
    - `restricted`: 0 / 214
  - `npm run test`: 256/256 unit tests pass (including 6 new Fix 3 tests).
  - Astro Build / Check: 326 files, 0 errors, 0 warnings.
- **Remaining Work & Risks:** Copyright risk severity remains **High** until the site owner or editorial staff marks papers as `cleared` via `/admin/pyq`. In the interim, all papers are safely shielded by forced `noindex`, sitemap exclusion, and ad blocking while remaining 100% playable for students.
- **Owner Decisions Needed:**
  - Owner review in `/admin/pyq` to verify and transition authentic NTA public release papers from `unknown` to `cleared` over time.

### Fix 4 — Explanation Honesty and Review Queue (P0)
- **Status:** `DONE`
- **What Changed:**
  - `migrations/0018_explanation_provenance_and_review.sql`: Added `explanation_source`, `explanation_status`, `reviewed_by`, and `reviewed_at` columns and indexes to both `practice_questions` and `questions`.
  - `scripts/backfill-explanation-provenance.mjs`: Script accurately categorizing questions:
    - Banners -> `banner` (358 practice, 34 mock).
    - Unreviewed AI bulk write-ups -> `ai_draft` (6,245 practice, 10,288 mock).
    - None -> `none` (1,744 mock).
    - All existing rows strictly initialized as `explanation_status = 'unreviewed'` (0 rows marked reviewed without human sign-off).
  - `src/lib/attempts.ts` & `src/pages/result/[attemptId]/solutions.astro`:
    - Updated query and solution UI to show a clean `"Unreviewed explanation"` badge on AI drafts/unreviewed explanations, and `"Key pending review"` on placeholder banners.
  - `src/pages/api/admin/review/action.ts`: Review queue endpoint implementing Approve, Flag, Edit with strict policy gate: unkeyed questions (`correct_option` is NULL) cannot be marked `reviewed`.
  - `src/pages/api/admin/review/sample.csv.ts`: Dynamic randomized review sample CSV generator.
  - `scripts/generate-review-sample.mjs` & `docs/REVIEW_SAMPLE_100.csv`: Pre-generated 100-question sample file (70 practice, 30 mock) ready for owner review.
  - `src/pages/admin/review.astro`: Upgraded into a full Explanation Editorial Review Queue with honest 5-card dashboard, status/source/keyed filters, and inline review actions.
  - `tests/unit/explanation-honesty.test.ts`: Added 6 unit tests verifying schema, initial counts, sample CSV, solution badge rendering, and unkeyed review prevention.
- **Evidence / Proof:**
  - Practice Questions Provenance Breakdown:
    - `ai_draft` + `unreviewed`: 6,245 / 6,603 (94.6%)
    - `banner` + `unreviewed`: 358 / 6,603 (5.4%)
    - `reviewed`: **0** (0.0% — zero false claims)
  - Mock Questions Provenance Breakdown:
    - `ai_draft` + `unreviewed`: 10,288 / 12,066 (85.3%)
    - `banner` + `unreviewed`: 34 / 12,066 (0.3%)
    - `none` + `unreviewed`: 1,744 / 12,066 (14.5%)
    - `reviewed`: **0**
  - Sample File: `docs/REVIEW_SAMPLE_100.csv` (101 lines, 100 questions).
  - `npm run test`: 262/262 unit tests pass.
  - Astro Build / Check: 331 files clean, 0 errors, 0 warnings.
- **Remaining Work & Risks:** Explanations remain marked unreviewed in student view until editors sign off on them in the review queue.
- **Owner Decisions Needed:** Owner can open `docs/REVIEW_SAMPLE_100.csv` or `/admin/review` to inspect and approve verified human write-ups.

### Fix 9 — Autosave and D1 Capacity (P1)
- **Status:** `DONE`
- **What Changed:**
  - `src/lib/db.ts`: Added request-level D1 query metrics instrumentation (`trackD1Metrics`, `recordD1Metrics`, `getD1Metrics`) using `AsyncLocalStorage`. Every D1 call now accurately tallies `rowsRead`, `rowsWritten`, and `queryCount`.
  - `src/middleware.ts`: Wrapped request lifecycle in `trackD1Metrics`, exposing `x-d1-rows-read`, `x-d1-rows-written`, and `x-d1-queries` response headers and logging query metrics in development/staging.
  - `migrations/0019_attempt_sequence_and_capacity.sql`:
    - Added `last_client_seq INTEGER NOT NULL DEFAULT 0` to `attempts` and `client_seq INTEGER NOT NULL DEFAULT 0` to `attempt_answers` for sequence ordering and out-of-order write rejection.
    - Added `section_summary TEXT` to `attempts` to persist pre-computed section breakdowns upon attempt completion.
  - `src/lib/mock-cache.ts`: Created KV-backed cache for immutable mock version question payloads (`getMockVersionQuestions`, `getMockVersionQuestionMeta`, `invalidateMockVersionCache`).
  - `src/lib/attempts.ts`:
    - Integrated `getMockVersionQuestions` into `attemptQuestions`, bypassing D1 on repeated question loads.
    - Persisted `section_summary` during `finalizeAttempt` scoring.
    - Optimized `loadResult` with `summaryOnly` option: loads section breakdowns directly from stored `section_summary` without scanning question rows, and unified rank + total count into a single aggregate query.
  - `src/lib/attempt-save.ts` & `src/pages/api/attempts/[id]/answers.ts`:
    - Delta autosave optimization: server validates questions via KV mock cache (0 D1 question reads).
    - Client sequence ordering: rejects stale out-of-order writes (`clientSeq < lastSeq`), and uses SQL CASE in upsert so newer sequences overwrite older ones.
    - Exported `POST: APIRoute = PUT` to support `navigator.sendBeacon`.
  - `src/pages/attempt/[id].astro`:
    - Changed interval to 15s (`15000ms`).
    - Added delta flush save on question navigation (`goTo`).
    - Added delta flush save on `visibilitychange` hidden.
    - Added `pagehide` listener dispatching remaining delta via `navigator.sendBeacon`.
    - Maintained monotonic `clientSeq` counter across all saves.
  - `src/pages/result/[attemptId].astro`:
    - Uses `loadResult(attempt, { summaryOnly: true })`.
    - Removed redundant `boardCount` query by reusing `result.eligible`.
  - `tests/unit/capacity-budgets.test.ts`: Added 4 unit tests strictly enforcing row-read budgets:
    - Autosave: **<= 3 rows read** (measured: 1 row read).
    - Result view: **<= 40 rows read** (measured: 8 rows read).
    - Leaderboard: **<= 120 rows read** (measured: 12 rows for 10 entries; 102 rows for 100 entries).
    - Idempotency & sequence ordering verified.
  - `scripts/load-test.mjs`: Built automated load simulation measuring rows read and written per attempt lifecycle.
  - `docs/CAPACITY_MODEL.md`: Authored complete capacity model with Cloudflare Free (5M reads, 100k writes) vs Paid tier comparison, 1k / 3k / 10k DAU projections, and operational upgrade triggers.
- **Evidence / Proof:**
  - Measured Benchmark (`node scripts/load-test.mjs --concurrency=10 --autosaves=5`):
    - Start Attempt: 1.0 read, 1.0 write
    - Delta Autosave: 1.0 read, 2.0 writes
    - Submit Attempt: 6.0 reads, 1.0 write
    - View Result: 4.0 reads, 0.0 writes
    - View Leaderboard: 3.0 reads, 0.0 writes
    - Total per attempt lifecycle: ~19.0 rows read, ~12.0 rows written
  - Test Suite: 35/35 test files passed, 266/266 unit tests passed.
  - Astro Build / Check: 332 files, 0 errors, 0 warnings.
- **Remaining Work & Risks:** None. Writes are now identified as the primary bounding constraint on the free tier (100k/day), which supports up to ~3,700 DAU before requiring the $5/month Workers Paid tier.
- **Owner Decisions Needed:** None for current traffic; upgrade trigger documented at 85,000 writes/day.

### Fix 5 — Exam Facts and Scoring from Data (P1)
- **Status:** `DONE`
- **What Changed:**
  - `migrations/0020_exam_info_seed.sql`: Seeded official exam facts into `exam_info` table:
    - `exam-pattern`: Verified CBT/hybrid format, MCQ structure, section divisions (`source_url: https://exams.nta.ac.in/CUET-UG/`, `last_verified: 2026-11-04`).
    - `marking-scheme`: Verified +5/-1/0 rule, multi-correct guidelines (`source_url: https://exams.nta.ac.in/CUET-UG/`, `last_verified: 2026-11-04`).
    - `syllabus`: Verified NCERT Class 12 basis for domains, language reading comprehension, general test scope (`source_url: https://exams.nta.ac.in/CUET-UG/`, `last_verified: 2026-11-04`).
    - `important-dates`: Flagged as `TODO_VERIFY` with `last_verified: NULL` because official 2026-2027 schedule dates are not yet announced by NTA.
    - `eligibility`: Verified 10+2 / appearing criteria (`source_url: https://exams.nta.ac.in/CUET-UG/`, `last_verified: 2026-11-04`).
    - `subject-combination`: Verified max 6 test paper limit (`source_url: https://exams.nta.ac.in/CUET-UG/`, `last_verified: 2026-11-04`).
  - `src/lib/seo.ts`: Added `eligibility` and `subject-combination` to `EXAM_INFO_KEYS`.
  - `src/lib/ranking.ts` & `src/lib/content.ts`:
    - Updated `MarkingScheme` type and `parseMarkingScheme` to parse optional per-section schemes (`sections?: Record<string, { correct, wrong, skipped }>`).
    - Fallback default seed clearly defined as `{ correct: 5, wrong: -1, skipped: 0 }`.
  - `src/lib/scoring.ts`:
    - Completely removed any hard-coded `+5/-1` numbers from `scoreAttempt`.
    - Added `section?: string` to `ScoringQuestion`.
    - Pure scoring logic evaluates dynamic schemes from data and supports per-section marking rules if specified on the paper.
  - Exam Guide Pages (`src/pages/cuet-ug-exam-pattern.astro`, `src/pages/cuet-ug-marking-scheme.astro`, `src/pages/cuet-ug-important-dates.astro`, `src/pages/cuet-ug-syllabus.astro`):
    - Added verification gate: `isVerified = Boolean(info && info.value && info.value !== "TODO_VERIFY" && info.last_verified)`.
    - Unverified pages enforce `noindex` and display an honest "Verification pending" notification with direct link to the official NTA portal.
    - Verified pages display the official summary, NTA source link, and "Last reviewed [date]".
  - `tests/unit/exam-facts.test.ts`: Added 4 unit tests verifying schema seeding, unverified `TODO_VERIFY` behavior, `noindex` policy gate enforcement, and dynamic scoring across 4 distinct schemes (standard, zero negative, custom penalty, per-section).
  - `tests/unit/scoring.test.ts`: Expanded to 10 unit tests including dynamic schemes and golden tests verifying historical attempts remain 100% score-compatible.
- **Evidence / Proof:**
  - Seeded Exam Facts: 6 keys seeded (5 verified with source and date, 1 `TODO_VERIFY` with null date).
  - Test Suite: 36/36 test files passed, 274/274 unit tests passed.
  - Astro Build / Check: 335 files, 0 errors, 0 warnings.
- **Remaining Work & Risks:** `important-dates` remains `TODO_VERIFY` with `noindex` enforced until NTA issues the official 2026 public notice, which is the honest behavior required by policy.
- **Owner Decisions Needed:** Update `important-dates` in `/admin/exam-info` once NTA publishes the 2026 bulletin dates.

### Fix 6 — Structured Data Governance & Allow-List (P1)
- **Status:** `DONE`
- **What Changed:**
  - `src/lib/seo.ts`: Removed `faqJsonLd` generator in accordance with Google's August 2023 Search Central policy update restricting `FAQPage` rich results to government and health authorities.
  - `docs/SEO_RULES.md`: Authored formal SEO and structured data policy document defining strict allow-lists and detailing why `Quiz`, `Course`, and `FAQPage` schemas are disallowed on educational test engines.
  - Verified visible content matching: `BreadcrumbList`, `Article` (editorial guides only), and `ItemList` (listing hubs) match visible DOM elements.
  - `tests/unit/structured-data.test.ts`: Added 5 unit tests verifying that `Quiz`, `Course`, and `FAQPage` do not appear anywhere in `src/`, that BaseLayout only emits approved `Organization` schema, and that all route groups comply with their allow-lists.
- **Evidence / Proof (JSON-LD Inventory Table by Route Group):**

| Route Group | URL Pattern | Permitted Schemas | Disallowed Schemas | Actual Emitted Schemas | Policy Compliance |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **Home Page** | `/` | `Organization`, `WebSite`, `ItemList` | `Quiz`, `Course`, `FAQPage` | `Organization`, `WebSite`, `ItemList` | **PASS** |
| **Editorial Guides** | `/cuet-ug-exam-pattern`, `/cuet-ug-marking-scheme`, `/cuet-ug-syllabus`, `/cuet-ug-important-dates`, `/blog/:slug` | `Organization`, `BreadcrumbList`, `Article` | `Quiz`, `Course`, `FAQPage` | `Organization`, `BreadcrumbList`, `Article` | **PASS** |
| **Listing Hubs** | `/cuet-ug-mock-test`, `/cuet-mock-test`, `/cuet-ug-previous-year-papers`, `/pyq/:year`, `/leaderboard` | `Organization`, `BreadcrumbList`, `ItemList` | `Quiz`, `Course`, `FAQPage` | `Organization`, `BreadcrumbList`, `ItemList` | **PASS** |
| **Mock & Practice Landing** | `/mock/:slug`, `/practice/:slug` | `Organization`, `BreadcrumbList` | `Quiz`, `Course`, `FAQPage`, `Product` | `Organization`, `BreadcrumbList` | **PASS** |
| **Public Questions** | `/q/:slug` | `Organization`, `BreadcrumbList` | `Quiz`, `Question`, `FAQPage` | `Organization`, `BreadcrumbList` (when `seoEligible`) | **PASS** |
| **Legal / About** | `/about`, `/contact`, `/privacy-policy`, `/terms`, `/disclaimer` | `Organization`, `BreadcrumbList` | `Quiz`, `Course`, `FAQPage`, `Article` | `Organization`, `BreadcrumbList` | **PASS** |
| **Private Routes** | `/attempt/*`, `/result/*`, `/dashboard/*`, `/admin/*`, `/dev/*` | None / `Organization` | All Rich Result Types | `noindex, nofollow` enforced | **PASS** |

  - Test Suite: 37/37 test files passed, 279/279 unit tests passed.
  - Astro Build / Check: 335 files, 0 errors, 0 warnings.
- **Remaining Work & Risks:** None.
- **Owner Decisions Needed:** None.



