# FIX_REPORT — Phase C outcomes for the complete QA pass (2026-11-19)

Baseline: `26e5b3e` (Phase 0). Two safe code fixes were applied, verified and pushed to `main`; two owner-approved data fixes are applied in the local D1 with production pending the Turso write credentials; one editorial item was accepted as backlog by the owner.

## 1. Global before/after

| Metric | Before | After | Where |
| --- | --- | --- | --- |
| Unit tests | 656/656 (75 files) | **667/667** (78 files) | `npm test` |
| E2E chromium | 109 passed / 2 skipped | **109 passed / 2 skipped** (deliberately deselected: both admin review-queue specs self-skip on an empty fixture queue) | `npm run test:e2e` |
| axe scans (272) | 0 violations / 0 overflow | unchanged: **0 violations / 0 overflow** | `npm run test:a11y` |
| Lighthouse (prod build) | 9 routes passed budget | unchanged: **all budgeted routes PASS** (LCP 0.93–1.60 s, transfer 44.8–66 KB, TBT/CLS 0) | `npm run audit:lighthouse` |
| Build | clean | clean | `npm run build` |

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

### BUG-004 — `/cuet-ug-syllabus/legal-studies` 404 everywhere (fixed, empty-state honesty)

**Root cause.** The syllabus page 404s when `topics.length === 0 && publishedQuestions === 0`, and `publishedQuestions` was computed as `timedQuestions + libraryQuestions` where `libraryQuestions` only counts papers bundled in `src/data/local-papers`. The Legal Studies paper (38 live DB questions) is missing from that bundle, so it read 0 publishable questions, even though its subjects row, live practice paper and DB question rows all exist.

**Fix.** The page may only 404 when the subject carries **no database-visible content at all**. It now computes `timedQuestions + max(bundled library, DB practice questions)` and shows the honest "No topics are mapped yet" block with a `/cuet-mock-test/legal-studies` CTA when there is practice content but no topic mapping yet. Meta description, FAQ output, "Questions available" and "Syllabus topics" counters all use the same numbers.

**Verification.** `/cuet-ug-syllabus/legal-studies` → 200 locally; `/cuet-ug-syllabus/sociology` → 200; `/cuet-ug-syllabus/psychology` → 200; unit suite 667/667; build clean.

### BUG-001 — archived papers 301 to an empty hub that 404s (approved retargeting, applied and verified in local D1)

**Root cause.** Two practice papers with no surviving listable paper were mapped to empty subject archive hubs (`No papers for this subject` 404): `sociology-2024-05-18-shift-3` and `legal-studies-2022`. The mock wrappers carried the same dead-end targets in `slug_redirects`.

**Fix (as approved).** `scripts/fix-archived-redirects.mjs` retargets both to the subject practice hubs (both 200-honest pages):
- `practice_papers.replaced_by` (used by `/mock-tests/<slug>`): `→ /cuet-mock-test/<subject>`
- `slug_redirects.target_path` for the same `entity_type='mock'` rows (used by `/mock/<slug>`): `→ /cuet-mock-test/<subject>`

Dry-run verified, locally applied and verified: both `301 → 200` chains land on live practice hubs.

**Still pending production.** This session does not hold Turso write credentials; see §5 for the owner's apply command.

### BUG-007 — 25 locked rebuilt-set questions carry duplicate options (approved curation, additive tagging applied in local D1)

**Curation performed. No question text, option payload or answer key was changed.**
- All 25 affected rows now carry a `duplicate-option` tag in `review_flags_json` (additive flag).
- The 3 rows where the correct answer falls inside a duplicate pair (class C) additionally carry `duplicate-option-in-keypair`:
  `cuet-biology-pyq-set-14/q18`, `cuet-biology-pyq-set-15/q15`, `cuet-physics-pyq-set-1/q19`.
- The remaining 22 rows are class A: identical-but-redundant distractor pairs whose answer keys stay distinct (e.g. "25" listed twice in one question).

Curation proposal is in `test-artifacts/curation-proposal-25.md` (sets, keys, duplicate pairs, class).

**Still pending production.** Same story — see §5.

**Not possible without source assets.** Rewriting the duplicated option *texts* requires the source PDFs; none of the source assets are in this repo or its history, and the audit does not have them. The 3 class-C rows additionally still risk scoring correctness for any student choosing the duplicated correct-looking choice; those are the highest-priority editorial rows.

## 3. Items de-scoped with owner sign-off

- **BUG-008** — official-paper duplicates / near-duplicates / 2 two-option rows: tracked as editorial backlog; **no changes applied** (owner approved).

## 4. How to apply the production step (owner action)

Turso credentials for production live in `.dev.vars` (or your secret manager). This session deliberately did not read them, so the two data-layer fixes are verified locally and ready to push:

```sh
node --env-file-if-exists=.dev.vars scripts/fix-archived-redirects.mjs --turso   # dry-run first with --dry-run
node --env-file-if-exists=.dev.vars scripts/flag-duplicate-options.mjs --turso
```

Idempotent (skips rows already retargeted / already carrying the flag). Verify afterwards, read-only:

```sh
curl -s -o NUL -w "%{http_code} %{redirect_url}\n" https://cuetfreemocktest.com/mock/sociology-2024-05-18-shift-3
curl -s -o NUL -w "%{http_code} %{redirect_url}\n" https://cuetfreemocktest.com/mock/legal-studies-2022
```

Expect `301 …/cuet-mock-test/sociology` and `…/legal-studies` (both targets 200).

## 5. What remains unverified (with reasons)

- Firefox/WebKit E2E — project ships Chromium by design.
- Google OAuth round-trip — needs a loopback-capable OAuth app; failure paths verified instead.
- Production write path for the data fixes — not executed (no Turso creds in session).
- Migration mechanics against production Turso — not re-run in this pass; all 32 migrations apply from scratch locally.
- Two admin-flow E2E specs self-skip because the fixture database has no papers pending in the review queue.

## 6. CI-path changes shipped with this report

`.github/workflows/ci.yml` now also gates on:

- **Data Integrity Audit** (`npm run test:data`) — exits non-zero on any P1 integrity invariant;
- **Link & Redirect Check** (`npm run test:links`) — external links are reported, internal links fail the job.

Internal pull-request safety is unchanged: E2E, axe, SEO sitemap audit, unit tests, build remain blocking. Lighthouse stays a local gate (stronger signal than a noisy shared runner; budget passes everywhere, see §1).
