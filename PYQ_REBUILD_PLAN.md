# PYQ rebuild plan — dry run

**Status:** DRY RUN. No D1, KV, sitemap, redirect or content write has been made.
**Generated:** 2026-11-18T04:15:14.991Z
**Companion:** `PYQ_AUDIT.md` (read-only audit) and `PYQ_REBUILD_PLAN.json` (machine-readable plan).
**Scope:** 245 PYQ practice papers and 7,527 practice questions in the local D1 mirror.

---

## 0. What changes

| Outcome | Count |
| --- | --- |
| New 50-question sets published | **118** |
| Questions published in those sets | **5,900** |
| — from pooled SHORT questions | 5,150 (103 sets) |
| — from reduced overlong papers | 750 (15 sets) |
| Exactly-50 papers left untouched | **14** |
| Overlong papers reduced to 50 | **15** |
| SHORT papers archived | **216** |
| Valid pooled questions left unused (no short sets) | 388 |
| Valid questions trimmed from overlong papers | 215 |
| Quarantined question clusters | 263 |
| Deterministically sanitised questions | 174 |
| Applied Mathematics / Mathematics twins collapsed | 24 |

Every new set is exactly **50 distinct questions**, **60 minutes**, **+5 / −1 / 0**, **maximum 250 marks**, one subject and one language. No new set is short, and no question appears in more than one new set.

---

## 1. Untouched — exactly 50 questions (14 papers)

These rows, their questions, mocks, URLs and sitemap entries are **not written, renamed or redirected**.

| Paper slug | Subject | Year | Exam date | Shift | Questions |
| --- | --- | --- | --- | --- | --- |
| `biology-2025-05-20-shift-1` | Biology | 2025 | 20 May 2025 | Shift 1 | 50 |
| `english-2022-08-16-shift-1` | English | 2022 | 16 Aug 2022 | Shift 1 | 50 |
| `english-2023-05-21-shift-1` | English | 2023 | 21 May 2023 | Shift 1 | 50 |
| `english-2023-06-02-shift-3` | English | 2023 | 2 Jun 2023 | Shift 3 | 50 |
| `english-2023-06-05-shift-3` | English | 2023 | 5 Jun 2023 | Shift 3 | 50 |
| `english-2023-06-06-shift-2` | English | 2023 | 6 Jun 2023 | Shift 2 | 50 |
| `english-2023-06-13-shift-3` | English | 2023 | 13 Jun 2023 | Shift 3 | 50 |
| `english-2026-06-06-shift-1` | English | 2026 | 6 Jun 2026 | Shift 1 | 50 |
| `geography-2025-05-16-shift-1` | Geography | 2025 | 16 May 2025 | Shift 1 | 50 |
| `hindi-2022-08-30-shift-2` | Hindi | 2022 | 30 Aug 2022 | Shift 2 | 50 |
| `mathematics-2024-05-16-shift-1` | Mathematics | 2024 | 16 May 2024 | Shift 1 | 50 |
| `physics-2025-05-21-shift-2` | Physics | 2025 | 21 May 2025 | Shift 2 | 50 |
| `political-science-2024-05-18-shift-2` | Political Science | 2024 | 18 May 2024 | Shift 2 | 50 |
| `psychology-2024-07-19-shift-1` | Psychology | 2024 | 19 Jul 2024 | Shift 1 | 50 |

---

## 2. Reduced — overlong papers (15 papers)

Each overlong paper becomes one 50-question set using only its own questions. General Test reductions keep the paper's own section mix and take the earliest questions in each section in original paper order; the Mathematics paper takes the first 50 in paper order. Old URLs 301-redirect to the new set.

| Old paper | Subject | Current Q | New set | Dropped (valid) | Dropped (quarantined) |
| --- | --- | --- | --- | --- | --- |
| `cucet-2021-general-test` | General Test | 114 | `cuet-general-test-pyq-set-1` | 63 | 1 |
| `general-test-2022-08-06` | General Test | 70 | `cuet-general-test-pyq-set-2` | 17 | 3 |
| `general-test-2022-08-08-shift-1` | General Test | 61 | `cuet-general-test-pyq-set-3` | 10 | 1 |
| `general-test-2022-08-18` | General Test | 66 | `cuet-general-test-pyq-set-4` | 13 | 3 |
| `general-test-2022-08-22` | General Test | 62 | `cuet-general-test-pyq-set-5` | 11 | 1 |
| `general-test-2022-08-23-shift-1` | General Test | 71 | `cuet-general-test-pyq-set-6` | 21 | 0 |
| `general-test-2022-10-06-shift-1` | General Test | 69 | `cuet-general-test-pyq-set-7` | 17 | 2 |
| `general-test-2023-05-21-shift-1` | General Test | 58 | `cuet-general-test-pyq-set-8` | 6 | 2 |
| `general-test-2023-05-27-shift-1` | General Test | 58 | `cuet-general-test-pyq-set-9` | 7 | 1 |
| `general-test-2023-06-05-shift-1` | General Test | 57 | `cuet-general-test-pyq-set-10` | 6 | 1 |
| `general-test-2023-06-09-shift-2` | General Test | 60 | `cuet-general-test-pyq-set-11` | 7 | 3 |
| `general-test-2023-06-10-shift-3` | General Test | 59 | `cuet-general-test-pyq-set-12` | 7 | 2 |
| `general-test-2024-05-15-shift-3` | General Test | 53 | `cuet-general-test-pyq-set-13` | 3 | 0 |
| `general-test-2024-05-29-shift-1` | General Test | 53 | `cuet-general-test-pyq-set-14` | 1 | 2 |
| `mathematics-2026-05-20-shift-1` | Mathematics | 78 | `cuet-mathematics-pyq-set-7` | 26 | 2 |

The 15 papers hold **989** questions: **750 published**, **215 valid but trimmed**, **24 quarantined**. Trimmed questions stay in the archived paper for audit; they are not published elsewhere.

---

## 3. New sets by subject

| Subject | Language | New questions | Sets | Set numbers | Source years |
| --- | --- | --- | --- | --- | --- |
| Accountancy | English | 400 | 8 | 1–8 | 2022–2025 |
| Applied Mathematics | English | 50 | 1 | 1–1 | 2025–2025 |
| Biology | English | 750 | 15 | 1–15 | 2022–2024 |
| Business Studies | English | 300 | 6 | 1–6 | 2022–2025 |
| Chemistry | English | 850 | 17 | 1–17 | 2022–2026 |
| Computer Science | English | 150 | 3 | 1–3 | 2022–2026 |
| Economics | English | 100 | 2 | 1–2 | 2022–2025 |
| English | English | 750 | 15 | 1–15 | 2022–2026 |
| General Test | English | 900 | 18 | 1–18 (4 pooled + 14 reduced) | 2021–2026 |
| Geography | English | 150 | 3 | 1–3 | 2022–2026 |
| Hindi | Hindi | 50 | 1 | 1–1 | 2024–2025 |
| History | English | 350 | 7 | 1–7 | 2022–2026 |
| Mathematics | English | 400 | 8 | 1–8 (7 pooled + 1 reduced) | 2022–2026 |
| Physics | English | 600 | 12 | 1–12 | 2022–2026 |
| Political Science | English | 100 | 2 | 1–2 | 2022–2025 |

Set naming:

- Title: `CUET [Subject] PYQ Set [N]`
- Slug: `cuet-[subject]-pyq-set-[n]`
- URL: `/cuet-ug-previous-year-question-papers/[category]/[subject]/cuet-[subject]-pyq-set-[n]`
- Category: `general-aptitude-test-pyqs` (General Test), `language-pyqs` (English, Hindi), `domain-subject-pyqs` (all others).

No existing slug matches `cuet-*-pyq-set-*`; the plan therefore creates **118** URLs with **0 collisions**.

---

## 4. Pool basis and per-subject arithmetic

Basis: `all_short_sanitised_no_complete_overlap`.

1. All **216** SHORT papers are pooled after conservative exact + ≥90% near dedupe.
2. Passage/case-study groups stay atomic; answer-leak sanitation is applied deterministically.
3. **263** clusters are quarantined; **239** are in the SHORT pool and **24** are overlong-only.
4. **Four** SHORT clusters also appear in a COMPLETE paper and are excluded; those questions remain live in the untouched/reduced paper.
5. Recovery is **not** applied — OCR cannot key any near-50 paper to 50.
6. Applied Mathematics owns the **24** cross-subject twins.

Eligible SHORT pool: **5,538** → **103** pooled sets → **388** unused.

| Subject | Language | Eligible pool | Pooled sets | Set numbers | Unused | Passage units | Multi-Q passages |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Accountancy | English | 417 | 8 | 1–8 | 17 | 0 | 0 |
| Applied Mathematics | English | 75 | 1 | 1–1 | 25 | 0 | 0 |
| Biology | English | 791 | 15 | 1–15 | 41 | 1 | 0 |
| Business Studies | English | 310 | 6 | 1–6 | 10 | 6 | 4 |
| Chemistry | English | 869 | 17 | 1–17 | 19 | 11 | 2 |
| Computer Science | English | 153 | 3 | 1–3 | 3 | 0 | 0 |
| Economics | English | 122 | 2 | 1–2 | 22 | 6 | 3 |
| English | English | 786 | 15 | 1–15 | 36 | 6 | 4 |
| General Test | English | 239 | 4 | 15–18 | 39 | — | — |
| Geography | English | 172 | 3 | 1–3 | 22 | 2 | 0 |
| Hindi | Hindi | 94 | 1 | 1–1 | 44 | 3 | 3 |
| History | English | 362 | 7 | 1–7 | 12 | 1 | 0 |
| Mathematics | English | 353 | 7 | 1, 2, 3, 4, 5, 6, 8 | 3 | 0 | 0 |
| Physics | English | 603 | 12 | 1–12 | 3 | 0 | 0 |
| Political Science | English | 105 | 2 | 1–2 | 5 | 1 | 0 |

Passage-bearing subjects keep every multi-question passage inside one set and in original order; **0 passage groups are split** across sets.

---

## 5. General Test allocation (pooled sets)

The eligible GT pool is **239**: GK 46, Current Affairs 12, Quantitative 123, Logical 58 (three classified questions were quarantined). NTA publishes no fixed sectional count, so the plan follows the empirical mix of the 14 complete GT papers and the scarcity of the pool:

- **11 GK + 3 Current + 25 Quant + 11 Logical = 50** per pooled set.
- Scarce sections are exhausted first; Quant absorbs the surplus.
- **4** pooled GT sets; **39** GT questions remain unused (2 GK, 23 Quant, 14 Logical).
- The **14 reduced GT sets** use each overlong paper's own section mix, not this quota.
- **Ordering note:** pooled GT sets are grouped GK → Current → Quant → Logical, and each section is oldest-first. This is the only deliberate exception to one global chronological sequence, and it keeps the sectional structure readable in the runner. All other sets are globally oldest-first, then original paper order.

| Set # | Slug | GK | Current | Quant | Logical |
| --- | --- | --- | --- | --- | --- |
| 15 | `cuet-general-test-pyq-set-15` | 11 | 3 | 25 | 11 |
| 16 | `cuet-general-test-pyq-set-16` | 11 | 3 | 25 | 11 |
| 17 | `cuet-general-test-pyq-set-17` | 11 | 3 | 25 | 11 |
| 18 | `cuet-general-test-pyq-set-18` | 11 | 3 | 25 | 11 |

The full per-set spread is validated in `PYQ_REBUILD_PLAN.json#validation.gt_section_mix`.

---

## 6. Old → new mapping

**204** SHORT papers carry at least one question into a new set. Their primary redirect target is the set carrying the most of their questions; every target set is recorded in `short_papers[].target_sets`. **89** papers are only partially carried (some questions fall in the unused tail or are quarantined) — this is disclosed, not hidden.

### 6.1 Zero-target papers (12)

These papers carry **no** question into a set. They are archived and 301-redirect to their subject hub. Their valid unused questions stay in the unused pool and are not published.

| Paper | Subject | Questions | Valid unused | Quarantined | 301 target |
| --- | --- | --- | --- | --- | --- |
| `biology-2025-05-20-shift-2` | Biology | 42 | 35 | 7 | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/biology |
| `english-2026-05-31-shift-1` | English | 10 | 10 | 0 | /cuet-ug-previous-year-question-papers/language-pyqs/english |
| `english-2026-05-31-shift-2` | English | 9 | 9 | 0 | /cuet-ug-previous-year-question-papers/language-pyqs/english |
| `english-2026-06-06-shift-2` | English | 5 | 5 | 0 | /cuet-ug-previous-year-question-papers/language-pyqs/english |
| `english-2026-06-07-shift-2` | English | 10 | 8 | 2 | /cuet-ug-previous-year-question-papers/language-pyqs/english |
| `general-test-2026-05-29-shift-2` | General Test | 8 | 8 | 0 | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test |
| `general-test-2026-05-30-shift-1` | General Test | 2 | 2 | 0 | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test |
| `geography-2026-05-15-shift-1` | Geography | 10 | 9 | 1 | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/geography |
| `geography-2026-05-21-shift-1` | Geography | 9 | 9 | 0 | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/geography |
| `history-2026-05-29-shift-2` | History | 10 | 10 | 0 | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/history |
| `legal-studies-2022` | Legal Studies | 38 | 38 | 0 | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/legal-studies |
| `sociology-2024-05-18-shift-3` | Sociology | 49 | 49 | 0 | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/sociology |

Reasons:

- **Legal Studies (38)** and **Sociology (49)** cannot form a 50-question set at all and have no other same-subject paper to pool with.
- **Biology 2025-05-20-shift-2 (42)** is the newest Biology paper and falls after 15 complete Biology sets (35 valid unused + 7 quarantined).
- Nine small 2026 extracts (73 questions) fall in the unused tail of their subjects. They are memory-based fragments, not full papers.
- **192** of the 202 questions are valid but unused; **10** are quarantined.

---

## 7. Unused pool (388)

No short set is created. Leftovers are retained for a later top-up/editorial exercise.

| Subject | Language | Unused questions |
| --- | --- | --- |
| Accountancy | English | 17 |
| Applied Mathematics | English | 25 |
| Biology | English | 41 |
| Business Studies | English | 10 |
| Chemistry | English | 19 |
| Computer Science | English | 3 |
| Economics | English | 22 |
| English | English | 36 |
| General Test | English | 39 |
| Geography | English | 22 |
| Hindi | Hindi | 44 |
| History | English | 12 |
| Legal Studies | English | 38 |
| Mathematics | English | 3 |
| Physics | English | 3 |
| Political Science | English | 5 |
| Sociology | English | 49 |

---

## 8. Quarantine and deterministic sanitation

### 8.1 Quarantine — 263 clusters

No answer, option grid or figure is reconstructed by guessing. Reasons overlap.

| Defect | Code | Rows |
| --- | --- | --- |
| Options are bare `1/2/3/4` labels (real option text lost) | `label_only_options` | 117 |
| Stem is an option fragment | `stem_is_option_fragment` | 68 |
| Merged choice list | `merged_choice_list` | 42 |
| Duplicate option matching the key | `duplicate_key_option` | 41 |
| Oversized option block (>800 chars) | `huge_option_text` | 18 |
| All choices merged inside one option | `merged_option_list` | 17 |
| Merged LaTeX option grid | `merged_latex_options` | 14 |
| Roman-numeral option fragments | `roman_option_fragments` | 5 |
| Answer conflict (two stored keys) | `answer_conflict` | 2 |
| Blank / placeholder option | `blank_option_text` | 2 |
| Image options with no asset | `image_options_no_asset` | 2 |
| All options identical | `all_options_identical` | 1 |
| Leaked key contradicts stored key | `answer_key_conflict` | 1 |
| Fewer than 4 options | `fewer_than_4_options` | 1 |
| Merged number list | `merged_number_list` | 1 |
| Stem is option text | `stem_is_option_text` | 1 |

The full list, including paper and question key, is in `PYQ_REBUILD_PLAN.json#quarantine`.

### 8.2 Sanitation — 174 questions

- **67** remove a duplicated option list, pasted answer key or solution.
- **107** remove next-question / next-passage text appended to an option or stem.
- A leaked key is removed only when it agrees with `correct_option`; conflicts are quarantined.
- **144** sanitised questions are published in the new sets. The remainder are unused or quarantined.

The 8 repair suspects from the review are false positives (stem-end notices or correct next-question truncations); details are in `PYQ_AUDIT.md`.

---

## 9. Applied Mathematics / Mathematics policy

- 24 questions are near-identical across Applied Mathematics and Mathematics.
- They are **owned by Applied Mathematics**. The Mathematics pool does not repeat them.
- This lets Applied Mathematics form 1 set and Mathematics form 7 pooled sets plus 1 reduced set.
- Cross-subject duplicates are recorded in `also_appeared_in` on the question source metadata.

---

## 10. Slug, URL and redirect plan

### 10.1 New URLs

- 118 new set URLs, one per new set, under the existing category/subject path.
- Slugs and titles use the required `CUET [Subject] PYQ Set [N]` pattern.
- No existing URL is reused; no existing `cuet-*-pyq-set-*` slug exists.

### 10.2 Redirects

| Old URL class | Count | Action |
| --- | --- | --- |
| SHORT paper detail URLs | 216 | 301 → primary new set, or subject hub for the 12 zero-target papers |
| Overlong paper detail URLs | 15 | 301 → its reduced 50-question set |
| Exactly-50 paper URLs | 14 | **Untouched 200** — no redirect, no rename |
| Old `/mock/<pyq-paper>` wrapper URLs | 231 | 219 → the matching new set's ranked mock; 12 zero-target wrappers → their subject hub |
| New set URLs | 118 | New 200 pages |

- The archive route resolves `practice_papers.is_archived = 1` and issues the 301 from `replaced_by` (a path) before rendering.
- Old mock wrappers use `slug_redirects` with `entity_type = 'mock'` and either an `entity_id` (new mock) or a `target_path` (subject hub).
- Redirects are **not** applied to exactly-50 papers or to their mocks.

### 10.3 Sitemap

- Remove the **231** archived paper URLs.
- Keep the **14** exactly-50 paper URLs.
- Add the **118** new set URLs.
- Do **not** add archived or zero-target URLs; their 301 targets stay indexable.
- Zero-target subject hubs stay in the sitemap as normal hubs.

---

## 11. Data migration plan (post-approval only)

### 11.1 Schema — migration `0029_pyq_50_question_sets.sql`

Additive only:

- `practice_papers.language TEXT NOT NULL DEFAULT 'English'` — backfill `Hindi` for rows whose subject is Hindi, then new rows set it explicitly.
- `practice_papers.is_archived INTEGER NOT NULL DEFAULT 0`
- `practice_papers.replaced_by TEXT` (path or set slug)
- `practice_questions.source_year INTEGER`
- `practice_questions.source_date TEXT`
- `practice_questions.source_shift TEXT`
- `practice_questions.source_paper_id INTEGER`
- `questions.source_year INTEGER`, `questions.source_date TEXT`, `questions.source_shift TEXT`, `questions.source_question_no INTEGER`, `questions.source_paper_id INTEGER` — the ranked runner reads `questions`, so the tag must live there too.
- `slug_redirects.target_path TEXT` (nullable; set only for the 12 zero-target mock wrappers).
- Indexes: `practice_papers(is_archived)`, `practice_questions(source_paper_id)`, `questions(source_paper_id)`.

No column is dropped. No old question content is edited or deleted.

### 11.2 Row budget

| Table | New rows |
| --- | --- |
| `practice_papers` | 118 |
| `practice_questions` | 5,900 |
| `practice_passages` | 26 (re-keyed per set) |
| `mock_tests` | 118 |
| `mock_test_versions` | 118 |
| `questions` | 5,900 |
| `mock_questions` | 5,900 |
| `slug_redirects` | 231 |
| Updates to old rows | `is_archived = 1`, `replaced_by` on 231 papers; old mocks `status = 'archived'` |

### 11.3 Execution shape

1. **Backup first:** export `practice_papers`, `practice_questions`, `practice_passages`, `mock_tests`, `mock_test_versions`, `mock_questions`, `questions`, `attempts`, `attempt_answers` and `slug_redirects` to `backups/pyq-rebuild-<timestamp>.sql` (and verify row counts).
2. Schema migration `0029` runs first through `wrangler d1 migrations apply`; `d1_migrations` records it and will not re-run it. The data seed is a separate script.
3. Data seed: **24 batches of ~5 sets**, each batch sent as one `db.batch()` call (atomic) with a per-batch row-count assertion. Any failure stops the run before archiving; rows from completed batches are removed by the exact 118-slug allowlist.
4. Idempotency: every insert uses `INSERT ... ON CONFLICT DO NOTHING` keyed by the new slug / `(paper_slug, question_key)`; the `practice_questions` row is the ledger, so a re-run creates no second `questions` row; every archive update is guarded by `is_archived = 0`.
5. Order per set: `practice_papers` → `practice_passages` → `practice_questions` → `questions` → `mock_tests` → `mock_test_versions` → `mock_questions`.
6. Archive old papers and mocks **after** all new rows verify. 301s are read from the archived rows, so they go live atomically with the archive flag.
7. Old mocks are set to `status = 'archived'`, **never deleted**. Attempt and result-review routes still resolve an archived mock by attempt id, so the 24 attempts / 959 answers remain viewable. Lists and leaderboards exclude archived mocks, freezing old rankings.
8. Purge KV caches (`PRACTICE_INDEX_CACHE_KEY`, every `practicePaperCacheKey`, subject rollups, mock lists, sitemap) after the final batch.

### 11.4 Source tags

Every new `practice_questions` row carries `source_year`, `source_date`, `source_shift`, `source_question_no` and `source_paper_id`. The matching `questions` row carries the same fields so the ranked runner and result review can render the tag without a join. Exactly-50 papers are **not backfilled**; their tags are derived from the paper row at read time (year always available, date/shift when present). Missing dates and shifts are never invented.

---

## 12. Site changes

### 12.1 Shared stats

- Add `getTestStats(paper)` as the single source of truth: `total_questions`, `scored_questions`, `duration_minutes`, marks, `max_marks`.
- Render it through one `<TestStats />` component on PYQ detail, mock overview and result pages.
- Remove the `rankedQuestionCount ?? recoveredQuestionCount` divergence for the new sets.

### 12.2 Runner and result review

- Show a source tag on **every** question: `PYQ - 15 May 2024, Shift 3`; fall back to `PYQ - 2024` when date/shift is missing, then `PYQ`.
- Extend the attempt/question select in `attempts.ts` and `mock-cache.ts` to include the new `questions.source_*` fields.
- Result review gets a **year filter** and the same tag.
- Pooled sets show a merged-set note: “50 questions pooled from N CUET papers; each question keeps its original source tag.”
- Reduced sets show: “Reduced from the original X-question paper; Y questions omitted.”

### 12.3 List and filters

- PYQ list filters: **subject**, **language**, **year range**, **type** (practice set / original paper).
- Add `AND p.is_archived = 0` to `INDEX_SQL`, subject rollups and the sitemap paper query.
- Archived papers are excluded from lists, rails, search and sitemap.
- Exactly-50 papers continue to show as original papers.
- New sets show as 50-question practice sets.

### 12.4 Ads and indexing

- Ads remain **off**.
- 301s are permanent; canonical URLs point only at the new sets.
- Noindex is not applied to the new sets.
- All changes stay local on `main`; nothing is pushed. Production deploy happens only through an explicit `npm run deploy` after the approval gate.

---

## 13. Validation (must pass before and after apply)

Pre-apply (`scratch/validate-plan.mjs` + `scratch/check-assets.mjs`):

- 118 sets; **5,900** unique question clusters (one per published question).
- 0 intra-set duplicates, 0 cross-set duplicates.
- 0 missing source tags, 0 missing answers.
- 0 same-set subject/language mismatches.
- 0 split passage groups.
- 0 slug collisions, 0 missing URL paths.
- GT pooled sets: 11/3/25/11 each.
- 756 asset paths, 0 missing, 0 external; 37 image-option questions resolve.

Post-apply:

- Every affected paper is either archived-with-301 or has a 50-question set; every exactly-50 paper is unchanged.
- **0** broken links on the PYQ hub, subject hubs, new set pages and old redirects.
- **0** archived URLs in the sitemap; **118** new URLs present.
- Playwright E2E on **3 random new sets** (one pooled, one pooled passage-bearing, one reduced GT) plus one untouched paper and one 301.
- Before/after row-count report and a redirect-status report.

---

## 14. Rollback

1. Restore the pre-apply SQL backup (row counts verified at backup time).
2. Delete new rows by the exact 118-slug allowlist from `PYQ_REBUILD_PLAN.json` (never by a broad `LIKE` pattern).
3. Clear `is_archived` / `replaced_by` on the 231 papers and restore old mock status.
4. Delete the 231 `slug_redirects` rows.
5. Purge KV caches and re-run the pre-apply validator.

Rollback is possible until new attempts are recorded; attempts on new sets would then be orphaned and are reported, not silently deleted.

---

## 15. Approval checklist

1. **>50 policy** — reduce the 15 overlong papers to 50 (recommended) or leave them overlong.
2. **Recovery candidates** — include the 11 near-50 papers in the pool (recommended).
3. **Applied Mathematics ownership** — 24 twins live in Applied Mathematics, not Mathematics (recommended).
4. **General Test quota** — 11 GK / 3 Current / 25 Quant / 11 Logical, 39 leftovers (recommended; no official sectional count exists).
5. **Sanitisation and quarantine** — repair 174 deterministically, quarantine 263 clusters, never guess (recommended).
6. **Zero-target papers** — archive 12 papers with 192 valid unused questions unpublished (recommended; the alternative is a custom “best-effort” allocation that still cannot reach 50 for Legal Studies/Sociology).
7. **Missing metadata** — publish 301 questions without a date and 1,219 without a shift, year-only tags, no invention.
8. **Explanations** — publish 1,457 questions without an explanation; none will be generated.
9. **Backup + migration window** — approve the backup path and the batched migration window.

A written “approved” against items 1–9 is required before `migrations/0029_pyq_50_question_sets.sql` is created or any D1 write runs.

**Nothing has been applied.**


---

## Appendix A — Full SHORT paper → set mapping (216)

| Old paper | Subject | Q | Carried | Primary new set | 301 target |
| --- | --- | --- | --- | --- | --- |
| `accountancy-2022` | Accountancy | 35 | 35 | `cuet-accountancy-pyq-set-1` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/accountancy/cuet-accountancy-pyq-set-1 |
| `accountancy-2023-06-01-shift-1` | Accountancy | 39 | 30 | `cuet-accountancy-pyq-set-1` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/accountancy/cuet-accountancy-pyq-set-1 |
| `accountancy-2023-06-02-shift-1` | Accountancy | 49 | 49 | `cuet-accountancy-pyq-set-2` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/accountancy/cuet-accountancy-pyq-set-2 |
| `accountancy-2023-06-05-shift-1` | Accountancy | 42 | 38 | `cuet-accountancy-pyq-set-3` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/accountancy/cuet-accountancy-pyq-set-3 |
| `accountancy-2023-06-07-shift-1` | Accountancy | 43 | 32 | `cuet-accountancy-pyq-set-4` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/accountancy/cuet-accountancy-pyq-set-4 |
| `accountancy-2023-06-10-shift-3` | Accountancy | 30 | 30 | `cuet-accountancy-pyq-set-4` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/accountancy/cuet-accountancy-pyq-set-4 |
| `accountancy-2023-06-12-shift-3` | Accountancy | 45 | 44 | `cuet-accountancy-pyq-set-5` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/accountancy/cuet-accountancy-pyq-set-5 |
| `accountancy-2024-05-17-shift-2` | Accountancy | 48 | 48 | `cuet-accountancy-pyq-set-6` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/accountancy/cuet-accountancy-pyq-set-6 |
| `accountancy-2024-07-19-shift-1` | Accountancy | 47 | 47 | `cuet-accountancy-pyq-set-7` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/accountancy/cuet-accountancy-pyq-set-7 |
| `accountancy-2025-06-02-shift-2` | Accountancy | 34 | 32 | `cuet-accountancy-pyq-set-8` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/accountancy/cuet-accountancy-pyq-set-8 |
| `accountancy-2025-06-03-shift-2` | Accountancy | 35 | 15 | `cuet-accountancy-pyq-set-8` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/accountancy/cuet-accountancy-pyq-set-8 |
| `applied-mathematics-2025-06-02-shift-1` | Applied Mathematics | 45 | 35 | `cuet-applied-mathematics-pyq-set-1` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/applied-mathematics/cuet-applied-mathematics-pyq-set-1 |
| `applied-mathematics-2025-06-03-shift-2` | Applied Mathematics | 46 | 15 | `cuet-applied-mathematics-pyq-set-1` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/applied-mathematics/cuet-applied-mathematics-pyq-set-1 |
| `biology-2022-08-18` | Biology | 47 | 45 | `cuet-biology-pyq-set-1` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/biology/cuet-biology-pyq-set-1 |
| `biology-2022-08-20` | Biology | 48 | 47 | `cuet-biology-pyq-set-2` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/biology/cuet-biology-pyq-set-2 |
| `biology-2022-08-23-shift-2` | Biology | 49 | 49 | `cuet-biology-pyq-set-3` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/biology/cuet-biology-pyq-set-3 |
| `biology-2022-08-30` | Biology | 46 | 46 | `cuet-biology-pyq-set-4` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/biology/cuet-biology-pyq-set-4 |
| `biology-2023-05-22-shift-1` | Biology | 48 | 48 | `cuet-biology-pyq-set-5` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/biology/cuet-biology-pyq-set-5 |
| `biology-2023-05-28-shift-1` | Biology | 49 | 49 | `cuet-biology-pyq-set-6` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/biology/cuet-biology-pyq-set-6 |
| `biology-2023-05-30-shift-1` | Biology | 45 | 45 | `cuet-biology-pyq-set-7` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/biology/cuet-biology-pyq-set-7 |
| `biology-2023-05-30-shift-2` | Biology | 46 | 46 | `cuet-biology-pyq-set-8` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/biology/cuet-biology-pyq-set-8 |
| `biology-2023-05-31-shift-3` | Biology | 47 | 47 | `cuet-biology-pyq-set-8` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/biology/cuet-biology-pyq-set-8 |
| `biology-2023-06-01-shift-3` | Biology | 49 | 49 | `cuet-biology-pyq-set-9` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/biology/cuet-biology-pyq-set-9 |
| `biology-2023-06-05-shift-3` | Biology | 48 | 48 | `cuet-biology-pyq-set-10` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/biology/cuet-biology-pyq-set-10 |
| `biology-2023-06-10-shift-1` | Biology | 48 | 48 | `cuet-biology-pyq-set-11` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/biology/cuet-biology-pyq-set-11 |
| `biology-2023-06-10-shift-3` | Biology | 48 | 48 | `cuet-biology-pyq-set-12` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/biology/cuet-biology-pyq-set-12 |
| `biology-2024-05-15-shift-1` | Biology | 49 | 49 | `cuet-biology-pyq-set-13` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/biology/cuet-biology-pyq-set-13 |
| `biology-2024-05-29-shift-1` | Biology | 45 | 44 | `cuet-biology-pyq-set-14` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/biology/cuet-biology-pyq-set-14 |
| `biology-2024-07-19` | Biology | 48 | 42 | `cuet-biology-pyq-set-15` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/biology/cuet-biology-pyq-set-15 |
| `biology-2025-05-20-shift-2` | Biology | 42 | 0 | — | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/biology |
| `business-studies-2022` | Business Studies | 31 | 29 | `cuet-business-studies-pyq-set-1` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/business-studies/cuet-business-studies-pyq-set-1 |
| `business-studies-2023-06-10-shift-3` | Business Studies | 46 | 43 | `cuet-business-studies-pyq-set-2` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/business-studies/cuet-business-studies-pyq-set-2 |
| `business-studies-2023-06-11-shift-3` | Business Studies | 43 | 33 | `cuet-business-studies-pyq-set-2` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/business-studies/cuet-business-studies-pyq-set-2 |
| `business-studies-2023-06-12-shift-2` | Business Studies | 44 | 43 | `cuet-business-studies-pyq-set-3` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/business-studies/cuet-business-studies-pyq-set-3 |
| `business-studies-2023-06-12-shift-3` | Business Studies | 41 | 41 | `cuet-business-studies-pyq-set-4` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/business-studies/cuet-business-studies-pyq-set-4 |
| `business-studies-2024-05-17-shift-2` | Business Studies | 48 | 48 | `cuet-business-studies-pyq-set-5` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/business-studies/cuet-business-studies-pyq-set-5 |
| `business-studies-2025-05-30-shift-1` | Business Studies | 40 | 37 | `cuet-business-studies-pyq-set-6` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/business-studies/cuet-business-studies-pyq-set-6 |
| `business-studies-2025-05-30-shift-2` | Business Studies | 39 | 26 | `cuet-business-studies-pyq-set-6` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/business-studies/cuet-business-studies-pyq-set-6 |
| `chemistry-2022-08-17` | Chemistry | 43 | 43 | `cuet-chemistry-pyq-set-1` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-1 |
| `chemistry-2022-08-18` | Chemistry | 42 | 40 | `cuet-chemistry-pyq-set-2` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-2 |
| `chemistry-2022-08-23` | Chemistry | 40 | 39 | `cuet-chemistry-pyq-set-3` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-3 |
| `chemistry-2023-06-02-shift-3` | Chemistry | 46 | 45 | `cuet-chemistry-pyq-set-3` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-3 |
| `chemistry-2023-06-05-shift-1` | Chemistry | 45 | 45 | `cuet-chemistry-pyq-set-4` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-4 |
| `chemistry-2023-06-07-shift-3` | Chemistry | 40 | 38 | `cuet-chemistry-pyq-set-5` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-5 |
| `chemistry-2023-06-08-shift-3` | Chemistry | 48 | 48 | `cuet-chemistry-pyq-set-6` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-6 |
| `chemistry-2023-06-10-shift-1` | Chemistry | 43 | 43 | `cuet-chemistry-pyq-set-7` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-7 |
| `chemistry-2023-06-11-shift-3` | Chemistry | 49 | 48 | `cuet-chemistry-pyq-set-8` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-8 |
| `chemistry-2023-06-13-shift-3` | Chemistry | 42 | 41 | `cuet-chemistry-pyq-set-9` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-9 |
| `chemistry-2023-06-15-shift-1` | Chemistry | 49 | 49 | `cuet-chemistry-pyq-set-10` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-10 |
| `chemistry-2024-05-15-shift-1` | Chemistry | 46 | 45 | `cuet-chemistry-pyq-set-11` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-11 |
| `chemistry-2024-05-29` | Chemistry | 48 | 48 | `cuet-chemistry-pyq-set-11` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-11 |
| `chemistry-2024-07-19` | Chemistry | 45 | 45 | `cuet-chemistry-pyq-set-12` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-12 |
| `chemistry-2025-05-21-shift-2` | Chemistry | 43 | 33 | `cuet-chemistry-pyq-set-13` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-13 |
| `chemistry-2025-05-23-shift-2` | Chemistry | 47 | 46 | `cuet-chemistry-pyq-set-14` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-14 |
| `chemistry-2026-05-11-shift-1` | Chemistry | 6 | 6 | `cuet-chemistry-pyq-set-14` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-14 |
| `chemistry-2026-05-12-shift-2` | Chemistry | 9 | 9 | `cuet-chemistry-pyq-set-15` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-15 |
| `chemistry-2026-05-15-shift-1` | Chemistry | 10 | 10 | `cuet-chemistry-pyq-set-15` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-15 |
| `chemistry-2026-05-18-shift-1` | Chemistry | 9 | 9 | `cuet-chemistry-pyq-set-15` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-15 |
| `chemistry-2026-05-18-shift-2` | Chemistry | 10 | 10 | `cuet-chemistry-pyq-set-15` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-15 |
| `chemistry-2026-05-19-shift-1` | Chemistry | 9 | 9 | `cuet-chemistry-pyq-set-15` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-15 |
| `chemistry-2026-05-21-shift-1` | Chemistry | 10 | 10 | `cuet-chemistry-pyq-set-16` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-16 |
| `chemistry-2026-05-22-shift-1` | Chemistry | 9 | 9 | `cuet-chemistry-pyq-set-16` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-16 |
| `chemistry-2026-05-22-shift-2` | Chemistry | 10 | 10 | `cuet-chemistry-pyq-set-16` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-16 |
| `chemistry-2026-05-26-shift-1` | Chemistry | 8 | 8 | `cuet-chemistry-pyq-set-16` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-16 |
| `chemistry-2026-05-29-shift-2` | Chemistry | 9 | 9 | `cuet-chemistry-pyq-set-16` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-16 |
| `chemistry-2026-05-30-shift-1` | Chemistry | 10 | 10 | `cuet-chemistry-pyq-set-16` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-16 |
| `chemistry-2026-05-30-shift-2` | Chemistry | 10 | 10 | `cuet-chemistry-pyq-set-17` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-17 |
| `chemistry-2026-05-31-shift-2` | Chemistry | 9 | 9 | `cuet-chemistry-pyq-set-17` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-17 |
| `chemistry-2026-06-06-shift-1` | Chemistry | 47 | 26 | `cuet-chemistry-pyq-set-17` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-17 |
| `computer-science-2022` | Computer Science | 39 | 38 | `cuet-computer-science-pyq-set-1` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/computer-science/cuet-computer-science-pyq-set-1 |
| `computer-science-2024-07-19-shift-1` | Computer Science | 45 | 45 | `cuet-computer-science-pyq-set-2` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/computer-science/cuet-computer-science-pyq-set-2 |
| `computer-science-2025` | Computer Science | 45 | 44 | `cuet-computer-science-pyq-set-3` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/computer-science/cuet-computer-science-pyq-set-3 |
| `computer-science-2026-05-11-shift-2` | Computer Science | 10 | 10 | `cuet-computer-science-pyq-set-3` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/computer-science/cuet-computer-science-pyq-set-3 |
| `computer-science-2026-05-21-shift-1` | Computer Science | 8 | 8 | `cuet-computer-science-pyq-set-3` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/computer-science/cuet-computer-science-pyq-set-3 |
| `computer-science-2026-05-31-shift-1` | Computer Science | 9 | 6 | `cuet-computer-science-pyq-set-3` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/computer-science/cuet-computer-science-pyq-set-3 |
| `economics-2022` | Economics | 29 | 28 | `cuet-economics-pyq-set-1` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/economics/cuet-economics-pyq-set-1 |
| `economics-2024-05-16-shift-1` | Economics | 48 | 48 | `cuet-economics-pyq-set-2` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/economics/cuet-economics-pyq-set-2 |
| `economics-2025-05-30-shift-1` | Economics | 21 | 20 | `cuet-economics-pyq-set-2` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/economics/cuet-economics-pyq-set-2 |
| `economics-2025-05-30-shift-2` | Economics | 26 | 4 | `cuet-economics-pyq-set-2` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/economics/cuet-economics-pyq-set-2 |
| `english-2022-08-06-shift-1` | English | 48 | 45 | `cuet-english-pyq-set-1` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-1 |
| `english-2022-08-10` | English | 48 | 47 | `cuet-english-pyq-set-2` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-2 |
| `english-2022-08-18` | English | 47 | 45 | `cuet-english-pyq-set-3` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-3 |
| `english-2022-08-22` | English | 46 | 45 | `cuet-english-pyq-set-4` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-4 |
| `english-2023-06-09-shift-2` | English | 47 | 47 | `cuet-english-pyq-set-5` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-5 |
| `english-2023-06-10-shift-2` | English | 49 | 49 | `cuet-english-pyq-set-6` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-6 |
| `english-2023-06-11-shift-1` | English | 49 | 49 | `cuet-english-pyq-set-7` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-7 |
| `english-2023-06-15-shift-3` | English | 49 | 47 | `cuet-english-pyq-set-8` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-8 |
| `english-2024-05-15-shift-2` | English | 33 | 33 | `cuet-english-pyq-set-8` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-8 |
| `english-2024-05-29-shift-1` | English | 47 | 47 | `cuet-english-pyq-set-9` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-9 |
| `english-2025-05-20-shift-1` | English | 46 | 36 | `cuet-english-pyq-set-10` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-10 |
| `english-2025-05-20-shift-2` | English | 49 | 36 | `cuet-english-pyq-set-11` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-11 |
| `english-2026-05-11-shift-1` | English | 43 | 42 | `cuet-english-pyq-set-11` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-11 |
| `english-2026-05-11-shift-2` | English | 9 | 9 | `cuet-english-pyq-set-12` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-12 |
| `english-2026-05-12-shift-1` | English | 9 | 9 | `cuet-english-pyq-set-12` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-12 |
| `english-2026-05-12-shift-2` | English | 8 | 8 | `cuet-english-pyq-set-12` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-12 |
| `english-2026-05-13-shift-1` | English | 10 | 10 | `cuet-english-pyq-set-10` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-10 |
| `english-2026-05-13-shift-2` | English | 10 | 10 | `cuet-english-pyq-set-10` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-10 |
| `english-2026-05-14-shift-1` | English | 10 | 10 | `cuet-english-pyq-set-10` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-10 |
| `english-2026-05-14-shift-2` | English | 9 | 9 | `cuet-english-pyq-set-13` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-13 |
| `english-2026-05-15-shift-1` | English | 9 | 9 | `cuet-english-pyq-set-13` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-13 |
| `english-2026-05-18-shift-1` | English | 9 | 8 | `cuet-english-pyq-set-13` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-13 |
| `english-2026-05-18-shift-2` | English | 9 | 9 | `cuet-english-pyq-set-13` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-13 |
| `english-2026-05-19-shift-1` | English | 9 | 9 | `cuet-english-pyq-set-13` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-13 |
| `english-2026-05-20-shift-1` | English | 9 | 9 | `cuet-english-pyq-set-13` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-13 |
| `english-2026-05-21-shift-1` | English | 10 | 10 | `cuet-english-pyq-set-14` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-14 |
| `english-2026-05-21-shift-2` | English | 6 | 5 | `cuet-english-pyq-set-14` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-14 |
| `english-2026-05-22-shift-2` | English | 10 | 9 | `cuet-english-pyq-set-14` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-14 |
| `english-2026-05-23-shift-2` | English | 9 | 9 | `cuet-english-pyq-set-14` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-14 |
| `english-2026-05-24-shift-1` | English | 8 | 8 | `cuet-english-pyq-set-14` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-14 |
| `english-2026-05-25-shift-1` | English | 9 | 9 | `cuet-english-pyq-set-14` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-14 |
| `english-2026-05-26-shift-1` | English | 13 | 13 | `cuet-english-pyq-set-15` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-15 |
| `english-2026-05-26-shift-2` | English | 9 | 8 | `cuet-english-pyq-set-15` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-15 |
| `english-2026-05-27-shift-1` | English | 6 | 6 | `cuet-english-pyq-set-15` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-15 |
| `english-2026-05-29-shift-2` | English | 10 | 10 | `cuet-english-pyq-set-15` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-15 |
| `english-2026-05-30-shift-1` | English | 10 | 9 | `cuet-english-pyq-set-15` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-15 |
| `english-2026-05-30-shift-2` | English | 6 | 1 | `cuet-english-pyq-set-15` | /cuet-ug-previous-year-question-papers/language-pyqs/english/cuet-english-pyq-set-15 |
| `english-2026-05-31-shift-1` | English | 10 | 0 | — | /cuet-ug-previous-year-question-papers/language-pyqs/english |
| `english-2026-05-31-shift-2` | English | 9 | 0 | — | /cuet-ug-previous-year-question-papers/language-pyqs/english |
| `english-2026-06-06-shift-2` | English | 5 | 0 | — | /cuet-ug-previous-year-question-papers/language-pyqs/english |
| `english-2026-06-07-shift-2` | English | 10 | 0 | — | /cuet-ug-previous-year-question-papers/language-pyqs/english |
| `general-test-2025-05-20-shift-1` | General Test | 49 | 48 | `cuet-general-test-pyq-set-15` | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test/cuet-general-test-pyq-set-15 |
| `general-test-2025-05-20-shift-2` | General Test | 44 | 41 | `cuet-general-test-pyq-set-16` | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test/cuet-general-test-pyq-set-16 |
| `general-test-2026-05-12-shift-1` | General Test | 10 | 10 | `cuet-general-test-pyq-set-16` | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test/cuet-general-test-pyq-set-16 |
| `general-test-2026-05-14-shift-1` | General Test | 8 | 7 | `cuet-general-test-pyq-set-16` | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test/cuet-general-test-pyq-set-16 |
| `general-test-2026-05-14-shift-2` | General Test | 10 | 10 | `cuet-general-test-pyq-set-17` | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test/cuet-general-test-pyq-set-17 |
| `general-test-2026-05-18-shift-1` | General Test | 9 | 9 | `cuet-general-test-pyq-set-16` | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test/cuet-general-test-pyq-set-16 |
| `general-test-2026-05-18-shift-2` | General Test | 7 | 7 | `cuet-general-test-pyq-set-18` | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test/cuet-general-test-pyq-set-18 |
| `general-test-2026-05-19-shift-1` | General Test | 9 | 9 | `cuet-general-test-pyq-set-17` | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test/cuet-general-test-pyq-set-17 |
| `general-test-2026-05-19-shift-2` | General Test | 10 | 10 | `cuet-general-test-pyq-set-17` | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test/cuet-general-test-pyq-set-17 |
| `general-test-2026-05-20-shift-1` | General Test | 7 | 7 | `cuet-general-test-pyq-set-17` | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test/cuet-general-test-pyq-set-17 |
| `general-test-2026-05-21-shift-1` | General Test | 9 | 8 | `cuet-general-test-pyq-set-18` | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test/cuet-general-test-pyq-set-18 |
| `general-test-2026-05-21-shift-2` | General Test | 9 | 9 | `cuet-general-test-pyq-set-18` | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test/cuet-general-test-pyq-set-18 |
| `general-test-2026-05-22-shift-1` | General Test | 7 | 7 | `cuet-general-test-pyq-set-18` | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test/cuet-general-test-pyq-set-18 |
| `general-test-2026-05-22-shift-2` | General Test | 10 | 6 | `cuet-general-test-pyq-set-18` | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test/cuet-general-test-pyq-set-18 |
| `general-test-2026-05-26-shift-1` | General Test | 3 | 2 | `cuet-general-test-pyq-set-13` | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test/cuet-general-test-pyq-set-13 |
| `general-test-2026-05-29-shift-1` | General Test | 8 | 2 | `cuet-general-test-pyq-set-17` | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test/cuet-general-test-pyq-set-17 |
| `general-test-2026-05-29-shift-2` | General Test | 8 | 0 | — | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test |
| `general-test-2026-05-30-shift-1` | General Test | 2 | 0 | — | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test |
| `general-test-2026-05-30-shift-2` | General Test | 4 | 3 | `cuet-general-test-pyq-set-18` | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test/cuet-general-test-pyq-set-18 |
| `general-test-2026-05-31-shift-1` | General Test | 10 | 5 | `cuet-general-test-pyq-set-18` | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test/cuet-general-test-pyq-set-18 |
| `general-test-2026-05-31-shift-2` | General Test | 10 | 1 | `cuet-general-test-pyq-set-18` | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test/cuet-general-test-pyq-set-18 |
| `general-test-2026-06-06-shift-1` | General Test | 4 | 2 | `cuet-general-test-pyq-set-11` | /cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test/cuet-general-test-pyq-set-11 |
| `geography-2022` | Geography | 45 | 43 | `cuet-geography-pyq-set-1` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/geography/cuet-geography-pyq-set-1 |
| `geography-2024-05-17-shift-1` | Geography | 49 | 49 | `cuet-geography-pyq-set-2` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/geography/cuet-geography-pyq-set-2 |
| `geography-2025-05-20-shift-1` | Geography | 46 | 38 | `cuet-geography-pyq-set-3` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/geography/cuet-geography-pyq-set-3 |
| `geography-2026-05-11-shift-1` | Geography | 9 | 9 | `cuet-geography-pyq-set-3` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/geography/cuet-geography-pyq-set-3 |
| `geography-2026-05-13-shift-1` | Geography | 8 | 8 | `cuet-geography-pyq-set-3` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/geography/cuet-geography-pyq-set-3 |
| `geography-2026-05-14-shift-1` | Geography | 7 | 3 | `cuet-geography-pyq-set-3` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/geography/cuet-geography-pyq-set-3 |
| `geography-2026-05-15-shift-1` | Geography | 10 | 0 | — | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/geography |
| `geography-2026-05-21-shift-1` | Geography | 9 | 0 | — | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/geography |
| `hindi-2024-05-16-shift-2` | Hindi | 48 | 48 | `cuet-hindi-pyq-set-1` | /cuet-ug-previous-year-question-papers/language-pyqs/hindi/cuet-hindi-pyq-set-1 |
| `hindi-2025` | Hindi | 47 | 2 | `cuet-hindi-pyq-set-1` | /cuet-ug-previous-year-question-papers/language-pyqs/hindi/cuet-hindi-pyq-set-1 |
| `history-2022` | History | 36 | 36 | `cuet-history-pyq-set-1` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/history/cuet-history-pyq-set-1 |
| `history-2022-08-21-shift-1` | History | 40 | 40 | `cuet-history-pyq-set-2` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/history/cuet-history-pyq-set-2 |
| `history-2022-08-21-shift-2` | History | 46 | 45 | `cuet-history-pyq-set-2` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/history/cuet-history-pyq-set-2 |
| `history-2024-05-18-shift-1` | History | 48 | 48 | `cuet-history-pyq-set-3` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/history/cuet-history-pyq-set-3 |
| `history-2025-05-16-shift-1` | History | 45 | 36 | `cuet-history-pyq-set-4` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/history/cuet-history-pyq-set-4 |
| `history-2025-05-20-shift-1` | History | 45 | 39 | `cuet-history-pyq-set-5` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/history/cuet-history-pyq-set-5 |
| `history-2025-06-03-shift-2` | History | 42 | 36 | `cuet-history-pyq-set-6` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/history/cuet-history-pyq-set-6 |
| `history-2025-06-21-shift-1` | History | 44 | 38 | `cuet-history-pyq-set-6` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/history/cuet-history-pyq-set-6 |
| `history-2026-05-11-shift-1` | History | 10 | 10 | `cuet-history-pyq-set-7` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/history/cuet-history-pyq-set-7 |
| `history-2026-05-11-shift-2` | History | 10 | 10 | `cuet-history-pyq-set-7` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/history/cuet-history-pyq-set-7 |
| `history-2026-05-13-shift-1` | History | 9 | 9 | `cuet-history-pyq-set-7` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/history/cuet-history-pyq-set-7 |
| `history-2026-05-21-shift-1` | History | 5 | 3 | `cuet-history-pyq-set-7` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/history/cuet-history-pyq-set-7 |
| `history-2026-05-29-shift-2` | History | 10 | 0 | — | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/history |
| `legal-studies-2022` | Legal Studies | 38 | 0 | — | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/legal-studies |
| `mathematics-2022-08-17` | Mathematics | 45 | 43 | `cuet-mathematics-pyq-set-1` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/mathematics/cuet-mathematics-pyq-set-1 |
| `mathematics-2022-08-22` | Mathematics | 42 | 38 | `cuet-mathematics-pyq-set-2` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/mathematics/cuet-mathematics-pyq-set-2 |
| `mathematics-2022-08-30` | Mathematics | 40 | 38 | `cuet-mathematics-pyq-set-2` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/mathematics/cuet-mathematics-pyq-set-2 |
| `mathematics-2024-07-19-shift-1` | Mathematics | 47 | 45 | `cuet-mathematics-pyq-set-3` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/mathematics/cuet-mathematics-pyq-set-3 |
| `mathematics-2025-06-02-shift-1` | Mathematics | 48 | 36 | `cuet-mathematics-pyq-set-4` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/mathematics/cuet-mathematics-pyq-set-4 |
| `mathematics-2025-06-03-shift-2` | Mathematics | 46 | 41 | `cuet-mathematics-pyq-set-5` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/mathematics/cuet-mathematics-pyq-set-5 |
| `mathematics-2026-05-14-shift-2` | Mathematics | 9 | 8 | `cuet-mathematics-pyq-set-5` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/mathematics/cuet-mathematics-pyq-set-5 |
| `mathematics-2026-05-15-shift-1` | Mathematics | 10 | 8 | `cuet-mathematics-pyq-set-5` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/mathematics/cuet-mathematics-pyq-set-5 |
| `mathematics-2026-05-18-shift-1` | Mathematics | 8 | 8 | `cuet-mathematics-pyq-set-5` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/mathematics/cuet-mathematics-pyq-set-5 |
| `mathematics-2026-05-18-shift-2` | Mathematics | 9 | 9 | `cuet-mathematics-pyq-set-6` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/mathematics/cuet-mathematics-pyq-set-6 |
| `mathematics-2026-05-19-shift-1` | Mathematics | 10 | 9 | `cuet-mathematics-pyq-set-6` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/mathematics/cuet-mathematics-pyq-set-6 |
| `mathematics-2026-05-21-shift-1` | Mathematics | 9 | 9 | `cuet-mathematics-pyq-set-6` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/mathematics/cuet-mathematics-pyq-set-6 |
| `mathematics-2026-05-21-shift-2` | Mathematics | 10 | 10 | `cuet-mathematics-pyq-set-6` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/mathematics/cuet-mathematics-pyq-set-6 |
| `mathematics-2026-05-22-shift-1` | Mathematics | 8 | 8 | `cuet-mathematics-pyq-set-6` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/mathematics/cuet-mathematics-pyq-set-6 |
| `mathematics-2026-05-22-shift-2` | Mathematics | 8 | 8 | `cuet-mathematics-pyq-set-6` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/mathematics/cuet-mathematics-pyq-set-6 |
| `mathematics-2026-05-26-shift-2` | Mathematics | 8 | 8 | `cuet-mathematics-pyq-set-8` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/mathematics/cuet-mathematics-pyq-set-8 |
| `mathematics-2026-05-29-shift-1` | Mathematics | 10 | 10 | `cuet-mathematics-pyq-set-8` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/mathematics/cuet-mathematics-pyq-set-8 |
| `mathematics-2026-05-29-shift-2` | Mathematics | 10 | 9 | `cuet-mathematics-pyq-set-8` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/mathematics/cuet-mathematics-pyq-set-8 |
| `mathematics-2026-05-30-shift-1` | Mathematics | 9 | 9 | `cuet-mathematics-pyq-set-8` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/mathematics/cuet-mathematics-pyq-set-8 |
| `mathematics-2026-05-30-shift-2` | Mathematics | 9 | 9 | `cuet-mathematics-pyq-set-8` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/mathematics/cuet-mathematics-pyq-set-8 |
| `mathematics-2026-05-31-shift-2` | Mathematics | 10 | 7 | `cuet-mathematics-pyq-set-8` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/mathematics/cuet-mathematics-pyq-set-8 |
| `physics-2022-08-06` | Physics | 40 | 37 | `cuet-physics-pyq-set-1` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-1 |
| `physics-2022-08-22` | Physics | 47 | 44 | `cuet-physics-pyq-set-2` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-2 |
| `physics-2022-08-26` | Physics | 38 | 36 | `cuet-physics-pyq-set-2` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-2 |
| `physics-2023-05-21-shift-3` | Physics | 48 | 46 | `cuet-physics-pyq-set-3` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-3 |
| `physics-2023-05-22-shift-3` | Physics | 45 | 45 | `cuet-physics-pyq-set-4` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-4 |
| `physics-2023-05-25-shift-3` | Physics | 49 | 48 | `cuet-physics-pyq-set-5` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-5 |
| `physics-2023-05-30-shift-1` | Physics | 45 | 45 | `cuet-physics-pyq-set-6` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-6 |
| `physics-2023-06-09-shift-3` | Physics | 48 | 48 | `cuet-physics-pyq-set-7` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-7 |
| `physics-2024-05-16-shift-3` | Physics | 44 | 43 | `cuet-physics-pyq-set-8` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-8 |
| `physics-2024-07-19-shift-1` | Physics | 43 | 43 | `cuet-physics-pyq-set-9` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-9 |
| `physics-2025-05-20-shift-2` | Physics | 48 | 43 | `cuet-physics-pyq-set-10` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-10 |
| `physics-2026-05-12-shift-2` | Physics | 10 | 10 | `cuet-physics-pyq-set-10` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-10 |
| `physics-2026-05-14-shift-2` | Physics | 8 | 8 | `cuet-physics-pyq-set-10` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-10 |
| `physics-2026-05-15-shift-1` | Physics | 10 | 10 | `cuet-physics-pyq-set-10` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-10 |
| `physics-2026-05-18-shift-1` | Physics | 10 | 10 | `cuet-physics-pyq-set-11` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-11 |
| `physics-2026-05-18-shift-2` | Physics | 7 | 7 | `cuet-physics-pyq-set-11` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-11 |
| `physics-2026-05-19-shift-1` | Physics | 9 | 9 | `cuet-physics-pyq-set-11` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-11 |
| `physics-2026-05-22-shift-1` | Physics | 8 | 8 | `cuet-physics-pyq-set-11` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-11 |
| `physics-2026-05-22-shift-2` | Physics | 10 | 10 | `cuet-physics-pyq-set-11` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-11 |
| `physics-2026-05-25-shift-1` | Physics | 10 | 10 | `cuet-physics-pyq-set-11` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-11 |
| `physics-2026-05-29-shift-1` | Physics | 10 | 10 | `cuet-physics-pyq-set-12` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-12 |
| `physics-2026-05-29-shift-2` | Physics | 10 | 10 | `cuet-physics-pyq-set-12` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-12 |
| `physics-2026-05-30-shift-1` | Physics | 10 | 10 | `cuet-physics-pyq-set-12` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-12 |
| `physics-2026-05-31-shift-2` | Physics | 10 | 10 | `cuet-physics-pyq-set-12` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-12 |
| `physics-2026-06-06-shift-1` | Physics | 10 | 7 | `cuet-physics-pyq-set-12` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/physics/cuet-physics-pyq-set-12 |
| `political-science-2022` | Political Science | 46 | 46 | `cuet-political-science-pyq-set-1` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/political-science/cuet-political-science-pyq-set-1 |
| `political-science-2025-06-20-shift-1` | Political Science | 35 | 35 | `cuet-political-science-pyq-set-2` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/political-science/cuet-political-science-pyq-set-2 |
| `political-science-2025-06-27-shift-2` | Political Science | 29 | 19 | `cuet-political-science-pyq-set-2` | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/political-science/cuet-political-science-pyq-set-2 |
| `sociology-2024-05-18-shift-3` | Sociology | 49 | 0 | — | /cuet-ug-previous-year-question-papers/domain-subject-pyqs/sociology |

A paper marked “—” carries no question into a set, redirects to its subject hub, and leaves its valid questions in the unused pool.

---

## Appendix B — New set index (118)

| Set slug | Subject | Set # | Kind | Oldest source | Source papers | Questions without a date |
| --- | --- | --- | --- | --- | --- | --- |
| `cuet-accountancy-pyq-set-1` | Accountancy | 1 | pooled | 2022-01-01 | 2 | 35 |
| `cuet-accountancy-pyq-set-2` | Accountancy | 2 | pooled | 2023-06-01 | 2 | 0 |
| `cuet-accountancy-pyq-set-3` | Accountancy | 3 | pooled | 2023-06-02 | 2 | 0 |
| `cuet-accountancy-pyq-set-4` | Accountancy | 4 | pooled | 2023-06-05 | 3 | 0 |
| `cuet-accountancy-pyq-set-5` | Accountancy | 5 | pooled | 2023-06-10 | 2 | 0 |
| `cuet-accountancy-pyq-set-6` | Accountancy | 6 | pooled | 2023-06-12 | 2 | 0 |
| `cuet-accountancy-pyq-set-7` | Accountancy | 7 | pooled | 2024-05-17 | 2 | 0 |
| `cuet-accountancy-pyq-set-8` | Accountancy | 8 | pooled | 2024-07-19 | 3 | 0 |
| `cuet-applied-mathematics-pyq-set-1` | Applied Mathematics | 1 | pooled | 2025-06-02 | 2 | 0 |
| `cuet-biology-pyq-set-1` | Biology | 1 | pooled | 2022-08-18 | 2 | 0 |
| `cuet-biology-pyq-set-2` | Biology | 2 | pooled | 2022-08-20 | 2 | 0 |
| `cuet-biology-pyq-set-3` | Biology | 3 | pooled | 2022-08-23 | 2 | 0 |
| `cuet-biology-pyq-set-4` | Biology | 4 | pooled | 2022-08-30 | 2 | 0 |
| `cuet-biology-pyq-set-5` | Biology | 5 | pooled | 2023-05-22 | 2 | 0 |
| `cuet-biology-pyq-set-6` | Biology | 6 | pooled | 2023-05-28 | 2 | 0 |
| `cuet-biology-pyq-set-7` | Biology | 7 | pooled | 2023-05-30 | 2 | 0 |
| `cuet-biology-pyq-set-8` | Biology | 8 | pooled | 2023-05-30 | 2 | 0 |
| `cuet-biology-pyq-set-9` | Biology | 9 | pooled | 2023-05-31 | 2 | 0 |
| `cuet-biology-pyq-set-10` | Biology | 10 | pooled | 2023-06-01 | 2 | 0 |
| `cuet-biology-pyq-set-11` | Biology | 11 | pooled | 2023-06-05 | 2 | 0 |
| `cuet-biology-pyq-set-12` | Biology | 12 | pooled | 2023-06-10 | 2 | 0 |
| `cuet-biology-pyq-set-13` | Biology | 13 | pooled | 2023-06-10 | 2 | 0 |
| `cuet-biology-pyq-set-14` | Biology | 14 | pooled | 2024-05-15 | 2 | 0 |
| `cuet-biology-pyq-set-15` | Biology | 15 | pooled | 2024-05-29 | 2 | 0 |
| `cuet-business-studies-pyq-set-1` | Business Studies | 1 | pooled | 2022-01-01 | 2 | 29 |
| `cuet-business-studies-pyq-set-2` | Business Studies | 2 | pooled | 2023-06-10 | 2 | 0 |
| `cuet-business-studies-pyq-set-3` | Business Studies | 3 | pooled | 2023-06-11 | 3 | 0 |
| `cuet-business-studies-pyq-set-4` | Business Studies | 4 | pooled | 2023-06-12 | 2 | 0 |
| `cuet-business-studies-pyq-set-5` | Business Studies | 5 | pooled | 2024-05-17 | 2 | 0 |
| `cuet-business-studies-pyq-set-6` | Business Studies | 6 | pooled | 2025-05-30 | 2 | 0 |
| `cuet-chemistry-pyq-set-1` | Chemistry | 1 | pooled | 2022-08-17 | 2 | 0 |
| `cuet-chemistry-pyq-set-2` | Chemistry | 2 | pooled | 2022-08-18 | 2 | 0 |
| `cuet-chemistry-pyq-set-3` | Chemistry | 3 | pooled | 2022-08-23 | 2 | 0 |
| `cuet-chemistry-pyq-set-4` | Chemistry | 4 | pooled | 2023-06-02 | 2 | 0 |
| `cuet-chemistry-pyq-set-5` | Chemistry | 5 | pooled | 2023-06-05 | 2 | 0 |
| `cuet-chemistry-pyq-set-6` | Chemistry | 6 | pooled | 2023-06-08 | 2 | 0 |
| `cuet-chemistry-pyq-set-7` | Chemistry | 7 | pooled | 2023-06-10 | 2 | 0 |
| `cuet-chemistry-pyq-set-8` | Chemistry | 8 | pooled | 2023-06-11 | 2 | 0 |
| `cuet-chemistry-pyq-set-9` | Chemistry | 9 | pooled | 2023-06-13 | 2 | 0 |
| `cuet-chemistry-pyq-set-10` | Chemistry | 10 | pooled | 2023-06-15 | 2 | 0 |
| `cuet-chemistry-pyq-set-11` | Chemistry | 11 | pooled | 2024-05-15 | 2 | 0 |
| `cuet-chemistry-pyq-set-12` | Chemistry | 12 | pooled | 2024-05-29 | 2 | 0 |
| `cuet-chemistry-pyq-set-13` | Chemistry | 13 | pooled | 2024-07-19 | 2 | 0 |
| `cuet-chemistry-pyq-set-14` | Chemistry | 14 | pooled | 2025-05-23 | 2 | 0 |
| `cuet-chemistry-pyq-set-15` | Chemistry | 15 | pooled | 2026-05-11 | 7 | 0 |
| `cuet-chemistry-pyq-set-16` | Chemistry | 16 | pooled | 2026-05-21 | 6 | 0 |
| `cuet-chemistry-pyq-set-17` | Chemistry | 17 | pooled | 2026-05-30 | 4 | 0 |
| `cuet-computer-science-pyq-set-1` | Computer Science | 1 | pooled | 2022-01-01 | 2 | 38 |
| `cuet-computer-science-pyq-set-2` | Computer Science | 2 | pooled | 2024-07-19 | 2 | 17 |
| `cuet-computer-science-pyq-set-3` | Computer Science | 3 | pooled | 2025-01-01 | 4 | 27 |
| `cuet-economics-pyq-set-1` | Economics | 1 | pooled | 2022-01-01 | 2 | 28 |
| `cuet-economics-pyq-set-2` | Economics | 2 | pooled | 2024-05-16 | 3 | 0 |
| `cuet-english-pyq-set-1` | English | 1 | pooled | 2022-08-06 | 2 | 0 |
| `cuet-english-pyq-set-2` | English | 2 | pooled | 2022-08-10 | 2 | 0 |
| `cuet-english-pyq-set-3` | English | 3 | pooled | 2022-08-18 | 2 | 0 |
| `cuet-english-pyq-set-4` | English | 4 | pooled | 2022-08-22 | 2 | 0 |
| `cuet-english-pyq-set-5` | English | 5 | pooled | 2023-06-09 | 2 | 0 |
| `cuet-english-pyq-set-6` | English | 6 | pooled | 2023-06-10 | 2 | 0 |
| `cuet-english-pyq-set-7` | English | 7 | pooled | 2023-06-11 | 2 | 0 |
| `cuet-english-pyq-set-8` | English | 8 | pooled | 2023-06-15 | 2 | 0 |
| `cuet-english-pyq-set-9` | English | 9 | pooled | 2024-05-15 | 2 | 0 |
| `cuet-english-pyq-set-10` | English | 10 | pooled | 2024-05-29 | 3 | 0 |
| `cuet-english-pyq-set-11` | English | 11 | pooled | 2025-05-20 | 2 | 0 |
| `cuet-english-pyq-set-12` | English | 12 | pooled | 2026-05-11 | 6 | 0 |
| `cuet-english-pyq-set-13` | English | 13 | pooled | 2026-05-14 | 6 | 0 |
| `cuet-english-pyq-set-14` | English | 14 | pooled | 2026-05-20 | 7 | 0 |
| `cuet-english-pyq-set-15` | English | 15 | pooled | 2026-05-25 | 7 | 0 |
| `cuet-general-test-pyq-set-1` | General Test | 1 | reduced | 2021-09-23 | 1 | 0 |
| `cuet-general-test-pyq-set-2` | General Test | 2 | reduced | 2022-08-06 | 1 | 0 |
| `cuet-general-test-pyq-set-3` | General Test | 3 | reduced | 2022-08-08 | 1 | 0 |
| `cuet-general-test-pyq-set-4` | General Test | 4 | reduced | 2022-08-18 | 1 | 0 |
| `cuet-general-test-pyq-set-5` | General Test | 5 | reduced | 2022-08-22 | 1 | 0 |
| `cuet-general-test-pyq-set-6` | General Test | 6 | reduced | 2022-08-23 | 1 | 0 |
| `cuet-general-test-pyq-set-7` | General Test | 7 | reduced | 2022-10-06 | 1 | 0 |
| `cuet-general-test-pyq-set-8` | General Test | 8 | reduced | 2023-05-21 | 1 | 0 |
| `cuet-general-test-pyq-set-9` | General Test | 9 | reduced | 2023-05-27 | 1 | 0 |
| `cuet-general-test-pyq-set-10` | General Test | 10 | reduced | 2023-06-05 | 1 | 0 |
| `cuet-general-test-pyq-set-11` | General Test | 11 | reduced | 2023-06-09 | 1 | 0 |
| `cuet-general-test-pyq-set-12` | General Test | 12 | reduced | 2023-06-10 | 1 | 0 |
| `cuet-general-test-pyq-set-13` | General Test | 13 | reduced | 2024-05-15 | 1 | 0 |
| `cuet-general-test-pyq-set-14` | General Test | 14 | reduced | 2024-05-29 | 1 | 0 |
| `cuet-general-test-pyq-set-15` | General Test | 15 | pooled | 2025-05-20 | 2 | 0 |
| `cuet-general-test-pyq-set-16` | General Test | 16 | pooled | 2025-05-20 | 7 | 0 |
| `cuet-general-test-pyq-set-17` | General Test | 17 | pooled | 2025-05-20 | 12 | 0 |
| `cuet-general-test-pyq-set-18` | General Test | 18 | pooled | 2026-05-14 | 15 | 0 |
| `cuet-geography-pyq-set-1` | Geography | 1 | pooled | 2022-01-01 | 2 | 43 |
| `cuet-geography-pyq-set-2` | Geography | 2 | pooled | 2024-05-17 | 2 | 0 |
| `cuet-geography-pyq-set-3` | Geography | 3 | pooled | 2025-05-20 | 4 | 0 |
| `cuet-hindi-pyq-set-1` | Hindi | 1 | pooled | 2024-05-16 | 2 | 2 |
| `cuet-history-pyq-set-1` | History | 1 | pooled | 2022-01-01 | 2 | 36 |
| `cuet-history-pyq-set-2` | History | 2 | pooled | 2022-08-21 | 2 | 0 |
| `cuet-history-pyq-set-3` | History | 3 | pooled | 2022-08-21 | 2 | 0 |
| `cuet-history-pyq-set-4` | History | 4 | pooled | 2024-05-18 | 2 | 0 |
| `cuet-history-pyq-set-5` | History | 5 | pooled | 2025-05-16 | 3 | 0 |
| `cuet-history-pyq-set-6` | History | 6 | pooled | 2025-06-03 | 2 | 0 |
| `cuet-history-pyq-set-7` | History | 7 | pooled | 2025-06-21 | 5 | 0 |
| `cuet-mathematics-pyq-set-1` | Mathematics | 1 | pooled | 2022-08-17 | 2 | 0 |
| `cuet-mathematics-pyq-set-2` | Mathematics | 2 | pooled | 2022-08-22 | 2 | 0 |
| `cuet-mathematics-pyq-set-3` | Mathematics | 3 | pooled | 2022-08-30 | 2 | 0 |
| `cuet-mathematics-pyq-set-4` | Mathematics | 4 | pooled | 2024-07-19 | 3 | 0 |
| `cuet-mathematics-pyq-set-5` | Mathematics | 5 | pooled | 2025-06-03 | 5 | 0 |
| `cuet-mathematics-pyq-set-6` | Mathematics | 6 | pooled | 2026-05-18 | 7 | 0 |
| `cuet-mathematics-pyq-set-7` | Mathematics | 7 | reduced | 2026-05-20 | 1 | 0 |
| `cuet-mathematics-pyq-set-8` | Mathematics | 8 | pooled | 2026-05-26 | 6 | 0 |
| `cuet-physics-pyq-set-1` | Physics | 1 | pooled | 2022-08-06 | 2 | 0 |
| `cuet-physics-pyq-set-2` | Physics | 2 | pooled | 2022-08-22 | 2 | 0 |
| `cuet-physics-pyq-set-3` | Physics | 3 | pooled | 2022-08-26 | 2 | 0 |
| `cuet-physics-pyq-set-4` | Physics | 4 | pooled | 2023-05-21 | 2 | 0 |
| `cuet-physics-pyq-set-5` | Physics | 5 | pooled | 2023-05-22 | 2 | 0 |
| `cuet-physics-pyq-set-6` | Physics | 6 | pooled | 2023-05-25 | 2 | 0 |
| `cuet-physics-pyq-set-7` | Physics | 7 | pooled | 2023-05-30 | 3 | 0 |
| `cuet-physics-pyq-set-8` | Physics | 8 | pooled | 2024-05-16 | 2 | 0 |
| `cuet-physics-pyq-set-9` | Physics | 9 | pooled | 2024-07-19 | 2 | 0 |
| `cuet-physics-pyq-set-10` | Physics | 10 | pooled | 2025-05-20 | 4 | 0 |
| `cuet-physics-pyq-set-11` | Physics | 11 | pooled | 2026-05-15 | 7 | 0 |
| `cuet-physics-pyq-set-12` | Physics | 12 | pooled | 2026-05-25 | 6 | 0 |
| `cuet-political-science-pyq-set-1` | Political Science | 1 | pooled | 2022-01-01 | 2 | 46 |
| `cuet-political-science-pyq-set-2` | Political Science | 2 | pooled | 2025-06-20 | 2 | 0 |

“Questions without a date” counts year-only source tags; no date is invented.
