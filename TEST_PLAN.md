# TEST_PLAN — complete QA run for cuetfreemocktest.com (2026-11-19)

Status: Phase 0 complete. **This plan was executed twice**: the original pass and a fresh full re-run on 2026-11-19 evening (all areas A1–A12 repeated, reports and raw artifacts overwritten). Latest results are in `TEST_REPORT.md` / `FIX_REPORT.md`.

## 1. Scope and environment

| Item | Value |
| --- | --- |
| Target | Local replica of production at `http://localhost:4321` (the production origin is read-only for observation only) |
| Production origin (reference, read-only) | `https://cuetfreemocktest.com` (Cloudflare Worker `cuet-astro`) |
| Data | Local D1 (`wrangler d1 --local`) seeded to production-like content. **No production D1/KV/Turso writes.** |
| Auth | Google OAuth (code in `src/lib/auth/`) + `__Host-cuet_session` cookies; guest attempts; seeded E2E admin |
| Browser | Chromium (Playwright project `chromium`; Firefox/WebKit added by CLI where installed), desktop 1440×900, mobile 390×844 and audit widths |
| OS | Windows 11; shell PowerShell |

**Environment parity strategy** (the brief requires localhost to behave as production):

- `astro dev` on port 4321 is the iteration server; `npx wrangler dev` serves the production build (`USE_PROD_BUILD=1`) for header/CSP parity checks. Both use the local D1 via `USE_LOCAL_D1=1` (Playwright sets this automatically).
- Canonical-host and trailing-slash redirects only run on localhost when `PREVIEW_CANONICAL_ORIGIN=http://localhost:4321` is set (new in commit `292d99a`). Without it, localhost intentionally does not redirect — production does. Test both modes.
- Production-only host redirects (`www.`, `*.workers.dev`) are exercised by unit tests (`tests/unit/canonical-host.test.ts`) and were verified on production with `curl`.
- Google OAuth round trip cannot be completed locally (no Google OAuth app for localhost); failure paths and the `google_not_configured` login state are tested instead. This is a documented limitation, not a fork in behaviour — the code path is identical.
- **No Firebase exists in this project.** The brief's Firebase-Auth-emulator step is N/A; auth is Google OAuth + server sessions. Admin E2E uses `node scripts/seed-e2e-admin.mjs`; guest attempts use `/api/attempts/start`.

## 2. Stack summary

| Layer | Technology |
| --- | --- |
| App | Astro 7.4.12, SSR (`output: "server"`), React 19 islands, Tailwind CSS 4 (`@tailwindcss/vite`), KaTeX, `html-to-image`, zod |
| Runtime | Cloudflare Workers (`@astrojs/cloudflare`), adapter `server`, static assets in `dist/` |
| Database | Production: Turso/libSQL (`TURSO_*` secrets). Local/dev: D1 binding `cuet-blueprint-db`. Fallback chain enforced in `src/lib/db.ts` |
| KV | `SESSION` (sessions), `MEDIA_KV` (media); `MEDIA_R2` optional object storage |
| Session/cookies | `__Host-cuet_session`, `__Host-cuet_guest` (legacy unprefixed names read for one rollout window) |
| Ads/analytics | GA4 (`G-Y1JPT7SNQJ`, opt-in after consent), Cloudflare Web Analytics (cookieless), AdSense **dormant** (`ADSENSE_CLIENT`/`ADSENSE_SLOT_ID` empty in prod) |
| Tests | Vitest (73 unit files, **656 passing**), Playwright (**chromium** project, 14 spec files), axe (`scripts/a11y-audit.mjs`), Lighthouse (`scripts/lighthouse-audit.mjs`), `seo-consistency.mjs`, `copy-lint.mjs`, `check-env-separation.mjs` |
| CI | `CI Quality Gate` (lint, build, Playwright E2E, axe, sitemap/SEO audit) + `Auto deploy production` (main only, `[skip deploy]` opt-out) |
| Migrations | 32 files applied locally (incl. `0029`–`0031` PYQ 50-question set support) |

**Local D1 state (production-like):** 363 papers · 13,427 practice questions · 13,874 ranked questions · 13,804 mock-question rows · 169 passages · all 32 migrations applied · e2e admin `ci_admin` seeded · `backfill-explanation-provenance` ran (explanation status `unreviewed`).

## 3. Baseline captured (this session, HEAD `26b7ea8`)

| Check | Result |
| --- | --- |
| `npm run build` (astro check + astro build + secret scan) | clean; **0 errors, 0 warnings**, 49 hints; dist secret scan PASS |
| `npm test` (vitest) | **656/656** across 75 files |
| `npm audit` | **0 vulnerabilities** (0/0/0/0/0) |
| `npm run check:env` | PASS (D1 separation, KV separation, engine policy, https non-loopback origins) |
| `npm run check:env:live https://cuetfreemocktest.com` | PASS: `engine=turso, db=ok` |
| `npm run lint:copy` | 0 violations |
| `npm run db:migrate:local` | already up to date (32 migrations) |

## 4. Route inventory (98 page files)

Public pages: `index.astro`, `mock-tests/`, `mock-tests/[slug]`, `mock-tests/[slug]/take`, `mock/[slug]` (+ `instructions`, `discussion`), `cuet-mock-test*`, `cuet-ug-previous-year-question-papers*` (category/subject/paper), `cuet-ug-syllabus*`, `cuet-ug-exam-pattern`, `cuet-ug-marking-scheme`, `cuet-ug-important-dates`, `cuet-ug-previous-year-papers.astro` (legacy; 301), `pyq/*`, `q/[slug]`, `dashboard*`, `leaderboard*`, `u/[username]`, `blog*`, `search`, `login`, `signup`, `forgot-password`, `reset-password/[token]`, `forbidden`, `maintenance`, `disclaimer`, `contact`, `about`, `privacy-policy`, `terms`, `404`, `500`, `ads.txt`, `robots.txt`, `sitemap.xml`, `og/blog/[slug].svg`, `result/[attemptId]` (+ `solutions`), `attempt/[id]`, dev-only `dev/consent`, `dev/styleguide*`.
Admin panel (`/admin/*`): index, mocks (list/detail/new/preview), questions (list/detail/new/preview/import), review, passages, pyq, trash, attempts, users, admins, audit-log, blog, announcements, exam-info, content, media, moderation, leaderboard, data browser, seo, settings, search.

Appendix A lists the exact file paths (`scratch/qa-routes.txt`), Appendix B the 82 API routes (`scratch/qa-apis.txt`).

## 5. Data model and invariants to verify

Key tables: `mock_tests`, `mock_versions`, `questions`, `mock_questions`, `practice_papers`, `practice_questions`, `passages`, `slug_redirects`, `users`, `sessions`, `attempts`, `attempt_answers`, `bookmarks`, `comments`, `reports`, `discussions_*`, `exam_info`, `blog_posts`, `announcements`, `audit_log`, `question_share_*`, `explanation_provenance`.

Invariants under test:
1. Rebuilt PYQ sets have exactly **50** distinct questions (same numbers across list/detail/runner/result/leaderboard/dashboard/meta/JSON-LD).
2. Every mock has consistent `total_questions` / `scored_questions` / `duration_minutes` / `max_marks` (and per-question immutability guards: `immutability_guards`, `0021`).
3. Answer keys and explanations are **never** sent before submit; scoring is server-side; client-tampered payloads cannot change results.
4. One active attempt per user per version; first submitted attempt counts on leaderboards (`0025_first_attempt_per_version`).
5. `slug_redirects` give exactly one 301 per archived paper; no redirect chains.
6. `practice_questions.source_*` tags are immutable; `rights` metadata is currently `unknown` for all 363 papers (known limitation, not a bug).
7. Explanation provenance: `ai_draft`/`banner`/`none` × `unreviewed` — most explanations lack human review (known content risk: 3,580 practice questions report `explanation_source='none'`).
8. Passage-based questions stay attached to their passage; no orphans.

## 6. Risk areas (priority order)

- **P0** — Attempt integrity: answer keys/explanations leaking pre-submit; client-side scoring accepted; deadline not enforced; cross-user read/write of attempt/result/dashboard (IDOR); server-side re-score mismatch.
- **P0** — Auth bypass: admin RBAC failure; session forgery/promotion failure (`__Host-` promotion path); Origin/CSRF fail-open.
- **P1** — PYQ rebuild integrity: 50-question sets, source tags, passage grouping, archive redirects; no deleted question content.
- **P1** — Rate limiting & abuse: autosave/start/submit/comments 429 behaviour under load.
- **P1** — SEO correctness: wrong canonical/noindex leak, duplicate content, sitemap parity with routes.
- **P1** — XSS via any user-controlled field (comments, reports, feedback, search, announcement copy).
- **P2** — Consent/ads leakage: GA4 before Accept; ad on attempt/result; `/ads.txt` consistency.
- **P2** — Consistency of displayed stats everywhere (A5).
- **P2** — Performance: LCP/CLS on attempt flow; share-font prerender; ad/analytics payload.
- **P3** — Cosmetic: responsive/contrast nits; copy inconsistencies (already 0 violations).

## 7. Tools

| Tool | Purpose |
| --- | --- |
| Vitest | unit/integration (incl. scoring helpers, canonical host, cookie, db adapter) |
| Playwright | E2E (all A6 flows), screenshot capture (A7), manual crawl (A5) |
| `scripts/a11y-audit.mjs` (axe-core) | A8 — full-site scan incl. attempt/result states |
| `scripts/lighthouse-audit.mjs` + `performance-budget.json` | A9 — gated Lighthouse medians (9 routes × 3 runs) |
| `scripts/seo-consistency.mjs` | A10 — meta/canonical/JSON-LD/sitemap checks vs built pages |
| `scripts/check-links.mjs` | A5 — broken internal/external links |
| `scripts/check-env-separation.mjs`, `npm run check:env:live` | deployment/env guard |
| `node scripts/qa-data-audit.mjs` (**new, A4**) | data integrity audit: counts/options/answers/explanations/duplicates/passages/source tags; writes CSV + summary to `test-artifacts/` |
| curl | A11 headers/redirect verification |

Note: `autocannon` will be used for the local API load test (A9); it is a **devDependency** addition and will be recorded in the report.

## 8. Phase checklist and owning tools

- **A1 Static:** npm audit (done: 0), build (done: clean), secrets scan in HEAD + history (`git log -S` for key formats), unused deps sanity, circular imports (madge via `npx` if installable), bundle sizes from `dist/`.
- **A2 Unit:** inventory existing coverage of scoring (+5/−1/0, max marks, accuracy, ties, zero/all cases), `getTestStats`, deadline calc, shuffle determinism, slug/validation. Add only missing tests; do not change app code.
- **A3 API/DB:** run the critical-security list manually/via Playwright request contexts against local server: pre-submit key leak, tampered payload, late submit, one-active-attempt/idempotent resubmit, IDOR across two seeded users, leaderboard first-attempt rule, method/CORS/wrong-ID/oversized-body/unknown-field cases, SQL-injection probes in params, migrations-from-scratch + twice idempotency (`--local` fresh file).
- **A4 Data integrity (new script):** consistency per test (50 Q), counts vs linked questions, missing options/answers/explanations, duplicates/near-dupes, passages detached, source tags, mixed languages, duplicate slugs, empty tests, archived-but-linked; CSV + per-subject summary written to `test-artifacts/data-audit.*`.
- **A5 Routing/links/redirects:** `check-links.mjs http://localhost:4321` + crawl `sitemap.xml` (all 225 URLs, expect 200) + crawl sample of canonical targets from `slug_redirects`; duplicate-content/canonical checks; verify 404 page and archived-paper 301s; **stats-consistency grid** for one mock across all surfaces (home, list, detail, runner, result, leaderboard, dashboard, meta, JSON-LD).
- **A6 E2E:** extend/verify `tests/e2e/*` to cover the 10 flows incl. timer zero auto-submit (short-test seed), two-tab IDOR attempt, offline→online resume, throttled network 500 retry. Run on desktop + 390×844; add Firefox/WebKit where installed.
- **A7 Responsive/cross-browser:** screenshots 360/390/768/1024/1440/1920 × light/dark for key routes; detect h-overflow; tap-target check via Playwright; note PWA/manifest presence (not present — document).
- **A8 a11y:** `npm run test:a11y` on astro dev; keyboard-only pass of attempt flow; focus trap of submit modal; `aria-live` timer warnings if present; reduced-motion check.
- **A9 perf:** `npm run audit:lighthouse` (uses prod build + `USE_LOCAL_D1=1`); load test (local) list/get/save/submit via autocannon; record p50/p95, error rate; D1 query counts from `x-db-rows-read` headers.
- **A10 SEO:** `npm run seo:check`; verify noindex on dashboard/result/auth/admin; JSON-LD types against allow-list; duplicate title/description detection; sitemap host/canonical pass.
- **A11 Security headers/privacy:** local `curl -D -` on `/` and private routes: CSP/HSTS/nosniff/Referrer-Policy/COOP/CORP/Permissions-Policy/XFO; pre-consent GA4 absence (network log); XSS probes in comment/report/search; cookie flags.
- **A12 Visual baselines:** capture `toHaveScreenshot` baselines for home/list/runner/result locally; commit-or-document decision comes in Phase D (Linux CI fonts ≠ Windows).
- **Phase B:** `TEST_REPORT.md`, `BUGS.csv`, artifacts in `test-artifacts/`.
- **Phase C:** fixes P0→P3 with regression tests; data-changing fixes only via dry-run migration script + explicit approval.
- **Phase D:** npm scripts `test:*`, CI wiring decision, `TESTING.md`.

## 9. Known findings (do not re-report as new bugs; reference by ID)

From `AUDIT.md`/`PYQ_REBUILD_REPORT.md`: explanations `none` for 3,580 practice questions (pre-existing, editorial); rights metadata `unknown` for all 363 papers (process); CSP allows `script-src 'unsafe-inline'` (migration deferred, §15 of AUDIT); Turso scheduled backups not running (P1-12, blocked on secrets); publishing `mock #1109` v2 blocked on 1,457 missing explanations; legacy `cuet_session`/`cuet_guest` dual-read until ~2026-12-17; staging blocked (D1-scoped GitHub token, DNS, staging OAuth) — staging cannot be re-verified in this run.

## 10. Deliverables

`TEST_PLAN.md` (this) · `TEST_REPORT.md` · `BUGS.csv` · `test-artifacts/**` · `FIX_REPORT.md` (Phase C) · `TESTING.md` (Phase D) · targeted commits with `[skip deploy]` where test-only (production auto-deploys on push otherwise).

## 11. Explicit deviations from the brief

- **Firebase Auth emulator is N/A** — the project does not use Firebase (Google OAuth + server sessions). See §1.
- "Cloudflare Pages preview deploys" in Phase D is substituted with the repo's Workers deploy model; preview deploys already exist via staging/2026 workflows (blocked ops item) and are not re-enabled here.
- "Production D1 copy" is not available (production local D1 is empty; local seed is a *subset by design*). The local dataset is production-shaped (363 papers, rebuilt 50-question sets, imported practice library), and its counts are recorded above; all A4 numbers are for the seeded dataset, not production Turso.
- Ad slot verification (A6.9) targets layout/space reservation and consent behaviour only; AdSense itself is dormant (owner decision).
- Load testing (A9) is local-only against `astro dev`/preview with local D1; no production traffic is generated.
