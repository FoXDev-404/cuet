# FIX_REPORT — fresh verification re-run (2026-11-19 evening)

This re-run re-executed Phases 0–A on the fixed codebase and overwrote all report artifacts. The table below compares the **first pass** with this **fresh pass**; no new application defects were found, and one QA-tooling false positive (BUG-009) was found and fixed.

## Before/after (first pass → fresh re-run)

| Metric | First pass | Fresh re-run |
| --- | --- | --- |
| Unit tests | 667/667 (78 files) | **668/668** (79 files, +BUG-009 guard) |
| E2E (Chromium) | 109 passed / 2 skipped | **109 passed / 2 skipped** (0 failed) |
| axe scans | 272, 0 violations | **272, 0 violations, 0 overflow** |
| Lighthouse budgets | 8/8 PASS | **8/8 PASS** (LCP 0.93–1.60 s, TBT/CLS 0) |
| Data audit P1 | 0 (after retarget + checker fix) | **0** (21,046 P2/P3 editorial findings) |
| Sitemap/redirect/links | 213 URLs, 462 redirects, 345 links — all clean | **same** — all clean |
| Build | 0 errors / 0 warnings | **0 errors / 0 warnings** |

## Fixes still in force from the first pass

- **BUG-002** (`fix(exam)`, `62a27b0`) — stored locked duration now authoritative for attempt deadlines; General Test sets enforce 60 minutes. Live.
- **BUG-003** (`fix(api)`, `b180582`) — 8 KiB body cap on attempt-start; 4 KB→201, 16–256 KB→413 re-verified this run. Live.
- **BUG-004** (`714532e`) — `/cuet-ug-syllabus/legal-studies` renders the honest empty state; re-verified 200 locally and in production (`baed73ad`). Live.
- **BUG-001** — production Turso retarget applied via `scripts/fix-archived-redirects.mjs --turso` (4 rows: 2 `replaced_by`, 2 `target_path`). Read-only curl verified all four legacy URLs now `301 → /cuet-mock-test/<subject>` with both targets **200**. **FIXED LIVE.**
- **BUG-007** — production Turso curation applied via `scripts/flag-duplicate-options.mjs --turso` (25 additive review flags; 3 with `duplicate-option-in-keypair`). Verified by read-only Turso query: 25 flagged rows, 3 keypair rows. No text/options/keys changed. **FIXED LIVE.**
- **BUG-008** — editorial backlog; no changes.
- **BUG-009** (re-run) — `scripts/qa-data-audit.mjs` now accepts `/cuet-mock-test/<subject>` as a valid archived-paper target; fixed in `fbd384c` with a source-guard regression test. Re-run shows 0 P1.
- **BUG-010** (this turn) — both `--turso` scripts checked `config.token` instead of `config.authToken` (false "credentials missing") and the redirect pre-flight applied the `is_archived` check to slug-redirect rows (abort before write). Fixed in both scripts with 2 regression tests; both `--turso` runs then succeeded.

## Owner action (none outstanding for code/data)

All approved fixes are now deployed or applied in production. The only residual is the editorial backlog (BUG-008) and the 3 class-C questions whose duplicate correct-looking options need source-PDF review; no automated change is safe without those source assets.

## Regressions introduced by the fresh run

None. Tracked-file changes are refreshed evidence (`docs/report/a11y-results.json`, `docs/report/lighthouse/*`), the two new report artifacts and the BUG-009 tooling fix.
