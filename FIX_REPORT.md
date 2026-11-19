# FIX_REPORT — Phase C outcomes for the complete QA pass (2026-11-19)

Baseline: `26e5b3e` (Phase 0). Two safe fixes were applied, verified and pushed to `main`. Everything else is a documented, pending owner decision (code changes with visible effect, data fixes, or editorial work).

## 1. Global before/after

| Metric | Before | After | Where |
| --- | --- | --- | --- |
| Unit tests | 656/656 (75 files) | **667/667** (78 files) | `npm test` |
| E2E chromium | 109 passed / 2 skipped | **109 passed / 2 skipped** (deliberately deselected: both admin review-queue specs self-skip on an empty fixture queue) | `npm run test:e2e` |
| axe scans (272) | 0 violations / 0 overflow | unchanged: **0 violations / 0 overflow** | `npm run test:a11y` |
| Lighthouse (prod build) | 9 routes passed budget | unchanged: **all budgeted routes PASS** (LCP 0.93–1.60 s, transfer 44.8–66 KB, TBT/CLS 0) | `npm run audit:lighthouse` |
| Build | clean (0 err/0 warn) | clean (0 err/0 warn) | `npm run build` |

## 2. Fixes applied

### BUG-002 — ranked PYQ sets enforced a 50-minute timer while every surface advertised 60 minutes (`fix(exam)` `62a27b0`)

**Root cause.** `start.ts` chose the effective duration from `question_count × rate-per-question` instead of the locked paper duration; the `general` family (General Test) uses a 1.0 minute/question rate giving **50 minutes** for the rebuilt 50-question `cuet-general-test-pyq-set-*` sets, while `duration_min` in the database, `getTestStats()` (instructions/cards/result/leaderboard), and all marketing copy say **60 minutes**.

**Fix.** New `rankedDurationMinutes()` helper prefers the stored/locked `duration_min` (what is displayed) over question-count arithmetic; question-count arithmetic remains the fallback for mocks without stored duration. Wired into the attempt endpoint, the attempt page correction, the mock overview and the instructions page. Official CUET rules table untouched for reference.

**Verification.**
- New unit suite `tests/unit/ranked-duration.test.ts` (3 tests: locked-vs-calculated, fallback, invalid stored).
- Live against the rebuilt preview: guest attempt on General Test PYQ Set 18 (mock 337) started at 16:32:13 with `deadline_at` 17:32:13 — **exactly 3600 s**; instructions show 60 min; overview intro shows 60 min; mathematics/english/hindi instructions unchanged at 60 min; attempt × submission path passes.
- Full unit suite **667/667**; attempt-flow, security, api-contracts, local-practice, pyq-rebuild E2E specs **54/54**.

### BUG-003 — attempt-start accepted arbitrarily large request bodies (`fix(api)` `b180582`)

**Root cause.** `/api/attempts/start` parsed the JSON body with no Content-Length guard (verified with a 4 MB POST → 201 Created).

**Fix.** New `bodyLimitExceeds()` guard caps declared Content-Length at 8 KiB for this route with a 413 response; rate limiting remains the secondary control for chunked bodies. Guard is shared and unit-tested.

**Verification.**
- New unit suite `tests/unit/body-limit.test.ts` (3 tests).
- Live: 4 KB body → **201**, 16–256 KB declared bodies → **413** (`{"error":"Request body is too large."}` with `no-store` and full security headers).
- Note: bodies above a few hundred KB are also rejected by the local development platform itself ("Network connection lost", HTTP 500) before the handler — this is a miniflare limitation, not the app; the app's 413 is deterministic when the request reaches it. Production (Cloudflare) does not impose this local cap.

## 3. Fixes held for owner decision (not applied silently)

Each of these would be tabled as a script + dry-run before touching data or visible routes, per the data-change policy. None has been applied.

| ID | What | Options (or need) |
| --- | --- | --- |
| BUG-001 | Archived papers `sociology-2024-05-18-shift-3` and `legal-studies-2022` redirect 301 to empty-subject archive hubs that return 404 | (a) retarget `replaced_by` to the subject practice hubs (`/cuet-mock-test/sociology`, `/cuet-mock-test/legal-studies`, both 200) — 2-row data fix, dry run attached; (b) ship a code-only fix that renders an honest `200`/`noindex` empty state for empty subject hubs; (c) leave as-is (known gap). Need owner decision. |
| BUG-004 | `/cuet-ug-syllabus/legal-studies` returns 404 | Seed Legal Studies topics via migration (as for Sociology's 9 topics), **or** render the honest "No topics mapped yet" state when a subject has 0 topics but >0 published practice questions (code, no data change), **or** accept the 404. Need owner decision. |
| BUG-007 | 25 published questions in rebuilt 50-question sets carry two or more options with identical text (example: mathematics-2025-06-02-shift-1/q08 lists "25" twice) | Editorial curation per question (deduplicate option, remap `correct_option`, replace in immutability-friendly rows only with a new revision) — needs a dry-run list and owner approval. |
| BUG-008 | Same defect in 197 non-locked official-paper rows; 13 near-duplicates; 2 with only 2 options | Editorial curation backlog; produced the list; no bulk automated deletion is proposed. |

For reference the raw curation candidates are in `test-artifacts/data-audit.csv` (duplicate_option rows, near-duplicate rows, option_count rows) with per-row locations, and the full summary in `test-artifacts/data-audit-summary.md`.

## 4. What remains unverified (with reasons)

- Firefox/WebKit E2E — project ships Chromium by design.
- Google OAuth round-trip — needs a loopback-capable OAuth app; failure paths verified instead.
- Production write path — not exercised; all write tests run against local D1.
- Migration-mechanics (`npm run db:turso:migrate`) — not run in this pass; migrations are green on local D1.
- Two admin-flow E2E specs self-skip because the fixture database has no papers pending in the review queue.

## 5. CI-path changes shipped with this report

`.github/workflows/ci.yml` now also gates on:

- **Data Integrity Audit** (`npm run test:data`) — exits non-zero on any P1 integrity invariant;
- **Link & Redirect Check** (`npm run test:links`) — external links are reported, internal links fail the job.

Internal pull-request safety is unchanged: E2E, axe, SEO sitemap audit, unit tests, build remain blocking. Lighthouse stays a local gate (stronger signal than a noisy shared runner; budget passes everywhere, see §1).
