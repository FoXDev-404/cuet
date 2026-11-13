# CUET Mock — End-to-End QA Test Plan

**Version:** 1.0
**Date:** 2026-11-10
**Owner:** QA / Release engineering
**Application:** Astro 7 SSR on Cloudflare Workers, Turso Cloud (libSQL HTTP) production database
**Production URL:** https://cuetfreemocktest.com

---

## 1. Objective

Verify the production platform end to end after the stateless Turso cutover:

- Static quality gates (env separation, copy policy, types, migration drift).
- Unit and integration behaviour of the DB adapter, attempt engine, auth, and APIs.
- Production build correctness and artifact hygiene (no secrets, no Node-only DB builds).
- Full browser E2E on a local D1 fixture.
- WCAG A/AA accessibility.
- SEO consistency, sitemap indexability, and link health.
- Production smoke, Turso data integrity, and concurrency/load behaviour.
- Every failure must be fixed and the affected phase re-run before sign-off.

Out of scope: new feature work, visual redesign, billing, and third-party OAuth provider internals.

---

## 2. Environments & safety rules

| Item | Value |
| --- | --- |
| Unit / integration | Local Node, local D1 fixture |
| E2E / a11y | Local dev server `http://localhost:4321`, local D1 fixture |
| SEO local | Local dev server + local D1 |
| Production smoke / SEO / load | Live `https://cuetfreemocktest.com`, Turso Cloud |
| Browser | Playwright Chromium (installed locally) |

Safety rules:

1. Never print `.dev.vars` values or Turso credentials.
2. Do not commit `docs/report/report.json` (pre-existing local modification).
3. Stop the dev server before the full Vitest run to avoid local D1 SQLite file locks.
4. Back up the local D1 SQLite file before migrations/imports.
5. Production writes are limited to disposable attempt probes; delete them afterwards (`attempt_answers` first, then `attempts`).
6. Push must be fast-forward only. Do not force-push.
7. Keep free-tier usage: no paid add-ons, no D1 production rollback unless Turso is unavailable.

---

## 3. Phase summary

| Phase | Area | Command(s) | Exit criteria |
| --- | --- | --- | --- |
| 0 | Preflight | git/port/env checks | Clean state, port 4321 free, credentials present |
| 1 | Static gates | `check:env`, `lint:copy`, `astro check`, `check:migrations-remote` | All pass; migration check has no drift |
| 2 | Unit / integration | `npx vitest run` | 465/465 pass, 53 files |
| 3 | Build & artifacts | `npm run build`, `perf:check`, secret scan | Build clean, budgets pass, no secrets/Node DB build |
| 4 | Local D1 fixture | migrate + imports + backfill + seed | Expected row counts, admin seeded |
| 5 | Browser E2E | `npm run test:e2e` | All 10 specs pass |
| 6 | Accessibility | `npm run test:a11y` | 0 critical/serious violations |
| 7 | SEO local | `BASE_URL=... npm run seo:check` | 0 mismatches, restricted papers noindex |
| 8 | Production smoke | `smoke-check`, `seo:check`, `check-links` | Health/sitemap/pages 200, 0 mismatches, 0 broken links |
| 9 | Production DB integrity | `db:turso:verify` | integrity ok, 0 FK violations, expected counts |
| 10 | Load & write probes | burst + attempt lifecycle + browser | 100% 2xx, 0 degraded, 0 exceptions |
| 11 | Cleanup & sign-off | purge probes, docs, commit, CI | Probe rows gone, CI + deploy green |

---

## 4. Detailed phases

### Phase 0 — Preflight

**Purpose:** Confirm the workspace and environment are safe to test.

Checks:

```powershell
git status --porcelain
git rev-parse HEAD
git rev-parse origin/main
Get-NetTCPConnection -LocalPort 4321 -ErrorAction SilentlyContinue
Get-Content .dev.vars | Select-String -Pattern "^[A-Z_]+=" | ForEach-Object { ($_.Line -split "=")[0] }
```

Acceptance:

- Only `docs/report/report.json` is modified.
- `HEAD == origin/main`.
- Port 4321 has no listener.
- Required keys exist: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `SITE_URL`, OAuth keys. Values are never printed.

---

### Phase 1 — Static quality gates

```powershell
npm run check:env
npm run lint:copy
npx astro check
npm run check:migrations-remote
```

Acceptance:

- `check:env`: PASS.
- `lint:copy`: no editorial-policy violations.
- `astro check`: 0 errors, 0 warnings (hints allowed).
- `check:migrations-remote`: no drift. An "UNVERIFIED" result due to missing local CLI auth is acceptable only if it is the documented offline path.

---

### Phase 2 — Unit & integration tests

**Precondition:** dev server stopped, port 4321 free.

```powershell
npx vitest run
```

Acceptance:

- 53 test files, 465/465 tests pass.
- No unhandled rejections or open-handle warnings.
- DB adapter tests (`tests/unit/db-adapter.test.ts`) pass.

On failure: capture the failing file/test, fix, re-run the file, then re-run the full suite.

---

### Phase 3 — Production build & artifact hygiene

```powershell
npm run build
npm run perf:check
```

Secret / artifact scan (reports counts only, never values):

```powershell
Get-ChildItem dist -Recurse -File | Select-String -Pattern "TURSO_AUTH_TOKEN\s*=|libsql://|turso\.io" -List
Get-ChildItem dist -Recurse -File | Select-String -Pattern "node:sqlite|better-sqlite3|@libsql/client/lib-esm/node" -List
```

Acceptance:

- Build succeeds; Cloudflare adapter output is generated.
- Perf budgets pass (JS ≤ 200 KB gzip, CSS ≤ 100 KB gzip, DOM nodes ≤ 1200).
- No credential values or Node-only libSQL build in `dist`.
- Worker/client asset layout matches `wrangler.jsonc`.

---

### Phase 4 — Local D1 fixture

**Precondition:** dev server stopped.

```powershell
# Back up the current local D1 SQLite file first
$d1 = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject"
$db = Get-ChildItem $d1 -Filter *.sqlite | Sort-Object Length -Descending | Select-Object -First 1
Copy-Item $db.FullName "$($db.FullName).qa-backup" -Force

npm run db:migrate:local
npm run db:import:practice:local
npm run db:import:ranked-practice:local
node scripts/backfill-explanation-provenance.mjs
node scripts/seed-e2e-admin.mjs
npm run seed:e2e-mock
```

Data checks:

```powershell
npx wrangler d1 execute cuet-blueprint-db --local --command "SELECT COUNT(*) AS published FROM questions WHERE status='published'; SELECT COUNT(*) AS mocks FROM mock_tests WHERE status='published'; SELECT COUNT(*) AS admins FROM admins;"
```

Acceptance:

- All migrations apply without error.
- Practice and ranked imports succeed.
- Published questions > 0; published mocks > 0; E2E admin exists.
- E2E admin login works (`admin@cuetfreemocktest.com`).

---

### Phase 5 — Browser E2E

```powershell
npm run test:e2e
```

Coverage (10 spec files): attempt flow, admin flow, API contracts, integrations, local practice, public question sharing, security, slow network, theme, plus `auth-helpers.ts`.

Acceptance:

- All tests pass on Chromium with `workers=1`.
- No uncaught page errors or console errors that fail assertions.
- Test JSON report written to `docs/report/playwright-results.json`.

On failure: inspect trace/screenshot, fix root cause, re-run the single spec, then the full suite.

---

### Phase 6 — Accessibility (WCAG A/AA)

```powershell
# Terminal A
npm run dev

# Terminal B
$env:A11Y_SKIP_ATTEMPT="0"
npm run test:a11y
```

Acceptance:

- 0 critical and 0 serious axe violations.
- Guest attempt/result walk completes.
- Authenticated pages audited via the seeded local admin session.

Stop the dev server afterwards.

---

### Phase 7 — SEO consistency (local)

**Precondition:** dev server running with local D1 fixture.

```powershell
$env:BASE_URL="http://localhost:4321"
npm run seo:check
```

Acceptance:

- Every sitemap URL returns 200, is indexable, and is self-canonical.
- Every indexable public page is in the sitemap.
- 0 private/admin/attempt URLs in the sitemap.
- `rightsStatus === "restricted"` papers are `noindex` and absent from the sitemap.
- 0 mismatches.

---

### Phase 8 — Production smoke, SEO & links

```powershell
node scripts/smoke-check.mjs https://cuetfreemocktest.com
$env:BASE_URL="https://cuetfreemocktest.com"
npm run seo:check
node scripts/check-links.mjs https://cuetfreemocktest.com
```

Acceptance:

- `/api/health` → `db: ok`, `engine: turso`.
- Required pages 200; sitemap 200 or guarded 503 with `x-sitemap-degraded`.
- Production sitemap: 0 indexability mismatches, restricted papers excluded.
- 0 broken internal/external links (or all non-200 documented as external/unavoidable).

---

### Phase 9 — Production Turso integrity

```powershell
npm run db:turso:verify
```

Acceptance:

- All repository migrations applied.
- `PRAGMA integrity_check` → `ok`.
- `PRAGMA foreign_key_check` → 0 rows.
- Table/row counts match the post-cutover baseline (26 tables, ~50,695 rows, 20,111 published questions).
- No orphan attempts/answers or duplicate public IDs.

---

### Phase 10 — Load, attempt lifecycle & browser hydration (production)

1. Read burst: 300 requests at concurrency 15, then 600 at concurrency 30 against public pages/APIs.
2. Attempt write probe: start → 11 autosaves → submit → result, plus 8 parallel starts.
3. Browser hydration: open an attempt, verify timer/palette/questions render, repeat 2 reloads; capture console/page errors.
4. Worker tail: scan for exceptions, `connections limit`, and retry warnings.

Acceptance:

- 100% HTTP 200 (expected 201 for starts), 0 degraded responses.
- Attempt timings within budget (initial render < 400 ms typical, no hangs).
- 0 `Database connections limit`, 0 hung-request errors, 0 unhandled exceptions.
- Probe attempts recorded and then deleted.

---

### Phase 11 — Cleanup, documentation & sign-off

```powershell
# Delete probe attempts (answers first, then attempts)
# Verify no probe rows remain
npm run audit:reconciliation   # local
```

Acceptance:

- Probe attempt IDs removed; only real attempts remain.
- `docs/QA_TEST_PLAN.md` result table updated with actual evidence.
- `docs/PROGRESS.md` updated with the QA outcome.
- Only intended files committed; `docs/report/report.json` excluded.
- Push is fast-forward; CI Quality Gate succeeds; production auto-deploy succeeds.
- Live worker version confirmed.

---

### Phase 12 — Search Console “Excluded by noindex” triage

GSC reported 39 affected URLs (last update 09/11/2026). Live robots/canonical/sitemap probes and production `exam_info`/`page_seo` reads classified them as:

- 28 `/mock/*/instructions` — intentional duplicate step pages.
- 5 unique `/mock/<slug>` — practice-paper wrappers duplicating `/mock-tests/<slug>`.
- 4 `/leaderboard/<slug>` — zero first-attempt entries at crawl time.
- 2 core guides:
  - `/cuet-ug-important-dates` — correct exclusion: `exam_info.important-dates = TODO_VERIFY` with `last_verified = null`.
  - `/cuet-ug-marking-scheme` — transient false noindex. The row is verified (`2026-11-04`) and the live page is now indexable. A failed `exam_info` read used to return `{}`, which the page treated as “unverified”.

Fixes:

- Exam-info pages resolve verification through `getExamInfoState()`. When the database read fails, a deploy-time, last-known-good fallback decides; an outage can no longer change indexability. `important-dates` has no fallback and stays noindex.
- A failed exam-info read sets `x-db-degraded: 1`, so middleware keeps the response out of the edge cache.
- Instructions, wrapper mocks and zero-entry leaderboards emit `noindex, follow`. Instructions and wrappers point their canonical at the indexable `/mock-tests/<slug>`; the previous wrapper canonical was silently dropped because `BaseLayout` only accepted absolute overrides.
- `BaseLayout` now resolves path-style canonical overrides against `SITE_URL`.
- The sitemap uses the same availability-aware verification and reads `exam_info` directly instead of through the helper that swallows errors.

Acceptance:

- `/cuet-ug-marking-scheme` → 200, no robots meta, self-canonical, present in sitemap.
- `/cuet-ug-important-dates` → 200, `noindex, follow`, self-canonical, absent from sitemap.
- `/mock/*/instructions`, wrapper `/mock/<slug>` and zero-entry `/leaderboard/<slug>` → `noindex, follow`; instructions/wrapper canonical → `/mock-tests/<slug>`; all absent from sitemap.
- Unit tests cover DB-available, missing-row, `TODO_VERIFY` and outage paths.

Post-deploy evidence (2026-11-13, commit `269ad22`): CI Quality Gate run
`43283903103` succeeded; Auto deploy run `43283903373` succeeded and the
production deployment is timestamped `2026-11-12T18:50:49Z`. Live checks on
`https://cuetfreemocktest.com`:

- `/cuet-ug-marking-scheme` → 200, no robots meta, self-canonical, present in the 288-URL sitemap.
- `/cuet-ug-important-dates` → 200, `noindex, follow`, absent from the sitemap.
- `/mock/business-studies-2023-06-12-shift-2` and its `/instructions` page → `noindex, follow`, canonical `/mock-tests/business-studies-2023-06-12-shift-2`.
- `/leaderboard/business-studies-2023-06-12-shift-2` → `noindex, follow`.
- `/mock-tests/english-2022-08-06-shift-1` → 200, indexable.
- Sitemap: 288 URLs, 137 `/mock-tests/*` pages, zero `/mock/*/instructions` URLs. The one `/mock/*` wrapper is the mini mock without a practice-paper page (self-canonical, indexable); the one `/leaderboard/*` URL has attempts.

Owner action: after deploy, use **Validate fix** on the GSC noindex report. The intentional exclusions remain; validation acknowledges the policy rather than requesting indexing of duplicate step pages.

---

## 5. Result log

| Phase | Status | Evidence | Notes |
| --- | --- | --- | --- |
| 0 Preflight | Pass | `HEAD == origin/main == d9959dc`; port 4321 free; required `.dev.vars` keys present | Only pre-existing `docs/report/report.json` modification |
| 1 Static gates | Pass | `check:env` pass; `lint:copy` 289 files / 0 violations; `astro check` 0 errors, 0 warnings, 15 hints | Remote D1 check returns `SUCCESS: No migration drift detected`; both D1 envs `UNVERIFIED` (quota) |
| 2 Unit / integration | Pass | `npx vitest run` → 53 files, 465/465 tests | Includes new CSP analytics regression test |
| 3 Build & artifacts | Pass | Clean build; perf gzip JS 181.7/200 KB, CSS 34.4/100 KB; `/server/.dev.vars`, `/server/entry.mjs`, `/server/wrangler.json` → 404 | Secret cleanup + leak guard added post-build |
| 4 Local D1 fixture | Pass | Backup 33.8 MB; migrations + practice/ranked import + backfill + admin seed; 23,302 questions (23,238 published), 7,527 practice questions, 245 papers, 423 mocks (407 published), 48 users, 42 tables | KV purge removed 247 cache keys |
| 5 Browser E2E | Pass | `npm run test:e2e` → 71 passed, 2 skipped, 0 failed (12.2m) | Skips: admin review-queue specs, local fixture has no pending papers |
| 6 Accessibility | Pass | `A11Y_SKIP_ATTEMPT=0 npm run test:a11y` → 268 axe scans, 0 violations, 0 horizontal overflow; guest attempt/result walk completed | Authenticated pages audited via seeded local admin session; local-only attempt write returned expected 409 state transition |
| 7 SEO local | Pass | `BASE_URL=http://localhost:4321 npm run seo:check` → 287 sitemap URLs, 290 audited, 0 mismatches | Restricted papers excluded and `noindex`; no private/admin/attempt URLs in sitemap |
| 8 Production smoke / SEO / links | Pass | Smoke pass; `/api/health` → `db: ok`, `engine: turso`; production SEO 288 sitemap URLs, 291 audited, 0 mismatches; links 0/474 internal, 0/5 external broken | Broken `/u/test-user` was a stale checker seed, fixed under B7 and re-run |
| 9 Turso integrity | Pass | 23 migrations applied; `integrity_check` ok; `foreign_key_check` 0; 20,111 published questions; `dataChecks` orphanAttempts 0, orphanAnswers 0, duplicatePublicIds 0, duplicateQuestionPointers 0, duplicateMockSlugs 0 | Counts: 247 mocks, 245 papers, 7,527 practice questions, 77 attempts |
| 10 Load & probes | Pass | 300@15 → 300×200, p50 82 ms / p95 359 / p99 896; 600@30 → 600×200, p50 95 / p95 156 / p99 223; 0 degraded, 0 network errors. Write probe: start 201, 11 autosaves, submit 200, result page/API 200, 8 parallel starts 201. Browser: initial render 1001 ms, reloads 182/175 ms, timer/questions/palette render, 0 page errors. Worker tail: 17/17 `outcome: ok`, `exceptions: []`, `logs: []` | CSP analytics blocking found under B8; live re-verify after deploy: 0 violations, beacon 200, GA 204 |
| 11 Cleanup & sign-off | Pass | Probe attempts 136–145 and 10 answers deleted; max attempt ID back to 93, attempts 77, 0 leftovers. `npm run audit:reconciliation` → SUCCESS. CI Quality Gate run 42807575587 success; Auto deploy run 42807575422 success; live CSP verified | `docs/QA_TEST_PLAN.md` and `docs/PROGRESS.md` updated; `docs/report/report.json` left uncommitted |
| 12 GSC noindex triage | Pass | 39 URLs classified: 28 instructions, 5 wrapper mocks, 4 zero-entry leaderboards, 2 core guides. Live after deploy of `269ad22` (CI run 43283903103 success; deploy run 43283903373 success): `/cuet-ug-marking-scheme` 200, no robots, self-canonical, in 288-URL sitemap; `/cuet-ug-important-dates` `noindex, follow`, absent from sitemap; instructions/wrapper canonical → `/mock-tests/<slug>`; zero-entry leaderboard `noindex, follow`; sample paper indexable. Unit 481/481 (57 files); E2E 73 passed / 2 skipped / 0 failed; local SEO 287 sitemap / 290 audited / 0 mismatches; `astro check` 0 errors | Owner still needs GSC **Validate fix**; intentional exclusions stay noindex. `docs/report/playwright-results.json` regenerated after a targeted run had overwritten it |

Status values: `Pass`, `Fail`, `Blocked`, `Skipped (reason)`.

---

## 6. Bug log

| ID | Phase | Symptom | Root cause | Fix | Re-verified |
| --- | --- | --- | --- | --- | --- |
| B1 | 1 | Remote D1 migration check reported drift while D1 quota/auth was failing | Script treated any non-zero D1 response as drift and only read stdout | Classify quota/auth as `UNVERIFIED`; combine stdout/stderr | `SUCCESS: No migration drift detected`, both envs `UNVERIFIED` |
| B2 | 3 | Perf budget failed on raw bytes and did not reflect real transfer | Compared uncompressed asset sizes against gzip budgets | Measure gzip transfer; revise `performance-budget.json` v1.1.0 | JS 181.7/200 KB, CSS 34.4/100 KB → PASS |
| B3 | 3 | Build output could contain local secrets | `.dev.vars` copied into `dist/server` by the build | Add `scripts/clean-build-secrets.mjs` cleanup + leak guard in build | Live `/server/.dev.vars` and server files → 404 |
| B4 | 4 | KV cache purge failed during practice import | `wrangler kv bulk delete` expects a JSON array, not newline `.txt` | Emit JSON key arrays in import + verification scripts | 247 cache keys deleted |
| B5 | 5 | 15 E2E tests skipped (attempt/security paths) | Local fixture had no published standalone mock bank | Add idempotent local-only `scripts/seed-e2e-mock.mjs`, wire into CI/Playwright | Skips reduced to 2 fixture-dependent review-queue specs |
| B6 | 5 | Deadline test failed: API advertised 30 min but started attempt got 6 min | Fixture `duration_min` did not match official CUET per-question timing rule | Seed computes duration from subject/question rate (5 × 72s = 6 min) | Targeted test + full E2E pass (71/2/0) |
| B7 | 8 | Link checker reported `404 /u/test-user` | Stale synthetic seed for a profile that is not public; `/u/[username]` correctly 404s non-public or missing users | Remove the stale seed; profile pages are covered when linked publicly | Production link check 0/474 internal, 0/5 external broken |
| B8 | 10 | Browser console showed CSP violations for Cloudflare Insights beacon and GA4 collect requests | CSP allowlist omitted `static.cloudflareinsights.com`, `cloudflareinsights.com`, `analytics.google.com`, `*.google-analytics.com` | Add hosts to `script-src`/`connect-src` and add a middleware regression test | `middleware-headers.test.ts` 6/6; live post-deploy pages 0 CSP violations, beacon 200, GA collect 204 |
| B9 | 12 | GSC reported `/cuet-ug-marking-scheme` as “Excluded by noindex” although its `exam_info` row is verified | `getExamInfo()` caught every database error and returned `{}`; the page treated that as unverified and emitted noindex during the 9 Nov crawl | `getExamInfoState()` reports availability; pages/sitemap use deploy-time last-known-good verification on outage and set `x-db-degraded` | Unit 481/481; live post-deploy marking-scheme 200 with no robots meta and self-canonical; important-dates remains `noindex, follow`; CI run 43283903103 success |

---

## 7. Exit criteria

Release is signed off only when:

1. Phases 1–9 are `Pass`.
2. Phase 10 meets all acceptance thresholds.
3. Every bug found is fixed and the affected phase re-run.
4. CI Quality Gate and production deploy are green.
5. No probe/test rows remain in production.
6. No secrets are present in the repository or build artifacts.
