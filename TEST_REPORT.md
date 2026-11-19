# TEST_REPORT — fresh full QA re-run (2026-11-19 evening)

This is a **from-scratch re-execution of Phases 0–A** on the fixed codebase (`fbd384c`), not a copy of the earlier report. Baseline, data audit, crawls, security probes, full E2E, axe, SEO and Lighthouse were all run again and their artifacts in `test-artifacts/`, `docs/report/a11y-results.json` and `docs/report/lighthouse/` overwritten with the new evidence. Production was queried **read-only** only.

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

**Findings:** 0 new P0/P1 application bugs in this re-run. One QA-tooling false positive was found and fixed (BUG-009). All six earlier application/data bugs are resolved or explicitly dispositioned (see §2). **Release verdict: GO**, with the two owner-side production data steps in §4 still outstanding.

## 2. Full bug table (status after this re-run)

| ID | Sev | Area / route | Expected vs. actual (condensed) | Evidence | Suspected file | Status |
| --- | --- | --- | --- | --- | --- | --- |
| BUG-001 | P2 | Archived paper 301 chains (`/mock/<slug>`, `/mock-tests/<slug>`) | 301 → 200 vs. 301 → 404 empty hub for 2 papers | `scratch/qa-redirect-audit.mjs` (fresh run: 0/462 failures locally) | `practice_papers.replaced_by`, `slug_redirects.target_path` | **Fixed locally** (retargeted to subject practice hubs); production needs owner's `--turso` run |
| BUG-002 | P2 | General Test ranked sets / attempt deadline | 60 min advertised vs. 50 min enforced | DB attempt deadline arithmetic (3,000 s before; 3,600 s after) | `src/lib/ranked-duration.ts`, `start.ts` | **Fixed & live** (`62a27b0`) |
| BUG-003 | P2 | `/api/attempts/start` body size | 413 vs. 201 for 4 MB | Fresh probes: 4 KB→201, 16/64/256 KB→413 | `src/lib/body-limit.ts`, `start.ts` | **Fixed & live** (`b180582`) |
| BUG-004 | P2 | `/cuet-ug-syllabus/legal-studies` | 200 empty state vs. 404 | Fresh local 200; live production 200 (deploy `baed73ad`) | `src/pages/cuet-ug-syllabus/[subject].astro` | **Fixed & live** (`714532e`) |
| BUG-007 | P2 | 25 locked-set questions, duplicate options | No duplicate options vs. identical pairs (3 with key inside pair) | `test-artifacts/curation-proposal-25.md`, `data-audit.csv` | `practice_questions.options_json` / `review_flags_json` | **Curation applied locally** (additive review tags); production needs owner's `--turso` run |
| BUG-008 | P3 | 197 official-paper duplicate options, 13 near-dups, 2 two-option rows | n/a — editorial debt | `test-artifacts/data-audit.csv` | `practice_questions.options_json` | **Backlog** (owner-approved, no changes) |
| BUG-009 | P3 | QA tooling — `scripts/qa-data-audit.mjs` | Approved practice-hub redirect targets were flagged as unknown paper slugs (2 false P1s) | Fresh A4 run initially reported 2 P1s; after fix 0 P1 | `scripts/qa-data-audit.mjs` | **Fixed** (`fbd384c`) with source-guard regression test |

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
| Unit (`npm test`) | 668/668, 79 files | console + this report |
| E2E (`npm run test:e2e`, Chromium) | 109 passed / 2 skipped / 0 failed | `test-artifacts/e2e-results.json` |
| Data audit (`npm run test:data`) | 0 P1, 21,046 editorial findings | `test-artifacts/data-audit.csv` |
| a11y (`npm run test:a11y`) | 272/272 pass | `docs/report/a11y-results.json` |
| Link check (`npm run test:links`) | 0/345 internal, 0/40 external broken | console |
| Sitemap crawl / SEO | 213 URLs all 200; 0 SEO mismatches | `test-artifacts/qa-sitemap-check.csv`, `qa-titles.csv` |
| Redirect audit | 462 targets, 0 failures locally | console + `scratch/qa-redirect-audit.mjs` |
| Responsive | 72 screenshots, 0 overflow | `test-artifacts/screenshots/`, `responsive-overflows.txt` |

Deliberately untested, with reasons: Firefox/WebKit (repository ships a Chromium-only Playwright project); Google OAuth round-trip (no loopback OAuth app — failure paths and seeded admin used instead); physical device lab; production write paths (read-only production policy — all writes against local D1); Cloudflare Pages preview deploys (this project deploys Workers, not Pages); `npm run db:turso:migrate` against production (not re-run; local migrations clean). The two admin review-queue E2E specs self-skip because the fixture DB has nothing pending in that queue.

## 6. Owner action still required (production data)

The two approved data fixes are applied and verified in the local D1 but **not in production**, because this session does not hold Turso write credentials (never printed or requested):

```sh
node --env-file-if-exists=.dev.vars scripts/fix-archived-redirects.mjs --turso   # BUG-001
node --env-file-if-exists=.dev.vars scripts/flag-duplicate-options.mjs --turso   # BUG-007
```

Details, dry-run commands and read-only verification URLs are in `FIX_REPORT.md` §4.
