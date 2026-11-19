# TEST_REPORT — complete QA run for cuetfreemocktest.com (2026-11-19)

Scope: owner-requested end-to-end QA pass over the local replica of production (`http://localhost:4321`), all public and auth/attempt surfaces, data integrity of the seeded practice library and ranked mock bank, API/auth/security integrity, accessibility, SEO integrity, headers and consent, plus a full unit and E2E baseline. Production read-only spot checks were performed for parity confirmation only; **no production data was read or written by the test harness**. Everything in this run was done against a local D1 seeded to production-like content (`npm run db:migrate:local`; `npm run db:import:practice:local`; `npm run db:import:ranked-practice:local`; PYQ 50-question sets rebuilt and present as `duration_locked = 1`).

## 1. Executive summary

| Area | Result | Evidence |
| --- | --- | --- |
| Build | PASS — `astro check` 0 errors / 0 warnings, 49 hints (docs only) | `npm run build` (19:49) |
| Secrets | PASS — 0 patterns found in tracked files; `dist/` secret scan PASS | A1 |
| npm audit | PASS — **0** vulnerabilities (0/0/0/0/0) | `npm audit` |
| Unit tests | PASS — **661/661** (75 files, +5 new `test-stats.test.ts`) | `npm test` |
| E2E (Playwright, Chromium) | PASS — **109 passed, 2 skipped (deliberately deselected), 0 failed, 0 flaky** | §A6 |
| Accessibility (axe, 272 scans) | PASS — **0** WCAG A/AA violations, **0** horizontal overflow | §A8 |
| Data integrity | **PASS with 6 known data issues** (0 integrity invariants broken; see BUG-007/BUG-008) | `scripts/qa-data-audit.mjs` |
| Security headers / auth | PASS on all sampled routes; XSS probes escaped; pre-consent GA4 absent | §A11 |
| Redirects | **2 dead-end targets of 462 checked** (BUG-001) | §A5 |
| SEO | PASS — no duplicate titles/descriptions, 0 missing descriptions, 118/118 locked sets in sitemap | §A10 |
| Performance (production build Lighthouse) | PASS — every audited route within its budget; LCP 0.93–1.60 s; transfer 44.8–66 KB; TBT/CLS 0 everywhere | §A9 |
| Console / dev noise | PASS with 2 non-fatal observations (Astro dev-toolbar `audit` app logs "Failed to fetch" in `astro dev`; no runtime impact) | §A12 |

**Findings by severity**

| Severity | Count | IDs |
| --- | --- | --- |
| P0 (blocker) | 0 | — |
| P1 (major) | 0 | — |
| P2 (minor) | 5 | BUG-001, BUG-002, BUG-003, BUG-004, BUG-007 |
| P3 (cosmetic/informational) | 1 | BUG-008 |

Verdict: **GO with fixes.** No P0/P1 defect was found. The P2 items are: 1 user-facing timer inconsistency (BUG-002), 1 API hardening gap (BUG-003), 1 dead-end redirect for 2 archived papers (BUG-001), 1 missing syllabus page (BUG-004), and live content defects inside published 50-question sets (BUG-007). Safe fixes will be applied under Phase C with regression tests; data/editorial changes are held for owner approval.

Release readiness: production (as of `8c13936b`, 2026-11-19) is operationally healthy: `/api/health` `engine=turso, db=ok`; 301 chains canonical; sitemap 225 URLs, all canonical hosts, 100% HTTP 200; headers verified; consent gate works as designed; security properties hold. Ship the Phase C fixes only after CI is green and (for the timer fix) a fresh deploy is verified.

## 2. Environment and parity method

| Item | Detail |
| --- | --- |
| Framework | Astro 7 SSR (`output: "server"`) + React 19, Tailwind CSS 4, KaTeX, Cloudflare Workers (`@astrojs/cloudflare`) |
| Runtime | Local: `wrangler d1 --local` (disposable D1); production: Turso/libSQL (read-only for parity probes) |
| Server under test | `astro dev` for E2E/consent (has dev-only `/dev/consent`); production build via `wrangler dev` for header/redirect/parity probes and Lighthouse |
| Canonical/301 parity | `PREVIEW_CANONICAL_ORIGIN=http://localhost:4321` opt-in (commit `292d99a`); host-to-host redirect logic unit-tested for `workers.dev` and `www` |
| Data volume | 363 papers, 13,427 practice questions, 13,874 ranked questions, 13,804 mock-question rows, 169 passages, 32 migrations, PYQ 50-question sets rebuilt locally |
| Auth | Google OAuth code paths present; local Google round-trip impossible (no OAuth app for localhost) — failure paths and seeded E2E admin used instead; **no Firebase exists in this stack** |
| Rate of trust | local results are production-shaped, not production-truthful; every "production" claim below is verified against `https://cuetfreemocktest.com` read-only |

Explicit environment deviations from the QA brief: no Firebase Auth emulator (no Firebase); no Cloudflare Pages preview deploys (Workers instead); no copy of production D1 (local seed matches its shape, not its row counts exactly); Firebase/"emulator" items of A11/A12 therefore verified structurally and via unit tests.

Production PII was not touched; no write path was exercised against production; no secrets were printed or committed.

## 3. Findings — Phase A, by area

### A1 Static checks

- `npm audit` → **0 / 0 / 0 / 0 / 0** vulnerabilities.
- Secret scan (tracked files, plus `.env*` files in history, plus common key formats) → **clean**; CI secret scan PASS (`dist/`).
- Circular imports (madge): **1** report — `src/lib/attempts.ts → src/lib/mock-cache.ts`, type-only import (`import type`), no runtime cycle. No action.
- Build warnings: 49 hints in `astro check`, all pre-existing (`ts(6133)` unused vars in scratch/tooling); 0 errors, 0 warnings in the app code.
- Largest client assets: `rich-text.BCXi-0O6.js` 288 KB, `client.FVv06Hs5.js` 211 KB, `global.BrumFN1b.css` 207 KB, KaTeX CSS 28 KB. 54.8 MB total `dist/` (dominated by public media).
- No high/critical advisories; `npm ci` reproducible (`package-lock.json` matches).

### A2 Unit tests

655 baseline + **5 new tests** (`tests/unit/test-stats.test.ts` for the uncovered `getTestStats`) → **661/661 pass**.

| Helper | Coverage |
| --- | --- |
| `scoreAttempt` (+5 correct / −1 wrong / 0 unattempted; subject & topic stats) | `tests/unit/scoring.test.ts` — incl. golden test and section-specific marking |
| `getTestStats` (fallbacks, cap at total, NaN safety) | `tests/unit/test-stats.test.ts` — **added in this pass** |
| Percentile, ties, accuracy | `tests/unit/ranking.test.ts` |
| Deadline/time math | `tests/unit/attempt-time.test.ts`, `tests/unit/exam-timing.test.ts` |
| Canonical-host redirect, loopback opt-in, trailing slash | `tests/unit/canonical-host.test.ts` (+5 for preview mode) |
| Env separation, engine selection | `tests/unit/env-separation.test.ts`, `tests/unit/db-adapter.test.ts` |

### A3 API and database

| Critical check | Result | Evidence |
| --- | --- | --- |
| Answers never leak pre-submit | PASS — payload SELECT excludes `correct_option`/`explanation`; attempt page HTML scan: 0 occurrences of `correct_option`, `explanation`, `answerKey` | code (`mock-cache.ts`), manual scan of `/attempt/114` |
| Answer keys not returned after submit until owner opens result | PASS | code + E2E (`security.spec.ts`, `api-contracts.spec.ts`) |
| Server-side scoring only | PASS — client score/deadline/scoring fields ignored | `security.spec.ts:370` |
| Deadline enforced server-side | PASS — late submit auto-closed as `expired` | code (`submit.ts`, `hasExpired`); unit `attempt-time.test.ts` |
| One active attempt per user/version; idempotent resubmit | PASS — `findInProgressAttempt` resumes; resubmit returns redirect to result without rescoring | code (`start.ts`, `submit.ts`); E2E attempt-flow |
| IDOR — cannot read/modify another's attempt/result | PASS | `security.spec.ts:200` |
| Leaderboard counts only first submitted attempt | PASS (structure + E2E) | `migrations/0025_first_attempt_per_version.sql`, `security.spec.ts` |
| Reject unknown fields / bad IDs / wrong methods / non-existent IDs | PASS — 404 for DELETE on start; 400 for empty attempt id; 403 without `Origin` | `security.spec.ts`, manual probes |
| Rate limiting | PASS — autosave (120/min per attempt+IP) returns 429; attempt-start 20/10min; submit 5/min | `security.spec.ts:332` |
| SQL injection probes | PASS — `search` page static; all query params bound; no 5xx observed | manual probes |
| Oversized body | **BUG-003** — 4 MB JSON accepted (201) | §3/BUG-003 |
| CORS preflight from bad origin | PASS — no `access-control-allow-origin` reflected (mere `Vary: Origin`) | manual probe |
| Migrations from scratch and twice | PASS — 32 migrations idempotent locally (`No migrations to apply`) | `npm run db:migrate:local` |
| D1 integrity: nil orphans, indexes exist, FK clean | PASS — 0 orphan mock_questions, no missing passage refs, no broken FK joins (audit queries) | A4 |

### A4 Data integrity (scripts/qa-data-audit.mjs → `test-artifacts/data-audit.csv`)

**Invariants:** every `duration_locked = 1` rebuilt set has **exactly 50 non-deleted practice questions**; every published set wrapper mock points at 50 rows; every locked paper in DB has `duration_min = 60`; no P1 integrity invariant broken.

| Finding | Rows | Severity | Status |
| --- | --- | --- | --- |
| Missing explanation (`explanation_source='none'`) | 7,242 (4,522 questions in locked sets) | P2 | known editorial gap (also reported by provenance backfill) |
| Duplicate option text inside one question — rebuilt sets | **25** | P2 | **new — BUG-007** |
| Duplicate option text inside one question — official papers | 197 | P3 | BUG-008 |
| Near-duplicate stems within a paper | 13 | P2 | curation candidates |
| Questions with only 2 options | 2 | P3 | BUG-008 |
| Cross-paper exact PYQ duplicates | 5,689 | P3 | expected by design |
| Ranked questions without `source_set_slug` | 7,878 | P3 | expected (legacy seed) |

Per-subject coverage (practice library): every subject's locked sets are **exactly 50** questions. Subjects with **100% explanations missing**: accountancy, business-studies, economics, political-science, legal-studies, psychology, sociology — all recently imported; editorial gap, P2 content quality.

Indexing/archival: all 231 replaced mocks redirect once (301) to a 200 target; all 231 archived practice papers redirect once (301) — **except 2** (`sociology-2024-05-18-shift-3`, `legal-studies-2022`) whose `replaced_by` target (an otherwise-empty subject hub) returns 404 — **BUG-001**, confirmed in production too.

No broken HTML/LaTeX was found in rendered stems; KaTeX covers math. Image assets referenced by stems resolve (no missing-file 404s in the sampled crawl). Answer-key boundary is enforced at two layers (payload shape + auth scope) — no payload inspected returned `correct_option` or `explanation` before submit.

### A5 Routing, links and redirects

- Crawl from `localhost:4321`: **all 213 sitemap URLs return HTTP 200**; canonical hosts are 100% `localhost:4321` locally (and `cuetfreemocktest.com` on production, whose 225 URLs were separately verified for HTTP 200 and canonical policy).
- 462 redirect targets checked (231 legacy mocks + 231 archived papers): 460 resolve in one hop with a 200 target; **2 dead-ends** (BUG-001).
- Archived mocks never redirect to another stub (no chains>1 found); 404 page is a useful custom page (`Page not found`, 200-styled, recovery links, noindex).
- Trailing slash duplicates: `/mock-tests/` → 301 → `/mock-tests` (locally and in preview mode). Canonical-on-localhost parity exercised via `PREVIEW_CANONICAL_ORIGIN` (loopback aliases included); production behavior unit-tested.
- Stats consistency for the sampled rebuilt set (`cuet-general-test-pyq-set-18`): practice listing ("900 questions across 18 papers"), PYQ archive list (18 sets), PYQ detail (50Q / 60 min / 250 marks), mock-tests hub, result page, instructions meta description — all agree (50Q/60 min/250 marks). Runner/result via E2E (attempt-flow passes; score computed server-side matches independently computed expected score).
- **Inconsistency found — cross-surface (BUG-002):** instructions/meta/card all advertise **60 minutes** while the server enforces **50 minutes** for the `general` family.

### A6 End-to-end tests (109 pass / 2 skipped / 0 fail, Chromium, 390–1440)

The two skips are deliberate: both admin review-queue specs self-skip when no pending papers exist in the fixture database (nothing to review).

Exercised flows: anonymous funnel (home → list → papers → guides → leaderboard, subject filters), Google sign-in failure paths (local OAuth not configurable — `google_not_configured` message verified), attempt start → answers → mark-for-review → clear → palette jump → **refresh mid-test and resume with same answers and correct remaining time** → submit with confirmation modal → result page; timer pins the server deadline; auto-submit at zero (unit + E2E); attempt stays usable on a throttled connection (`slow-network`); offline→online resume; back-button behaviour; double-click protection; leaderboard first-attempt rule; dashboard history/bookmarks/wrong-questions; theme engine (system/light/dark persistence, blocked localStorage fallback); mobile nav (390px drawer); question share sheet (focus trap, image PNG, answers withheld until toggle); admin flows (mock publish, review queue, question import/export); site builder drafts; topic mapping.

Not run: Firefox and WebKit (project is Chromium-only by repository decision); Google OAuth round-trip; physical device pass.

### A7 Cross-browser and responsive

- axe audit scans light/dark at 375px and 1280px (WCAG A/AA, 0 violations, 0 horizontal overflow).
- Screenshot matrix captured: 360, 390, 768, 1024, 1440, 1920 × light/dark × home, list, detail, login, leaderboard, signup (see `test-artifacts/screenshots/`).
- Tap targets ≥ 44 px and no horizontal scroll reported anywhere in the a11y report (272 scans, 0 overflow).
- Verified before this pass in June: leaderboard 24 px, `/admin/seo` overflow, PYQ tag-row focus; both fixes live in production.

### A8 Accessibility (axe + keyboard)

- **272 scans, 0 WCAG A/AA violations, 0 horizontal overflow** (refreshed report committed: `docs/report/a11y-results.json`).
- Keyboard-only attempt flow: arrow/palette navigation, submit modal traps focus and closes with Escape (`question-share-public.spec.ts:1061`), focus returns to opener; skip links present.
- `aria-live` status message on the consent banner under polite mode; reduced-motion respected by the banner; color contrast passes everywhere scanned.

### A9 Performance

Local (`astro dev`, uncached): `/mock-tests` p50 1199 ms / p95 1868 ms; `/api/health` p50 242 ms / p95 1714 ms; **these characterize the development shim, not production Workers** (production shows single-digit ms reads via Turso and edge cache for public pages).

**Production-build Lighthouse medians (mobile, light, 3 runs per route) — 2026-11-19, `dist/` via wrangler preview: all 8 audited routes are within their performance budget (PASS).**

| Page | Perf (med) | A11y | Best Pract | SEO | LCP | TBT | CLS | Transfer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | 100 | 100 | 100 | 100 | 0.93 s | 0 ms | 0 | 57.1 KB |
| Mock Test Hub | 100 | 100 | 100 | 100 | 0.93 s | 0 ms | 0 | 58.6 KB |
| Subject Hub | 100 | 100 | 100 | 100 | 0.93 s | 0 ms | 0 | 55.1 KB |
| Mock Detail | 100 | 100 | 100 | 69 | 0.94 s | 0 ms | 0 | 61.2 KB |
| Instructions | 100 | 100 | 100 | 69 | 0.93 s | 0 ms | 0 | 52.0 KB |
| Attempt Screen | 100 [99–100] | 100 | 100 | 58 | 1.60 s | 0 ms | 0 | 65.9 KB |
| Result Screen | 100 | 100 | 100 | 69 | 0.94 s | 0 ms | 0 | 62.0 KB |
| Admin Dashboard | 100 | 100 | 100 | 63 | 1.09 s | 0 ms | 0 | 44.8 KB |

Methodology note: the first attempt in this pass ran against the development server on port 4321 and produced 2.4 MB transfer sizes / 2.8–3.2 s FCP — those numbers were invalid by construction (unminified dev modules) and were discarded; the artifacts were restored from HEAD. The valid run used a freshly built `dist/` with `wrangler dev` started on a free port; results at `docs/report/lighthouse/lighthouse-results.json` (budget verdict **PASS**, 9/9 route checks).

Load-test limits (`npx autocannon -c 20 -d 10`): `/mock-tests` 160 req / 10 s (p95 1.87 s), `/api/health` 429 req / 10 s (p95 1.71 s) — again the dev-server profile only; production reads are served through Turso + edge cache.

### A9a Post-data: production-build Lighthouse (complete)

See A9 — **8 routes PASS, 9/9 budget checks PASS**, refreshed `docs/report/lighthouse/lighthouse-results.json` and `SUMMARY.md` are committed. Transfer budgets (250/200/300 KB per route) all met; LCP < 2.0 s everywhere (1.6 s worst on attempt); TBT/CLS 0 everywhere. SEO scores on noindex pages are expected (58–69, not a budget gate).

### A10 SEO

No pages missing a `<title>`/`<meta description>`/canonical/JSON-LD; **0 duplicate titles, 0 duplicate descriptions** (213/213 sampled); no trailing-slash sitemap entries; trailing slash duplicates 301 to canonical; no noindex page is linked by any crawler path; `noindex` present on attempt/result/dashboard/auth/admin/login/search as required; `robots.txt` disallows private paths and advertises the sitemap; `/sitemap.xml` references only non-fixture, eligible content; JSON-LD `type`s remain constrained by the allow-list; 118/118 non-restricted locked sets are in the sitemap; 12 URLs in production are absent locally solely because the production DB contains additional published blog guides, a mini-mock and the single eligible `/q/` page — a **content subset difference, not an indexation defect**.

### A11 Security headers

All sampled Worker routes (`/`, `/login`, `/mock-tests`, `/api/health`, private redirects) carry: `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`, `cross-origin-opener-policy: same-origin-allow-popups`, `cross-origin-resource-policy: same-origin`; private/auth routes also send `Cache-Control: no-store` + `Pragma: no-cache`.

CSP (current posture): `default-src 'self'`, `frame-ancestors 'self'`, `object-src 'none'`, `script-src 'self' 'unsafe-inline' …` plus GA4/GTM/Google accounts hosts only when those integrations are configured. `'unsafe-inline'` remains for legacy `is:inline` snippets; the hashed migration plan is recorded in `AUDIT.md` §15. No cross-origin analytics fire before consent (0 requests in the banner-blocked network); `/ads.txt` is 404 in production — consistent with ads being dormant.

XSS probes in the search box and comments: escaped everywhere; the share/OG pipeline renders server-side with trusted HTML; no reflected-state script execution found.

### A12 Regression safety

Screenshot baselines are stored in `/test-artifacts/screenshots/` for inspection only. Cross-platform font noise (Windows host vs Linux CI) makes `toHaveScreenshot` baselines unusable in CI as-is; decision recorded for Phase D. Existing Playwright specs already act as regression guards for the attempt flow, consent, theme engine, mobile nav and admin chrome.

## 4. Data integrity — per subject (local seed)

See `test-artifacts/data-audit-summary.md` for the full table. Highlights:

- Every `duration_locked = 1` rebuilt set: exactly 50 questions (all 118 sets, all subjects).
- Fully unexplained subjects (0 explanations): accountancy 847/847, business-studies 632/632, economics 224/224, political-science 260/260, legal-studies 38/38, psychology 50/50, sociology 49/49.
- Explanations incomplete but > 0: applied-mathematics 8 missing /141, chemistry 88/1741, computer-science 2/306, mathematics 13/933, physics 54/1277, geography 15/383, hindi 99/195, english 484/1951, biology 138/1602, general-test 301/2058.
- Duplicate-option live rows: 25 locked sets + 197 official papers (BUG-007/BUG-008).

## 5. Coverage, skipped and untested areas (with reasons)

| Area | Status | Reason |
| --- | --- | --- |
| Firefox / WebKit | untested | Repository ships a Chromium-only Playwright project (owner decision) |
| Google OAuth round-trip | untested | No local OAuth application; failure paths verified; seeded admin used instead |
| Physical device pass | untested | Requires owner device lab |
| Production `npm audit` parity | partial | Local CI-equivalent `npm audit` is the canonical check; production deps are identical (`package-lock.json`) |
| Firebase | N/A | No Firebase in this stack (OAuth + `__Host-` session cookies) |
| Production guest writes | not performed (by design) | Read-only parity probes only; all writes against local D1 |
| CSP `'unsafe-inline'` migration | documented, deferred | Same fixtures as AUDIT.md §15 (21 `is:inline` scripts + consent gate); no risk increase shipped |
| Load/perf on production | untested | Dev-server numbers are shim-characteristic; production perf governed separately by Lighthouse on the deployed origin (`npm run audit:lighthouse --base-url https://…`) |
| a11y full 272 scans | done | `npm run test:a11y` (272/272 pass) |
| A12 committed baselines | deferred | Windows vs Linux font noise; decision for Phase D |
| Admin prod-only content (mini-mock, 12 blog guides) | inherits production | Local seed lacks them; not a defect |

## 6. Verdict and Phase C

**GO with fixes — all six bugs are now resolved or dispositioned.**

- **BUG-002** (timer inconsistency) — fixed in `62a27b0` (`fix(exam)`), verified end-to-end.
- **BUG-003** (unbounded body) — fixed in `b180582` (`fix(api)`), verified end-to-end.
- **BUG-004** (legal-studies syllabus 404) — fixed in app code; renders the honest empty state with a 38-question DB-derived counter.
- **BUG-001** (redirect → 404) — approved "retarget to subject practice hubs"; applied and verified **in the local D1** (both the `replaced_by` 301 and the `slug_redirects` 301); production pending the owner's Turso run (§5 of FIX_REPORT.md).
- **BUG-007** (duplicate options in rebuilt sets) — approved curation: 25 rows flagged `duplicate-option` (+ `duplicate-option-in-keypair` for the 3 class-C rows), verified **in the local D1**; option-text rewriting awaits the source PDFs.
- **BUG-008** — tracked as editorial backlog (owner approved), no bulk deletion proposed.

After the owner's `--turso` apply, production will carry all of these fixes without changing scoring behaviour or content.
