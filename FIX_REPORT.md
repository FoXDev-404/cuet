# FIX_REPORT — fresh verification re-run (2026-11-19 evening)

This re-run re-executed Phases 0–A on the fixed codebase and overwrote all report artifacts. The table below compares the **first pass** with this **fresh pass**; no new application defects were found in that pass, and one QA-tooling false positive (BUG-009) was found and fixed. A later production inventory found BUG-011 (below).

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

## Production correction — English mini mock (BUG-011, 2026-11-20)

A production inventory taken after the re-run found that mock #2, the English “mini mock”, was the only published mock outside the 50-question policy: **5 questions, 10 minutes, 25 marks**. It was live at `/mock/cuet-ug-english-grammar-mini-mock`.

**Fix applied.** `scripts/fix-english-mini-mock-v2.mjs` created **version 2 (#1128)** with the five original questions at positions 1–5 plus 45 published English questions whose IDs were unused by any other published mock. Version 2 has **50 questions, 60 minutes, 250 marks** and marking `{"correct":5,"wrong":-1,"skipped":0}`. Version 1 (#2) was **superseded, not deleted**; the slug was kept and the title became “CUET UG English - Grammar and Usage Mock”.

**Attempt safety.** The six submitted attempts (`54, 55, 59, 60, 61, 62`) and their **30 answer rows** remain pinned to version 1 by `attempts.version_id`. No attempt or answer row was updated, deleted or repointed, and scoring/review resolve questions through that stored version.

**Safety and rollback evidence.** The script runs a read-only dry run, validates the target and all 50 questions, writes a pre-write JSON backup under `test-artifacts/backups/`, and performs one libSQL write transaction with post-apply verification. A disposable-database run and a forced mid-transaction failure both rolled back cleanly. The first production attempt was also rejected by `trg_frozen_version_question_insert` and rolled back with no writes; the sequence was corrected to **draft version → insert questions → publish → supersede v1 → update `mock_tests`**.

**Production verification (read-only after apply).** Mock #2 now has `current_version_id = 1128`; v1 is `superseded` with 5 questions, v2 is `published` with 50; the live URL returns **200** with 50 questions, 60 minutes, 250 marks and 6 attempts; all **133** published mocks now have exactly 50 questions and contiguous positions 1–50.

**Prevention.** `publishMockVersion` now rejects any version that does not have exactly 50 questions, `qa-data-audit.mjs` rates a published non-50 version **P1**, and regression tests cover both the publish gate and the audit rule. The admin E2E publish flow now selects 50 questions, so the test exercises the real invariant. Full unit suite: **677/677 (81 files)**; build **0 errors / 0 warnings**; data audit **0 P1**.

**Content note.** The 50 are distinct question **IDs**, but 43 of the 50 stems also occur in another live English paper. That is pre-existing text-level repetition across English PYQ papers, not ID reuse; the selection criterion was unused IDs. If globally unique stems are required, 147 distinct unused English texts were available at the time and a v3 can be prepared.

## E2E stability (BUG-012, 2026-11-20)

Four consecutive full Chromium runs exposed test-budget flakes in DB-heavy specs: **107/2/2**, **108/2/1**, **108/2/1**, then **109 passed / 2 skipped / 0 failed** after the fix. The failures were 30 s test-timeout overruns in admin, attempt and discussion flows, plus one publish run that observed 10/50 selected after 50 checks. Specs that drive local D1 through Wrangler now call `test.slow()`, and the admin publish test re-applies the title, section order and any missing checks in an idempotent `expect(...).toPass()` loop. No application code or production data changed for BUG-012; the final full run is 647 s.

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

All approved fixes are now deployed or applied in production. The residual items are the editorial backlog (BUG-008), the 3 class-C questions whose duplicate correct-looking options need source-PDF review, and optional text-level de-duplication of repeated English stems (not a release blocker). No automated change is safe without source assets or explicit owner approval.

## Regressions introduced by the fresh run

None. Tracked-file changes are refreshed evidence (`docs/report/a11y-results.json`, `docs/report/lighthouse/*`), the two new report artifacts, the BUG-009 tooling fix and the BUG-011 correction described above.
