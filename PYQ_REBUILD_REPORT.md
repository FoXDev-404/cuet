# PYQ rebuild — apply and verification report

Date: 18 November 2026
Targets: **local D1** (`cuet-blueprint-db`, `.wrangler/state/v3/d1`) and
**production Turso** (worker `cuet-astro`)
Production deployment: **deployed 18 November 2026, 07:31 UTC**
(version `8b76ae22-b74c-4f44-a235-f22947a4e8ff`)

## 1. Outcome

Every short (<50-question) PYQ paper has been rebuilt into a clean, same-subject,
same-language 50-question set. The 15 overlong papers were reduced to 50. The 14
papers that already had exactly 50 questions were left untouched.

- 118 new sets: **103 pooled** + **15 reduced**
- 5,900 distinct source questions (5,900 practice + 5,900 ranked rows)
- 26 preserved passage groups (practice and ranked)
- 231 old paper URLs archived and redirected
- 231 old mock-wrapper URLs redirected
- 132 public practice papers remain listed: 118 new sets + 14 untouched
- No question content, answer key, explanation or old attempt was deleted
- Applied to local D1, applied to production Turso, and deployed to
  `https://cuetfreemocktest.com`

## 2. Before / after row counts

Backup snapshot: `backups/pyq-rebuild-2026-11-18T04-19-19-439Z/`
(`rows.json` SHA-256 `26d428dcf461363ab22f4560e718aa041109930b34f127244a9a05761c119d3f`).

| Table | Before | After apply | Current local DB |
|---|---:|---:|---:|
| `practice_papers` | 245 | 363 | 363 |
| `practice_questions` | 7,527 | 13,427 | 13,427 |
| `practice_passages` | 134 | 160 | 160 |
| `mock_tests` | 252 | 370 | 382 |
| `mock_test_versions` | 252 | 370 | 382 |
| `mock_questions` | 7,890 | 13,790 | 13,804 |
| `questions` | 7,910 | 13,810 | 13,874 |
| `passages` | 143 | 169 | 169 |
| `attempts` | 24 | 24 | 63 |
| `attempt_answers` | 959 | 959 | 2,082 |
| `slug_redirects` | 0 | 231 | 231 |

“After apply” is the state recorded by the apply-time verification. “Current”
(18 Nov 12:20) also includes rows created by the automated Playwright suites
(12 extra mocks, 14 extra ranked questions, 64 extra questions, 39 extra
attempts and 1,123 extra answers). Those are local test artifacts, not part of
the rebuild.

All 24 pre-existing attempts and all 959 pre-existing answers from the backup
were found again by primary key after the rebuild (0 missing).

### Production Turso

Production backup before any write:
`backups/pyq-rebuild-2026-11-18T07-27-07-430Z/`
(`rows.json` SHA-256 `8d6cccfdd1dbbe1a48b96608b6a1e51482bd57d8461a51ebf58d9e52c7f29dfb`).

| Table | Before | After | Delta |
|---|---:|---:|---:|
| `practice_papers` | 245 | 363 | +118 |
| `practice_questions` | 7,527 | 13,427 | +5,900 |
| `practice_passages` | 134 | 160 | +26 |
| `mock_tests` | 247 | 365 | +118 |
| `mock_test_versions` | 786 | 904 | +118 |
| `mock_questions` | 24,904 | 30,804 | +5,900 |
| `questions` | 24,761 | 30,661 | +5,900 |
| `passages` | 484 | 510 | +26 |
| `attempts` | 87 | 87 | 0 |
| `attempt_answers` | 1,626 | 1,626 | 0 |
| `slug_redirects` | 0 | 231 | +231 |

The production database had re-imported the same 245 paper slugs with different
row ids, so the seed now resolves `source_paper_id` with
`(SELECT id FROM practice_papers WHERE slug = ?)` instead of hard-coding the
local id. All 5,900 provenance links resolve to the correct production papers;
`scratch/verify-turso-rebuild.mjs` reports 0 mismatches.

## 3. Set catalogue

| Subject | Sets | Subject | Sets |
|---|---:|---|---:|
| Accountancy | 8 | Hindi | 1 |
| Applied Mathematics | 1 | History | 7 |
| Biology | 15 | Mathematics | 8 |
| Business Studies | 6 | Physics | 12 |
| Chemistry | 17 | Political Science | 2 |
| Computer Science | 3 | Geography | 3 |
| Economics | 2 | General Test | 18 |
| English | 15 | | |

- Languages: English 117 sets, Hindi 1 set. No set mixes languages.
- Applied Mathematics owns the 24 cross-subject twin questions.
- General Test pooled sets use the documented 11 GK / 3 Current Affairs / 25
  Quant / 11 Logical distribution; the 39 surplus GT questions stay unused.
- Every set has exactly 50 live `practice_questions` and exactly 50 published
  ranked `mock_questions` in one published mock version.

## 4. Question integrity

- 5,900 distinct `(source_paper_id, source_question_no)` pairs; no repeats
  inside a set or across sets.
- 5,900/5,900 practice rows and 5,900/5,900 ranked rows carry
  `source_year`, `source_date` (nullable), `source_shift` (nullable),
  `source_question_no` and `source_paper_id`.
- 1,457 questions publish without an invented explanation; none were generated.
- 144 questions received deterministic repairs; 263 ambiguous clusters were
  quarantined rather than guessed.
- 388 valid unused questions remain unpublished, and 215 surplus questions were
  trimmed.
- 21 duplicate non-key distractor strings remain; these are cosmetic and were
  disclosed in the approved plan.
- Passage groups stay intact, ordered and attached to their questions.

## 5. Archived papers and redirects

- 231 papers archived with `is_archived = 1` and a non-null `replaced_by`.
- 231 `slug_redirects` rows: 219 point at a replacement published mock and 12
  point at a subject hub (`target_path`).
- 0 broken redirect targets. Old mocks are `status = 'archived'`; no old mock,
  attempt or leaderboard row was deleted.
- Exactly-50 papers remain `is_archived = 0` and keep returning HTTP 200.

The complete machine-readable list is `PYQ_REDIRECT_STATUS.csv` (462 rows:
231 paper URLs + 231 mock wrappers). Every row was fetched with
`redirect: "manual"` first from a local server and then from production, and
checked for the exact status and `Location`:

- Local: **462/462** returned `301`, 0 failures.
- Production: **462/462** returned `301` with the exact mapped target, 0
  failures.

The per-URL evidence is `PYQ_REDIRECT_HTTP_RESULTS.csv`; the production rerun
produced the same file byte-for-byte.

All **250** live URLs (132 paper pages + 118 instructions pages) returned
`200` on both hosts; the production sweep is recorded in this report.

Spot checks performed in Playwright:

| Old URL | Result |
|---|---|
| `.../chemistry/chemistry-2025-05-21-shift-2` | 301 → `.../chemistry/cuet-chemistry-pyq-set-13` |
| `.../biology/biology-2025-05-20-shift-2` | 301 → `.../domain-subject-pyqs/biology` |
| `.../general-test/general-test-2022-08-06` | 301 → `.../general-test/cuet-general-test-pyq-set-2` |
| `.../general-test/general-test-2025-05-20-shift-1` | 301 → `.../general-test/cuet-general-test-pyq-set-15` |
| `.../general-test/general-test-2025-05-20-shift-2` | 301 → `.../general-test/cuet-general-test-pyq-set-16` |

## 6. Untouched exactly-50 papers

The following 14 papers keep their original content, URLs, mocks and attempts,
and still have exactly 50 practice and 50 ranked questions:

`biology-2025-05-20-shift-1`, `english-2022-08-16-shift-1`,
`english-2023-05-21-shift-1`, `english-2023-06-02-shift-3`,
`english-2023-06-05-shift-3`, `english-2023-06-06-shift-2`,
`english-2023-06-13-shift-3`, `english-2026-06-06-shift-1`,
`geography-2025-05-16-shift-1`, `hindi-2022-08-30-shift-2`,
`mathematics-2024-05-16-shift-1`, `physics-2025-05-21-shift-2`,
`political-science-2024-05-18-shift-2`, `psychology-2024-07-19-shift-1`.

The apply checks confirmed that none of these was archived.

## 7. Site changes

- `getTestStats()` + `<TestStats />` on PYQ detail, mock overview and result
  pages. The mock version’s 60-minute deadline is now the displayed duration.
- Source tags in the runner (`PYQ - 15 May 2024, Shift 3`, falling back to
  `PYQ - 2024`) and in solutions.
- Result solution filter: correct/wrong/skipped **and** source year.
- PYQ hub browser: subject, language, year-from/year-to and type filters over all
  local papers, with a live count and no-JS fallback (all rows render).
- Archived paper URLs 301 through `practice_papers.replaced_by`; old mock
  wrappers 301 through `slug_redirects`.
- `is_archived = 0` added to PYQ index, detail, sitemap, topic rollups and
  subject/topic pages.
- Sitemap: 118 new set URLs, 0 archived paper URLs.

## 8. Verification

### Local data

`node scratch/verify-apply.mjs` after apply: 118/118 sets exactly 50, all 5,900
questions tagged, 5,900 distinct sources, 26 passages, 231 archived papers,
231 redirects (219 mock + 12 path, 0 broken), 231 old mocks archived, 24/959
attempts/answers preserved.

`node scratch/verify-preserved.mjs`: 24/24 backup attempts and 959/959 backup
answers still present after the rebuild and the E2E runs.

### Unit tests

`npm test` — **70 files, 618 tests passed** (after updating the three database
baseline assertions that the rebuild intentionally changes).

### End-to-end

`npx playwright test` — **108 passed, 2 skipped, 0 failed in 8.9 minutes**
(the two skips are the existing admin review-queue tests, which self-skip when
no paper is pending in `/admin/review`).

New `tests/e2e/pyq-rebuild.spec.ts` covers:

- 50-question stats and provenance notes for pooled, passage-bearing and reduced
  sets;
- passage rendering in a pooled set;
- runner/solution source badges and the solution year filter (2022 = 35 cards,
  2023 = 15 cards);
- untouched paper URL 200 and paper-level source fallback;
- paper → set and paper → subject-hub 301s;
- PYQ filters (subject 8, Hindi 2, practice sets 118, year 2026 only);
- sitemap 118 sets and no archived slug.

`tests/e2e/local-practice.spec.ts` was updated for the new data shape: its
attempt fixture is now the untouched `english-2023-05-21-shift-1`, and its old
General Test metadata test now asserts the 301s.

### HTTP sweep

With `USE_LOCAL_D1=1 npm run dev` running, `node scratch/verify-redirects-http.mjs`
checked every redirect with `redirect: "manual"`:

```
{ paper_url: { total: 231, ok: 231 },
  mock_wrapper: { total: 231, ok: 231 } }
checked 462, failures 0
```

`node scratch/verify-live-paper-http.mjs` then checked every live URL:

```
{ untouched_paper: { total: 14, ok: 14 },
  rebuilt_set: { total: 118, ok: 118 },
  rebuilt_set_instructions: { total: 118, ok: 118 } }
checked 250, failures 0
```

Both sweeps were repeated against `https://cuetfreemocktest.com` after the
deploy and returned identical results:

```
{ paper_url: { total: 231, ok: 231 },
  mock_wrapper: { total: 231, ok: 231 } }
checked 462, failures 0

{ untouched_paper: { total: 14, ok: 14 },
  rebuilt_set: { total: 118, ok: 118 },
  rebuilt_set_instructions: { total: 118, ok: 118 } }
checked 250, failures 0
```

`node scratch/verify-production-content.mjs` additionally checks the deployed
HTML and sitemap: 132 hub rows (118 sets + 14 untouched), 0 archived links,
pooled/reduced notes, unchanged paper 200, paper → set 301, instructions 200,
118 set URLs in the sitemap and 0 archived URLs — **0 issues**.

### Build

`npm run build` — **0 errors, 0 warnings** (48 hints from pre-existing scripts),
Cloudflare server output written to `dist/`, and the post-build secret scan
passed with no `.dev.vars` values in the bundle.

## 9. Production status

**Applied and deployed.**

1. Backup: `backups/pyq-rebuild-2026-11-18T07-27-07-430Z/`, `rows.json`
   SHA-256 `8d6cccfdd1dbbe1a48b96608b6a1e51482bd57d8461a51ebf58d9e52c7f29dfb`.
2. `scripts/turso-migrate.mjs` applied `0029`, `0030` and `0031`
   (31 migrations total); SQLite `integrity_check` is `ok` and
   `foreign_key_check` is clean.
3. `node --env-file-if-exists=.dev.vars scripts/apply-pyq-rebuild.mjs --turso`
   applied **118/118** sets and archived 231 papers with 231 redirects.
4. `scripts/turso-verify.mjs`: 30,661 published questions, 0 orphan attempts,
   0 orphan answers, 0 duplicate public ids, 0 duplicate question pointers,
   0 duplicate mock slugs.
5. `scratch/verify-turso-rebuild.mjs`: 118 sets, 117 English + 1 Hindi,
   5,900 practice + 5,900 ranked rows, 5,900 distinct fully tagged sources,
   26 + 26 passages, 231 archived papers, 231 redirects (12 hub targets,
   0 broken), 0 published old mocks, 0 untouched papers archived, and the
   87 attempts / 1,626 answers preserved — **0 issues**.
6. `npm run deploy` uploaded worker `cuet-astro` version
   `8b76ae22-b74c-4f44-a235-f22947a4e8ff` at 07:31 UTC; the custom domain
   `https://cuetfreemocktest.com` serves the new data.
7. Production redirect sweep **462/462**, page sweep **250/250** and content
   checks **0 issues** (section 8).

Credential rotation: the exposed `TURSO_AUTH_TOKEN` was rotated on 18 November
2026 at 07:47 UTC. All database tokens were invalidated (a pre-rotation token
returned `401`), a new token was written to `.dev.vars` and the Worker secret,
and production pages were re-verified with live database queries under Worker
version `9f87d537-37bb-4288-90f5-149f8ad6f5f6`.

Known external blockers that remain outside this rebuild:

- Staging D1’s daily row-write limit was exhausted earlier; it resets at
  midnight UTC.
- The GitHub `CLOUDFLARE_API_TOKEN` lacks D1 permission (`7403`), so the staging
  migration workflow cannot run.
- Staging lacks `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, and
  `staging.cuetfreemocktest.com` has no DNS record.
- Turso backup credentials are missing; scheduled backups are not running.
- Two image-option questions lack assets and stay quarantined:
  `chemistry-2026-06-06-shift-1` q02/q49.
- No GSC/Bing access, no authenticated production admin/dashboard pass, and no
  physical iOS/Android pass was available.
- The 12 zero-target short papers redirect to their subject hub; there was no
  same-subject content to rebuild them from.

## 10. Commands

```bash
node scripts/apply-pyq-rebuild.mjs --local   # idempotent local apply
node scratch/verify-apply.mjs                # data invariants
node scratch/verify-preserved.mjs            # backup attempt/answer preservation
npm test                                     # 618 unit tests
npx playwright test                          # full E2E suite
npm run build                                # astro check + build
node scratch/write-redirect-report.mjs       # regenerate the redirect CSV
node scratch/verify-redirects-http.mjs       # 462 live redirect checks
node scratch/verify-live-paper-http.mjs      # 250 live page checks

# Production apply (18 Nov 2026)
node --env-file-if-exists=.dev.vars scripts/backup-pyq-tables.mjs --turso
node --env-file-if-exists=.dev.vars scripts/turso-migrate.mjs
node --env-file-if-exists=.dev.vars scripts/apply-pyq-rebuild.mjs --turso
node --env-file-if-exists=.dev.vars scripts/turso-verify.mjs
node --env-file-if-exists=.dev.vars scratch/verify-turso-rebuild.mjs
npm run deploy
node scratch/verify-redirects-http.mjs https://cuetfreemocktest.com
node scratch/verify-live-paper-http.mjs https://cuetfreemocktest.com
node scratch/verify-production-content.mjs
```

## 11. Admin/editor QA pass (18 Nov 2026)

Signed in as Super Admin (`rajpal010304@gmail.com`). The QA sweep was read-only.
The only production write was a deliberately reversible announcement probe at
the end of the pass, recorded below.

Verified: dashboard, search, content workspace, questions, passages, mocks,
PYQ library, review queue, blog, announcements, attempts, users, moderation,
leaderboard, media, SEO, exam info, settings, admins, data manager, trash and
audit log all return 200 with no console errors. Public pages, result pages,
question preview and mock preview load; question search works; the archived
URL sweep is 462/462 permanent redirects.

Findings (none invalidate the applied rebuild):

1. Review queue is not usable at scale: the query is `ORDER BY q.id ASC
   LIMIT 50`, with no pagination and no paper-status filter. The library has
   6,600 active practice questions and 4,425 AI-draft explanations; all 50
   default rows are archived (`applied-mathematics-2025-06-02-shift-1`,
   IDs 30037-30086). Filtering `?source=ai_draft` still returns only 50.
2. `/admin/passages` silently lists 200 of 510 passages (`listPassages`
   `LIMIT 200`), with no pager. Search and subject filters can still reach
   older rows, but the full list cannot be browsed.
3. The PYQ rights copy contradicts the code. The admin says papers not marked
   `cleared` are "automatically quarantined with noindex" and "excluded from
   sitemaps", and labels the Unknown card "Forced noindex, no ads". The code
   quarantines only `restricted`. All 363 papers are `unknown`; all 132 active
   papers are in the sitemap and indexable. Ads are currently off globally,
   but rights status does not gate them.
4. Twenty duplicate title groups and twenty duplicate description groups
   cover 39 of the 118 set pages (for example, chemistry sets 15-17 and
   English sets 12-15 share one title and one description). The set number is
   omitted from the generated title/description in the paper page.
5. Published mock #1109 shows 50 publish-validation blockers ("Missing
   explanation") despite being live. This is consistent with the accepted
   1,457/5,900 missing set explanations; a v2 republish stays blocked until
   those explanations are written.
6. The GitHub deploy workflows still run the legacy practice-library import,
   which deletes and reinserts all 245 old papers with the archive flags at
   their defaults. Staging uses that D1 database, so the import would undo the
   231-paper archive and its redirects there. Production reads Turso, so the
   production workflow's D1 import is wasted work and only a landmine if the
   Worker ever falls back to D1. Both smoke assertions still expect "137
   papers"; the live site serves 132.
7. The mobile admin sidebar emits an `aria-hidden` focus warning when it
   closes with a navigation link focused. `/admin/pyq` (363 paper rows) and
   `/admin/mocks` (364 rows) render every row without pagination.
8. Trash holds four QA artifacts: `qa-admin-mvz50gql@cuetfreemocktest.com`,
   two test questions and `CUET UG English Starter Mock`.

Confirmed not defects: negative attempt scores are valid; the 1,457 missing
set explanations are the accepted limitation; all `rights_status = 'unknown'`
predates the rebuild (the pre-apply backup also had unknown for all 245
papers); `practice_passages` (160) and `passages` (510) are separate stores.

### Fixes implemented, deployed and verified

Deployed to production on 18 November 2026. The final Worker version is
`5cecd6e7-f6a4-4b61-91ea-49019ba5b310`; the two earlier deploys in the pass
were `12610bb1-fdbb-47c3-b2a7-0800b6951cf4` and
`875aecf7-b12c-4efc-8261-4fd7f3b54d60`.

1. Review queue now pages 25 rows, shows the active total, orders active papers
   first, and offers active/archived/all filters (`tests/unit/admin-pagination.test.ts`).
2. Passages use a SQL count plus 25-row pages; the API returns
   `{ passages, total, page, per }`.
3. Rights copy now says only `Restricted` is quarantined/noindexed; `Unknown`
   is labelled "Live · rights unconfirmed". Database rights are unchanged.
4. Rebuilt paper titles and descriptions carry the `PYQ Set N` label; subjects
   with short names also get the date range so titles stay within 35-65
   characters. The production sitemap audit reports 225 URLs, 0 mismatches and
   no title/description warnings, with no duplicate titles or descriptions
   across the 132 papers.
5. Finding 5 remains the accepted explanation limitation.
6. Production workflow no longer runs the legacy practice seed imports and its
   smoke check expects 132 papers. `scripts/lib/import-guard.mjs` makes the
   importer refuse an archive reset unless `--allow-archive-reset` is passed.
7. The admin sidebar moves focus before applying `aria-hidden`/`inert`; the E2E
   test asserts the console warning is gone. `/admin/pyq` and `/admin/mocks` now
   page 25 rows each with totals, ranges and prev/next links.
8. The four QA Trash rows stay soft-deleted. Purging them is blocked by live
   references: the two test questions have 83 attempt answers and 2 mock
   questions; the starter mock has 42 attempts, 7 discussions and one saved
   version; the QA admin has 13 audit entries plus `created_by` references.
   A purge would destroy real attempt history, so it needs a retention
   decision rather than a trash cleanup.
9. The live SEO audit found two sitemap defects and one description defect:
   `/cuet-mock-test/legal-studies` and `/cuet-mock-test/sociology` were
   `noindex` but listed, and `/cuet-ug-syllabus/legal-studies` returned 404.
   Subject and syllabus URLs now come from the same gates as their routes
   (`src/lib/sitemap-subjects.ts`), and mock detail descriptions are generated
   to 120-160 characters with no dangling connector before the ellipsis.

Production write probe: created an inactive announcement ("QA write verification
2026-11-18 — safe to delete"), confirmed it appeared in the admin list, deleted
it, then purged it from `/admin/trash` using the typed id confirmation. The
audit log records `announcement.create` (13:23:49Z), `announcement.delete`
(13:24:02Z) and `trash.purge` (13:24:16Z); `announcements` has zero live rows
and Trash is back to the four QA artifacts. This was the only production write
made during the QA pass.

Verification after these fixes: `npm test` 649/649 passed, `astro check` 0
errors and 0 warnings (49 hints), `npm run build` passed, `npm run lint:copy`
reported 0 violations, `npm run check:env` passed, and the production
`npm run seo:check` reports 225 sitemap URLs, 230 audited URLs and 0
mismatches. Live checks confirmed review/passages/PYQ/mocks pagination, the
corrected rights copy, the 159-character mini-mock description, and 132 paper
detail pages returning 200 with self-canonical metadata. The work is committed
and pushed to `origin/main`; production was deployed only with `npm run deploy`.


