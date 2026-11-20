# TEST_REPORT — fresh full QA re-run (2026-11-19 evening)

This is a **from-scratch re-execution of Phases 0–A** on the fixed codebase (`fbd384c`), not a copy of the earlier report. Baseline, data audit, crawls, security probes, full E2E, axe, SEO and Lighthouse were all run again and their artifacts in `test-artifacts/`, `docs/report/a11y-results.json` and `docs/report/lighthouse/` overwritten with the new evidence. Production was queried **read-only** only.

## Frontend re-verification — 2026-11-20 (HEAD `961e3c5`)

A second fresh frontend pass was run on the current HEAD. No application source changed; only evidence artifacts were refreshed.

| Gate | Fresh result |
| --- | --- |
| Build + typecheck | **PASS** — `astro check` 0 errors / 0 warnings (644 files), build complete, secret guard PASS |
| E2E (Chromium) | **109 passed / 2 skipped / 0 failed**, exit 0 |
| a11y | **272 axe scans, 0 WCAG A/AA violations, 0 horizontal overflow**, exit 0 |
| Responsive | **72 screenshots** (360/390/768/1024/1440/1920 × light/dark), **0 overflow** |
| Mobile flow (390×844) | mock list → instructions → begin → answer → submit → result → solutions; **0 page errors**, no overflow at every step |
| Links | **0/345 internal broken, 0/40 external broken**, exit 0 |
| Sitemap | **213/213 URLs return 200**, 0 redirects |
| Lighthouse (mobile, 3-run median) | **8/8 budgets PASS** — Perf/A11y/Best Practices 100, LCP 0.93–1.60 s, TBT/CLS 0, transfer 44.8–65.9 KB |
| SEO consistency | **213 sitemap URLs = 213 indexable URLs, 0 mismatches** |
| Unit | **670/670** (80 files), exit 0 |
| Data integrity | **0 P1** (21,046 P2/P3 editorial findings) |

Notes: the first data-audit attempt raced `seo:check`'s wrangler shutdown for the local D1 file and exited non-zero; a clean rerun passed. One dev-server-only Astro console warning (`audit's match function: Failed to fetch`) appeared during E2E startup and does not affect any request, test, or the production build. The 2 skipped E2E specs remain the admin review-queue flows that self-skip on the empty fixture.

## 1. Executive summary

| Area | Area | Result |
| --- | --- | --- |
| Phase 0 / baseline | Build + typecheck | **PASS** — 0 errors, 0 warnings (644 files checked), secret scan PASS |
| Phase 0 | Unit suite | **PASS** — 668/668 (79 files) |
| Phase 0 | npm audit / copy lint / env guard | **PASS** — 0 vulns, 0 violations, engine guard PASS |
| A1 | Static | PASS — 1 circular import (type-only, no runtime cycle); 4 forbidden-file patterns checked; no secrets in HEAD or history; largest client chunk 288 KB |
| A2 | Unit coverage | PASS — scoring, ranking, timers, stats (new tests added in the earlier pass) |
| A3 | API / DB | PASS — no answer/explanation leakage, server-side scoring, deadlines, IDOR, rate limits, 413 body guard, CORS/XSS probes clean |
| A4 | Data integrity | **PASS — 0 P1** (21,046 findings, all P2/P3 editorial debt) |
| A5 | Routing / links | PASS — 213/213 sitemap URLs 200, 462/462 redirects resolve, 0/345 internal broken links, custom 404 works |
| A6 | E2E (Chromium) | **PASS — 109 passed, 2 skipped** (0 failed / 0 flaky) |
| A7 | Responsive | PASS — 72 screenshots (6 widths × 2 themes × 6 pages), 0 horizontal overflow |
| A8 | Accessibility | **PASS — 272 axe scans, 0 WCAG A/AA violations, 0 overflow** |
| A9 | Performance | **PASS — 8/8 budgeted Lighthouse routes**; LCP 0.93–1.60 s, TBT/CLS 0, transfer 44.8–66 KB |
| A10 | SEO | **PASS — 213 sitemap URLs, 213 indexable pages, 0 mismatches**; 0 duplicate titles/descriptions |
| A11 | Security headers / privacy | PASS — all headers present on public/private; no before-consent analytics; 4 XSS payloads do not execute |
| A12 | Visual baselines | Baselines captured locally; committed `toHaveScreenshot` baselines intentionally deferred (Windows↔Linux font noise) |

**Findings:** 0 new P0/P1 application bugs in this re-run. One QA-tooling false positive was found and fixed (BUG-009). All six earlier application/data bugs were resolved or dispositioned; in the follow-up to this re-run the two production data fixes were also applied and verified live (see below). **Release verdict: GO.**

## 2. Full bug table (status after this re-run)

| ID | Sev | Area / route | Expected vs. actual (condensed) | Evidence | Suspected file | Status |
| --- | --- | --- | --- | --- | --- | --- |
| BUG-001 | P2 | Archived paper 301 chains (`/mock/<slug>`, `/mock-tests/<slug>`) | 301 → 200 vs. 301 → 404 empty hub for 2 papers | Production read-only curl: all 4 URLs 301 → practice hubs, both 200 | `practice_papers.replaced_by`, `slug_redirects.target_path` | **FIXED LIVE** — 4 rows retargeted in production Turso |
| BUG-002 | P2 | General Test ranked sets / attempt deadline | 60 min advertised vs. 50 min enforced | DB attempt deadline arithmetic (3,000 s before; 3,600 s after) | `src/lib/ranked-duration.ts`, `start.ts` | **Fixed & live** (`62a27b0`) |
| BUG-003 | P2 | `/api/attempts/start` body size | 413 vs. 201 for 4 MB | Fresh probes: 4 KB→201, 16/64/256 KB→413 | `src/lib/body-limit.ts`, `start.ts` | **Fixed & live** (`b180582`) |
| BUG-004 | P2 | `/cuet-ug-syllabus/legal-studies` | 200 empty state vs. 404 | Fresh local 200; live production 200 (deploy `baed73ad`) | `src/pages/cuet-ug-syllabus/[subject].astro` | **Fixed & live** (`714532e`) |
| BUG-007 | P2 | 25 locked-set questions, duplicate options | No duplicate options vs. identical pairs (3 with key inside pair) | `test-artifacts/curation-proposal-25.md`, `data-audit.csv`; Turso read-only: 25 flagged, 3 keypair | `practice_questions.options_json` / `review_flags_json` | **CURATION LIVE** — 25 additive review tags in production Turso; option texts need source PDFs |
| BUG-008 | P3 | 197 official-paper duplicate options, 13 near-dups, 2 two-option rows | n/a — editorial debt | `test-artifacts/data-audit.csv` | `practice_questions.options_json` | **Backlog** (owner-approved, no changes) |
| BUG-009 | P3 | QA tooling — `scripts/qa-data-audit.mjs` | Approved practice-hub redirect targets were flagged as unknown paper slugs (2 false P1s) | Fresh A4 run initially reported 2 P1s; after fix 0 P1 | `scripts/qa-data-audit.mjs` | **Fixed** (`fbd384c`) with source-guard regression test |
| BUG-010 | P3 | QA tooling — production one-off scripts | `--turso` aborted with "credentials missing" and a kind-agnostic pre-flight | Both `--turso` runs succeeded after the fix | `scripts/fix-archived-redirects.mjs`, `scripts/flag-duplicate-options.mjs` | **Fixed** with 2 regression tests |

## 3. Data integrity summary (fresh A4 run)

All 118 non-archived `duration_locked = 1` rebuilt sets have **exactly 50** non-deleted practice questions; `duration_min = 60` for all; every published set wrapper mock points at 50 ranked questions; 0 orphaned passages/questions; 0 dangling mock_questions; 0 duplicate slugs. `npm run test:data` exits 0 (0 P1).

Editorial P2 debt by subject (practice questions with no explanation / total): accountancy 847/847, business-studies 632/632, economics 224/224, political-science 260/260, legal-studies 38/38, psychology 50/50, sociology 49/49; english 484/1951, general-test 301/2058, history 278/740, biology 138/1602, chemistry 88/1741, physics 54/1277, geography 15/383, mathematics 13/933, applied-mathematics 8/141, computer-science 2/306, hindi 99/195. Ranked-bank counts follow the same shape. Overall missing explanations: 7,242. Duplicate-option rows: 222 (25 in rebuilt sets → BUG-007, 197 in official papers → BUG-008). Near-duplicate stems: 13. Two-option questions: 2.

Full per-subject tables: `test-artifacts/data-audit-summary.md`; row-level CSV: `test-artifacts/data-audit.csv`.

## 4. Lighthouse summary (fresh production-build run, mobile/light, 3-run median)

| Route | Perf | A11y | Best Pract | SEO | LCP | TBT | CLS | Transfer | Budget |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | 100 | 100 | 100 | 100 | 0.93 s | 0 ms | 0 | 57.1 KB | PASS |
| Mock Test Hub | 100 | 100 | 100 | 100 | 0.94 s | 0 ms | 0 | 58.6 KB | PASS |
| Subject Hub | 100 | 100 | 100 | 100 | 0.93 s | 0 ms | 0 | 55.1 KB | PASS |
| Mock Detail | 100 | 100 | 100 | 69 | 0.95 s | 0 ms | 0 | 61.2 KB | PASS |
| Instructions | 100 | 100 | 100 | 69 | 0.93 s | 0 ms | 0 | 52.0 KB | PASS |
| Attempt Screen | 100 | 100 | 100 | 58 | 1.60 s | 0 ms | 0 | 65.9 KB | PASS |
| Result Screen | 100 | 100 | 100 | 69 | 0.94 s | 0 ms | 0 | 62.0 KB | PASS |
| Admin Dashboard | 100 | 100 | 100 | 63 | 1.10 s | 0 ms | 0 | 44.8 KB | PASS |

axe: **272 scans, 0 WCAG A/AA violations, 0 horizontal overflow** (light/dark at 375 & 1280). SEO scores below 90 are on deliberately `noindex` private pages and are not a budget gate. Raw JSON in `docs/report/lighthouse/`, `docs/report/a11y-results.json`.

## 5. Coverage and untested areas

| Suite | Result | Artifact |
| --- | --- | --- |
| Unit (`npm test`) | 670/670, 80 files | console + this report |
| E2E (`npm run test:e2e`, Chromium) | 109 passed / 2 skipped / 0 failed | `docs/report/playwright-results.json` (tracked) + `test-artifacts/e2e-frontend-verify.json` (local copy) |
| Data audit (`npm run test:data`) | 0 P1, 21,046 editorial findings | `test-artifacts/data-audit.csv`, `test-artifacts/data-audit-summary.md` |
| a11y (`npm run test:a11y`) | 272/272 pass | `docs/report/a11y-results.json` |
| Link check (`npm run test:links`) | 0/345 internal, 0/40 external broken | `test-artifacts/links-frontend-verify.log` |
| Sitemap crawl / SEO | 213 URLs all 200; 0 SEO mismatches | `test-artifacts/qa-sitemap-frontend-verify.csv`, `test-artifacts/qa-titles.csv` |
| Redirect audit | 462 targets, 0 failures locally | console + `scratch/qa-redirect-audit.mjs` (local-only) |
| Responsive | 72 screenshots, 0 overflow | `test-artifacts/screenshots/`, `test-artifacts/responsive-frontend-verify.log` |

### 5.1 Artifact integrity (2026-11-20)

A read-only validator parsed every machine-readable artifact and recomputed the reported numbers rather than trusting filenames. All required checks pass; the only gaps are evidence portability, not test results.

- **E2E JSON:** 111 specs / 111 tests / 111 results — 109 passed, 2 skipped, 0 failed, 0 flaky, 580 s.
- **axe JSON:** 272 scans at 375 px and 1280 px, both themes, 65 paths, 0 violations, 0 overflow, run against `961e3c5`.
- **Lighthouse:** 8 routes × 3 runs; every reported median recomputes from the raw run files; 64 required budget checks pass.
- **Data audit CSV:** 21,046 rows, 0 P1. **Sitemap CSV:** 213 rows, all HTTP 200, 0 redirects.
- **Screenshots:** 76 valid PNGs — 72 responsive (6 pages × 6 widths × 2 themes) and 4 mobile-flow shots at 390×844 @2x.
- **Logs and report:** every claimed summary is present, and `TEST_REPORT.md` matches the JSON/CSV values.

Evidence portability:

- **Committed:** `docs/report/playwright-results.json`, `docs/report/a11y-results.json`, and `docs/report/lighthouse/`.
- **Local-only:** everything under `test-artifacts/` is gitignored. Raw logs, screenshots, sitemap/data CSVs and mobile-flow shots exist only on the machine that ran the suite; rerun the gate to regenerate them.
- **CI:** every run now uploads the E2E JSON, HTML report, failure traces and data-audit outputs for 7 days, including green runs.

Known evidence gaps: unit line coverage is not measured (`@vitest/coverage-v8` is not installed, so "coverage" here means test scope, not a percentage); the 462-redirect audit depends on a local-only script under ignored `scratch/`; browser coverage is Chromium-only.

Deliberately untested, with reasons: Firefox/WebKit (repository ships a Chromium-only Playwright project); Google OAuth round-trip (no loopback OAuth app — failure paths and seeded admin used instead); physical device lab; production write paths (read-only production policy — all writes against local D1); Cloudflare Pages preview deploys (this project deploys Workers, not Pages); `npm run db:turso:migrate` against production (not re-run; local migrations clean). The two admin review-queue E2E specs self-skip because the fixture DB has nothing pending in that queue.

## 6. Production data fixes — applied and verified

The two approved data fixes were applied to production Turso in the follow-up to this re-run (with `.dev.vars` credentials, never printed):

- **BUG-001:** `scripts/fix-archived-redirects.mjs --turso` — 4 rows updated (2 `practice_papers.replaced_by`, 2 `slug_redirects.target_path`). Read-only production curl verified all four legacy URLs now `301 → /cuet-mock-test/<subject>`, and both targets return **200**.
- **BUG-007:** `scripts/flag-duplicate-options.mjs --turso` — 25 additive `review_flags_json` tags applied. Read-only Turso query verified 25 flagged rows, including the 3 `duplicate-option-in-keypair` rows. No question text, options or answer keys were changed.

The one remaining content item (BUG-008) is an approved editorial backlog; rewriting duplicate option texts requires the source PDFs, which are not in this repo.
