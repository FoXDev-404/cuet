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
- **BUG-001** — local D1 retargeted by `scripts/fix-archived-redirects.mjs` (`practice_papers.replaced_by` + `slug_redirects.target_path`); fresh redirect audit 0/462 failures. Production still needs the owner's `--turso` run (no Turso creds in this session).
- **BUG-007** — 25 locked-set rows carry additive `duplicate-option` review tags (3 also `duplicate-option-in-keypair`) in the local D1; production still needs the owner's `--turso` run. Option texts cannot be repaired without the source PDFs.
- **BUG-008** — editorial backlog; no changes.
- **BUG-009** (this run) — `scripts/qa-data-audit.mjs` now accepts `/cuet-mock-test/<subject>` as a valid archived-paper target; fixed in `fbd384c` with a source-guard regression test. Re-run shows 0 P1.

## Owner action (unchanged from the first pass)

Apply the two approved data fixes to production Turso with your credentials (dry-run first with `--dry-run`), then verify with read-only curl; exact commands and expected 301 targets are in `TEST_REPORT.md` §6 and in the original `FIX_REPORT` instructions. All other fixes are already deployed and verified.

## Regressions introduced by the fresh run

None. The only tracked-file changes from this run are refreshed evidence (`docs/report/a11y-results.json`, `docs/report/lighthouse/*`), the two new report artifacts and the BUG-009 tooling fix.
