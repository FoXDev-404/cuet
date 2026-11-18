# PYQ rebuild — local apply and verification report

Date: 18 November 2026
Target: **local D1 only** (`cuet-blueprint-db`, `.wrangler/state/v3/d1`)
Production Turso and production deployment: **not touched**

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
231 paper URLs + 231 mock wrappers). Every row was then fetched from a local
server and checked for the exact status and `Location`:

- Paper URLs: **231/231** returned `301` with the mapped replacement.
- Old mock wrappers: **231/231** returned `301` with the mapped mock or hub.
- Total: **462/462, 0 failures**. The per-URL evidence is
  `PYQ_REDIRECT_HTTP_RESULTS.csv`.

All **132** live paper pages (118 rebuilt sets + 14 untouched papers) returned
`200`, as did all **118** rebuilt-set instructions pages (250/250).

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

### Build

`npm run build` — **0 errors, 0 warnings** (48 hints from pre-existing scripts),
Cloudflare server output written to `dist/`, and the post-build secret scan
passed with no `.dev.vars` values in the bundle.

## 9. Production status

The rebuild has **not** been applied to Turso or production D1, and nothing has
been deployed. Production deployment remains a separate, explicit
`npm run deploy` step after the production data migration is approved and run.

Known external blockers that do not affect the local result:

- Staging D1’s daily row-write limit was exhausted earlier; it resets at
  midnight UTC.
- The GitHub `CLOUDFLARE_API_TOKEN` lacks D1 permission (`7403`), so the staging
  migration workflow cannot run.
- Staging lacks `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, and
  `staging.cuetfreemocktest.com` has no DNS record.
- Turso backup credentials are missing; scheduled backups are not running.
- `TURSO_AUTH_TOKEN` was exposed during earlier screenshot work and still needs
  rotation.
- Two image-option questions lack assets and stay quarantined:
  `chemistry-2026-06-06-shift-1` q02/q49.
- No GSC/Bing access, no authenticated production admin/dashboard pass, and no
  physical iOS/Android pass was available.

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
```
