# CUET Mock — PYQ Paper Audit

**Status:** read-only audit complete. No production or local D1 rows were written.
**Date:** 18 November 2026
**Scope:** 245 PYQ practice papers, 7,527 practice questions, 252 mock tests, 24 attempts and 959 attempt answers in the local D1 mirror.
**Companion:** `PYQ_REBUILD_PLAN.md` / `PYQ_REBUILD_PLAN.json` (dry run, awaiting approval).

---

## 0. Executive summary

- **245** PYQ practice papers exist. **216 are SHORT** (<50 questions), **14 are exactly 50**, and **15 are over 50**.
- Only **29 papers** reach 50 questions; **14** of those are exactly 50 and can stay untouched.
- Source declarations account for **12,746** questions, but only **7,527** were imported: **5,219 (41%) are missing**.
- **2026 is the dominant defect**: 108 papers declare 5,635 questions and hold only 1,133. Most are 6–10 question memory-based extracts.
- **61 papers have fewer than 10 questions.** The single largest cause is incomplete source extraction, not database corruption.
- The audit found **zero same-subject/same-date/same-shift sibling fragments**. Merging same-shift fragments would recover nothing; the rebuild must pool across papers.
- Conservative deduplication finds **54 exact duplicate groups (61 extra rows)** and **30 near-duplicate groups (37 extra rows)**. Another **18 groups (42 rows)** were deliberately **not** deduplicated because they are match-list/figure questions with generic stems and distinct visual assets.
- **263 question clusters are quarantined** rather than guessed at. The largest groups are **118** source rows (**117** clusters) whose options are bare `1/2/3/4` labels (**63** of which still carry the real option texts inside the stem), **68** stem-is-option-fragment, **42** merged choice lists, **41** duplicate key options, **18** oversized option blocks, **17** merged option lists and **14** merged LaTeX option grids. Reasons overlap.
- **174 questions are sanitised deterministically**: **67** remove a pasted answer key/solution and **107** remove next-question or next-passage text appended to an option. Every removed key is checked against `correct_option`; conflicts are quarantined.
- OCR recovery was measured and **rejected as a way to reach 50**: it adds **+113 raw questions** across 82 SHORT papers, but **0 papers reach 50 verifiably keyed questions**.
- Planned outcome on the approved planning basis: **118 new 50-question sets (5,900 questions)** — **103 pooled** sets from the SHORT pool plus **15 reduced** sets from the overlong papers — while **14 exactly-50 papers stay untouched**.
- **388 questions** remain in the `unused_pool` (no short sets are created); **215 questions** are trimmed from overlong papers and retained in the archive.
- The rebuild is **dry-run only**. Nothing will be applied until the approval gate in §14 is cleared.

---

## 1. Inventory

### 1.1 Per-subject summary

| Subject | Lang | Papers | SHORT | =50 | >50 | Questions | Declared source | Missing | Distinct SHORT pool | Planned new sets | Unused |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Accountancy | English | 11 | 11 | 0 | 0 | 447 | 551 | 104 | 417 | 8 | 17 |
| Applied Mathematics | English | 2 | 2 | 0 | 0 | 91 | 100 | 9 | 75 | 1 | 25 |
| Biology | English | 18 | 17 | 1 | 0 | 852 | 899 | 47 | 791 | 15 | 41 |
| Business Studies | English | 8 | 8 | 0 | 0 | 332 | 392 | 60 | 310 | 6 | 10 |
| Chemistry | English | 31 | 31 | 0 | 0 | 891 | 1,548 | 657 | 869 | 17 | 19 |
| Computer Science | English | 6 | 6 | 0 | 0 | 156 | 300 | 144 | 153 | 3 | 3 |
| Economics | English | 4 | 4 | 0 | 0 | 124 | 198 | 74 | 122 | 2 | 22 |
| English | English | 48 | 41 | 7 | 0 | 1,201 | 2,399 | 1,198 | 786 | 15 | 36 |
| General Test | English | 36 | 22 | 0 | 14 | 1,158 | 2,290 | 1,132 | 239 | 18 | 39 |
| Geography | English | 9 | 8 | 1 | 0 | 233 | 450 | 217 | 172 | 3 | 22 |
| Hindi | Hindi | 3 | 2 | 1 | 0 | 145 | 149 | 4 | 94 | 1 | 44 |
| History | English | 13 | 13 | 0 | 0 | 390 | 639 | 249 | 362 | 7 | 12 |
| Legal Studies | English | 1 | 1 | 0 | 0 | 38 | 48 | 10 | 38 | 0 | 38 |
| Mathematics | English | 23 | 21 | 1 | 1 | 533 | 1,185 | 652 | 353 | 8 | 3 |
| Physics | English | 26 | 25 | 1 | 0 | 677 | 1,300 | 623 | 603 | 12 | 3 |
| Political Science | English | 4 | 3 | 1 | 0 | 160 | 198 | 38 | 105 | 2 | 5 |
| Psychology | English | 1 | 0 | 1 | 0 | 50 | 50 | 0 | 0 | 0 | 0 |
| Sociology | English | 1 | 1 | 0 | 0 | 49 | 50 | 1 | 49 | 0 | 49 |

Totals: **245 papers**, **216 SHORT**, **14 exactly 50**, **15 over 50**, **7,527 questions**, **12,746 declared**, **5,219 missing**.

Set counts include the **14 reduced General Test sets** and the **1 reduced Mathematics set**; the other **103 sets** are pooled. The *Eligible* column is the pooled SHORT pool only, so it does not include the 750 questions published from the 15 overlong papers. *Unused* is the pooled tail; it does not include questions trimmed from overlong papers.

### 1.2 Count distribution

| Band | Papers | Questions |
| --- | --- | --- |
| 0 | 0 | 0 |
| 1-9 | 61 | 482 |
| 10-19 | 43 | 433 |
| 20-29 | 4 | 105 |
| 30-39 | 13 | 462 |
| 40-49 | 95 | 4,356 |
| = 50 | 14 | 700 |
| 51-60 | 7 | 398 |
| >60 | 8 | 591 |

The distribution is bimodal: a large 40–49 cluster (95 papers, mostly one or two questions short) and a long 1–9 tail (61 papers, mostly 2026 memory-based extracts).

### 1.3 By year

| Year | Papers | COMPLETE (≥50) | SHORT | Questions | Declared source | Missing |
| --- | --- | --- | --- | --- | --- | --- |
| 2021 | 1 | 1 | 0 | 114 | 125 | 11 |
| 2022 | 35 | 8 | 27 | 1,640 | 1,885 | 245 |
| 2023 | 46 | 10 | 36 | 2,183 | 2,335 | 152 |
| 2024 | 25 | 5 | 20 | 1,181 | 1,268 | 87 |
| 2025 | 30 | 3 | 27 | 1,276 | 1,498 | 222 |
| 2026 | 108 | 2 | 106 | 1,133 | 5,635 | 4,502 |

---

## 2. Classification

### 2.1 Untouched — exactly 50 questions (14 papers, 700 questions)

These keep their slugs, URLs, mocks, attempts and redirects unchanged.

| Slug | Subject | Year | Exam date | Shift | Q |
| --- | --- | --- | --- | --- | --- |
| `biology-2025-05-20-shift-1` | Biology | 2025 | 2025-05-20 | Shift 1 | 50 |
| `english-2022-08-16-shift-1` | English | 2022 | 2022-08-16 | Shift 1 | 50 |
| `english-2023-05-21-shift-1` | English | 2023 | 2023-05-21 | Shift 1 | 50 |
| `english-2023-06-02-shift-3` | English | 2023 | 2023-06-02 | Shift 3 | 50 |
| `english-2023-06-05-shift-3` | English | 2023 | 2023-06-05 | Shift 3 | 50 |
| `english-2023-06-06-shift-2` | English | 2023 | 2023-06-06 | Shift 2 | 50 |
| `english-2023-06-13-shift-3` | English | 2023 | 2023-06-13 | Shift 3 | 50 |
| `english-2026-06-06-shift-1` | English | 2026 | 2026-06-06 | Shift 1 | 50 |
| `geography-2025-05-16-shift-1` | Geography | 2025 | 2025-05-16 | Shift 1 | 50 |
| `hindi-2022-08-30-shift-2` | Hindi | 2022 | 2022-08-30 | Shift 2 | 50 |
| `mathematics-2024-05-16-shift-1` | Mathematics | 2024 | 2024-05-16 | Shift 1 | 50 |
| `physics-2025-05-21-shift-2` | Physics | 2025 | 2025-05-21 | Shift 2 | 50 |
| `political-science-2024-05-18-shift-2` | Political Science | 2024 | 2024-05-18 | Shift 2 | 50 |
| `psychology-2024-07-19-shift-1` | Psychology | 2024 | 2024-07-19 | Shift 1 | 50 |

### 2.2 Reduce to 50 — overlong papers (15 papers)

These are COMPLETE for audit purposes but exceed 50. Per the brief they are reduced to 50 using their own questions. General Test reductions preserve each paper's own section mix and take the earliest questions in each section in original order; the Mathematics paper takes the first 50 in paper order.

| Slug | Subject | Current Q | New set | Trimmed |
| --- | --- | --- | --- | --- |
| `cucet-2021-general-test` | General Test | 114 | cuet-general-test-pyq-set-1 | 63 |
| `general-test-2022-08-06` | General Test | 70 | cuet-general-test-pyq-set-2 | 17 |
| `general-test-2022-08-08-shift-1` | General Test | 61 | cuet-general-test-pyq-set-3 | 10 |
| `general-test-2022-08-18` | General Test | 66 | cuet-general-test-pyq-set-4 | 13 |
| `general-test-2022-08-22` | General Test | 62 | cuet-general-test-pyq-set-5 | 11 |
| `general-test-2022-08-23-shift-1` | General Test | 71 | cuet-general-test-pyq-set-6 | 21 |
| `general-test-2022-10-06-shift-1` | General Test | 69 | cuet-general-test-pyq-set-7 | 17 |
| `general-test-2023-05-21-shift-1` | General Test | 58 | cuet-general-test-pyq-set-8 | 6 |
| `general-test-2023-05-27-shift-1` | General Test | 58 | cuet-general-test-pyq-set-9 | 7 |
| `general-test-2023-06-05-shift-1` | General Test | 57 | cuet-general-test-pyq-set-10 | 6 |
| `general-test-2023-06-09-shift-2` | General Test | 60 | cuet-general-test-pyq-set-11 | 7 |
| `general-test-2023-06-10-shift-3` | General Test | 59 | cuet-general-test-pyq-set-12 | 7 |
| `general-test-2024-05-15-shift-3` | General Test | 53 | cuet-general-test-pyq-set-13 | 3 |
| `general-test-2024-05-29-shift-1` | General Test | 53 | cuet-general-test-pyq-set-14 | 1 |
| `mathematics-2026-05-20-shift-1` | Mathematics | 78 | cuet-mathematics-pyq-set-7 | 26 |

*Trimmed* counts valid dropped questions; it excludes the **24** questions across these papers that are quarantined. The 15 papers contain **989** questions: **750** are published in the reduced sets, **215** are valid but trimmed, and **24** are quarantined.

> **Policy note (resolved at this gate):** “leave COMPLETE papers untouched” was in tension with “reduce >50-question papers to 50”. The audit treats `COMPLETE` as a ≥50 label only; **only the 14 papers at exactly 50 are untouched**. The 15 overlong papers are reduced, and their old slugs 301-redirect to the reduced sets.

### 2.3 Rebuild — SHORT papers (216 papers)

All SHORT papers are archived after their questions are pooled. **204 of the 216 SHORT papers** map to at least one new set; the primary target is the set carrying the most of their questions. **12 SHORT papers carry zero questions into a set** (202 questions total): Legal Studies (38) and Sociology (49) cannot form a set at all, Biology 2025-05-20-shift-2 (42) is the newest Biology paper and falls in the unused tail after 15 sets, and nine small 2026 extracts (73 questions) also fall in the unused tail. Of those 202 questions, 192 are valid but unused and 10 are quarantined. These 12 papers are archived with no set replacement and redirect to their subject hub. The content-preservation trade-off is a gate decision in §14.

The full old→new mapping is in `PYQ_REBUILD_PLAN.json` (`short_papers[]`).

---

## 3. Source recovery assessment

### 3.1 Archived OCR corpus

- Location: `E:\AA Projects\New Full\CUET Mock-legacy-backup-2026-11-03\ocr-data-before-cleanup-2026-11-03`
- **247 files / 123 papers**, covering 2022–2025.
- **107 of 245 papers** match a raw OCR file by `source_file`; **82 of the 216 SHORT papers** have raw OCR.
- The 138 unmatched papers are dominated by the **108 2026 papers**, which are not in the legacy archive.

### 3.2 2026 source bundle

- Location: `C:\Users\rajpa\Documents\CUET_UG_2026_Papers`
- **216 PDFs / 215 OCR JSON / 216 Markdown files**.
- For the 108 2026 papers: **1,133 imported** vs **1,233 source-sequential** questions; **33 papers are explicitly memory-based**, and most are 6–10 question extracts.

### 3.3 OCR recovery result

Recovery was measured for all 82 matched SHORT papers:

| Metric | Result |
| --- | --- |
| Current questions in those papers | 3,733 |
| Kept after raw OCR recovery | 3,846 (**+113**) |
| Kept with verified keys | 3,672 |
| Papers reaching 50 raw questions | 10 |
| Papers reaching 50 **verified-key** questions | **0** |

The targeted near-50 candidates confirm the result:

| Paper | Current | Raw kept | Keyed kept | Reaches 50 keyed | Blocker |
| --- | --- | --- | --- | --- | --- |
| biology-2024-05-15-shift-1 | 49 | 50 | 49 | no | Q20 key missing; option-count defects at OCR Q37/Q46 |
| english-2025-05-20-shift-1 | 46 | 50 | 46 | no | Q10/Q31 solution-derived, Q32 no option mapping, Q40 blank |
| english-2025-05-20-shift-2 | 49 | 50 | 49 | no | Q39 key only in solution |
| geography-2024-05-17-shift-1 | 49 | 50 | 49 | no | Q7/Q8 keys solution-derived |
| geography-2025-05-20-shift-1 | 46 | 50 | 46 | no | Q2/Q3/Q30/Q37 solution-derived |
| hindi-2024-05-16-shift-2 | 48 | 50 | 48 | no | Q11/Q21/Q46 solution-derived; q49 answer key leaked into option |
| history-2024-05-18-shift-1 | 48 | 50 | 48 | no | Q13/Q32 solution-derived |
| history-2025-05-16-shift-1 | 45 | 50 | 45 | no | Q8/Q31/Q34/Q36/Q46 solution-derived |
| mathematics-2024-07-19-shift-1 | 47 | 50 | 47 | no | Q8/Q10/Q18 solution-derived |
| physics-2023-05-25-shift-3 | 49 | 50 | 49 | no | Q34 present in source MD but outside parser pattern; no printed key |
| chemistry-2026-06-06-shift-1 | 47 | 50 | 47 | no | 2026 bundle only; Q48–Q50 solution-derived/partial |

**Decision:** recovery is **not applied** to set building. The 11 candidates stay in the pool as ordinary SHORT papers. Their missing keys are solution-derived at best; treating them as verified would violate the “never guess an answer” rule.

---

## 4. Fragment and sibling analysis

- **Same subject + language + exam date + shift:** 1 group, but it is `computer-science-2022` + `computer-science-2025` — both null-date, different years. **Zero true same-shift fragments.**
- **Same subject + exam date, different shift:** 40 groups. These are distinct shifts, not fragments; merging them would mix two papers.
- **Near-identical titles:** 9 pairs, all distinct papers (different dates/shifts or different source files).
- **Null exam date:** 10 papers (2022 bundles and legacy papers). These sort by year only.

**Consequence:** Step 2 of the brief (merge sibling fragments first) yields **0 merged papers**. All 216 SHORT papers go to the pool.

---

## 5. Duplicates

### 5.1 Conservative exact duplicates

| Class | Groups | Extra rows |
| --- | --- | --- |
| Total | 54 | 61 |
| Within-paper | 2 | 2 |
| SHORT ↔ SHORT | 48 | 55 |
| SHORT ↔ COMPLETE | 4 | 4 |
| Answer conflict | 2 | 2 |
| Explanation conflict | 38 | 38 |

### 5.2 Near-duplicates (≥90% after normalisation)

**30 groups / 37 extra rows** (26 SHORT↔SHORT, 4 SHORT↔COMPLETE). Collapsed in favour of the oldest source; `also_appeared_in` records the other papers.

### 5.3 Cross-subject duplicates — Applied Mathematics / Mathematics

- `applied-mathematics-2025-06-02-shift-1` (45 Q) and `applied-mathematics-2025-06-03-shift-2` (46 Q) are near-complete copies of the corresponding Mathematics papers.
- **24 exact duplicate groups** exist across the two subjects.
- They are collapsed **in favour of Applied Mathematics**: the Applied Mathematics set owns those 24 questions, and the Mathematics pool does not repeat them. This is why Applied Mathematics can form one set while Mathematics forms seven pooled sets plus one reduced set.

### 5.4 Deliberately NOT deduplicated

**18 groups / 42 rows** are match-list, figure, table or “which figure completes the pattern” questions with generic stems (“Match List-I with List-II”) and **distinct visual assets**. Their stems look identical after punctuation stripping but their images/tables are different. Deduplicating them would delete valid questions.

### 5.5 Answer conflicts

Only two genuine stored-key conflicts (a third leak-versus-key conflict is counted in §6):

1. `general-test-2023-06-09-shift-2` — intra-paper figure duplicate, keyed **C** and **A**.
2. `geography-2025-05-16-shift-1` — `4. tertiary`, keyed **D** and **C**.

Both groups are quarantined, not resolved by guessing.

---

## 6. Data quality

| Issue | Count | Action |
| --- | --- | --- |
| Missing explanation | 2,123 corpus; 1,457 in published sets | Kept; explanation is optional in the runner, flagged for editorial |
| Missing topic tag | 7,527 | Kept with `topic_id = null`; no reliable classifier, so no inference |
| Unbalanced table HTML | 13 | Kept; renderer tolerates; flagged for editorial review |
| Blank option text **with image options** | 42 corpus; 37 in published sets | Valid — the printed options are images |
| Non-Latin text only (language check) | 4 | Expected for Hindi; not a defect |
| Odd display math | 2 | Flagged for editorial review |
| Fewer than 4 options | 1 (`mathematics-2026-05-29-shift-2/q09`) | Quarantined |
| Missing correct answer | 0 | — |
| Correct answer not in options | 0 | — |
| Answer key / solution pasted into option or stem | 174 | **Sanitised** deterministically; leaked key must equal `correct_option` |
| Answer conflicts (two stored keys, or leak contradicts key) | 3 | Quarantined, not resolved by guessing |
| Bare-label options (`1/2/3/4`) | 118 rows / 117 clusters | Quarantined; 63 of these still carry the option texts in the stem |
| Stem is an option fragment | 68 | Quarantined |
| Merged choice list | 42 | Quarantined |
| Duplicate key option | 41 | Quarantined |
| Oversized option block (>800 chars) | 18 | Quarantined |
| Merged option list (all choices inside option D) | 17 | Quarantined |
| Merged LaTeX option grid | 14 | Quarantined |
| Roman-numeral option fragments | 5 | Quarantined |
| Image options with no asset | 2 (`chemistry-2026-06-06-shift-1/q02/q49`) | Quarantined |
| Blank/placeholder options | 2 | Quarantined |
| All options identical | 1 | Quarantined |
| Merged number list | 1 | Quarantined |
| Duplicate **non-key** distractor | 21 | **Retained and flagged**; the correct option is unique, so the answer is still verifiable |
| Garbled Hindi OCR (`hindi-2022-08-30-shift-2`) | 50 | **Editorial flag**; exactly-50 paper, outside the rebuild, re-OCR recommended |
| **Quarantined clusters (union)** | **263** | Excluded from every new set |

Reasons overlap, so the quarantine rows do not sum to 263.

### 6.1 Quarantined clusters (263)

| Paper / question | Subject | Reason |
| --- | --- | --- |
| `general-test-2023-06-09-shift-2` / q31 | General Test | answer_conflict |
| `geography-2025-05-16-shift-1` / q49 | Geography | answer_conflict |
| `mathematics-2026-05-29-shift-2` / q09 | Mathematics | fewer_than_4_options |
| `general-test-2025-05-20-shift-2` / q04 | General Test | stem_is_option_text |
| `accountancy-2025-06-02-shift-2` / q24 | Accountancy | merged_option_list |
| `accountancy-2025-06-02-shift-2` / q28 | Accountancy | merged_option_list |
| `accountancy-2025-06-03-shift-2` / q03 | Accountancy | merged_option_list |
| `accountancy-2025-06-03-shift-2` / q33 | Accountancy | merged_option_list |
| `accountancy-2025-06-03-shift-2` / q35 | Accountancy | merged_option_list |
| `business-studies-2025-05-30-shift-1` / q16 | Business Studies | merged_option_list |
| `business-studies-2025-05-30-shift-1` / q21 | Business Studies | merged_option_list |
| `business-studies-2025-05-30-shift-1` / q23 | Business Studies | merged_option_list |
| `business-studies-2025-05-30-shift-2` / q06 | Business Studies | merged_option_list |
| `business-studies-2025-05-30-shift-2` / q24 | Business Studies | merged_option_list |
| `business-studies-2025-05-30-shift-2` / q29 | Business Studies | merged_option_list |
| `economics-2025-05-30-shift-1` / q09 | Economics | merged_option_list |
| `general-test-2023-05-21-shift-1` / q26 | General Test | blank_option_text |
| `mathematics-2022-08-30` / q05 | Mathematics | blank_option_text |
| `political-science-2025-06-27-shift-2` / q01 | Political Science | merged_option_list |
| `political-science-2025-06-27-shift-2` / q06 | Political Science | merged_option_list |
| `political-science-2025-06-27-shift-2` / q12 | Political Science | merged_option_list |
| `political-science-2025-06-27-shift-2` / q17 | Political Science | merged_option_list |
| `political-science-2025-06-27-shift-2` / q25 | Political Science | merged_option_list |
| `accountancy-2023-06-01-shift-1` / q02 | Accountancy | merged_choice_list |
| `accountancy-2023-06-01-shift-1` / q03 | Accountancy | merged_choice_list |
| `accountancy-2023-06-01-shift-1` / q08 | Accountancy | merged_choice_list |
| `accountancy-2023-06-01-shift-1` / q10 | Accountancy | merged_choice_list |
| `accountancy-2023-06-01-shift-1` / q13 | Accountancy | merged_choice_list |
| `accountancy-2023-06-01-shift-1` / q14 | Accountancy | merged_choice_list |
| `accountancy-2023-06-01-shift-1` / q22 | Accountancy | merged_choice_list |
| `accountancy-2023-06-01-shift-1` / q25 | Accountancy | merged_choice_list |
| `accountancy-2023-06-01-shift-1` / q28 | Accountancy | merged_choice_list |
| `accountancy-2023-06-05-shift-1` / q19 | Accountancy | merged_choice_list |
| `accountancy-2023-06-05-shift-1` / q21 | Accountancy | merged_choice_list |
| `accountancy-2023-06-05-shift-1` / q24 | Accountancy | merged_choice_list |
| `accountancy-2023-06-05-shift-1` / q31 | Accountancy | merged_choice_list |
| `accountancy-2023-06-07-shift-1` / q05 | Accountancy | merged_choice_list |
| `accountancy-2023-06-07-shift-1` / q09 | Accountancy | merged_choice_list |
| `accountancy-2023-06-07-shift-1` / q13 | Accountancy | merged_choice_list |
| `accountancy-2023-06-07-shift-1` / q15 | Accountancy | merged_choice_list |
| `accountancy-2023-06-07-shift-1` / q17 | Accountancy | merged_choice_list |
| `accountancy-2023-06-07-shift-1` / q18 | Accountancy | merged_choice_list |
| `accountancy-2023-06-07-shift-1` / q19 | Accountancy | merged_choice_list |
| `accountancy-2023-06-07-shift-1` / q20 | Accountancy | merged_choice_list |
| `accountancy-2023-06-07-shift-1` / q29 | Accountancy | merged_choice_list |
| `accountancy-2023-06-07-shift-1` / q32 | Accountancy | merged_choice_list |
| `accountancy-2023-06-07-shift-1` / q33 | Accountancy | merged_choice_list |
| `accountancy-2023-06-12-shift-3` / q28 | Accountancy | merged_choice_list |
| `applied-mathematics-2025-06-02-shift-1` / q04 | Applied Mathematics | label_only_options |
| `applied-mathematics-2025-06-02-shift-1` / q06 | Applied Mathematics | duplicate_key_option |
| `applied-mathematics-2025-06-02-shift-1` / q08 | Applied Mathematics | duplicate_key_option |
| `applied-mathematics-2025-06-02-shift-1` / q09 | Applied Mathematics | label_only_options |
| `applied-mathematics-2025-06-02-shift-1` / q10 | Applied Mathematics | duplicate_key_option |
| `applied-mathematics-2025-06-02-shift-1` / q18 | Applied Mathematics | label_only_options |
| `applied-mathematics-2025-06-02-shift-1` / q21 | Applied Mathematics | label_only_options |
| `applied-mathematics-2025-06-02-shift-1` / q41 | Applied Mathematics | label_only_options |
| `applied-mathematics-2025-06-02-shift-1` / q48 | Applied Mathematics | label_only_options |
| `applied-mathematics-2025-06-02-shift-1` / q50 | Applied Mathematics | label_only_options |
| `applied-mathematics-2025-06-03-shift-2` / q08 | Applied Mathematics | label_only_options |
| `applied-mathematics-2025-06-03-shift-2` / q18 | Applied Mathematics | label_only_options |
| `applied-mathematics-2025-06-03-shift-2` / q19 | Applied Mathematics | duplicate_key_option |
| `applied-mathematics-2025-06-03-shift-2` / q31 | Applied Mathematics | label_only_options |
| `applied-mathematics-2025-06-03-shift-2` / q43 | Applied Mathematics | label_only_options |
| `applied-mathematics-2025-06-03-shift-2` / q46 | Applied Mathematics | label_only_options |
| `biology-2022-08-18` / q44 | Biology | huge_option_text |
| `biology-2022-08-18` / q50 | Biology | huge_option_text |
| `biology-2022-08-20` / q45 | Biology | huge_option_text |
| `biology-2024-05-29-shift-1` / q38 | Biology | label_only_options |
| `biology-2025-05-20-shift-2` / q41 | Biology | label_only_options,stem_is_option_fragment |
| `biology-2025-05-20-shift-2` / q42 | Biology | stem_is_option_fragment |
| `biology-2025-05-20-shift-2` / q44 | Biology | label_only_options,stem_is_option_fragment |
| `biology-2025-05-20-shift-2` / q45 | Biology | label_only_options,stem_is_option_fragment |
| `biology-2025-05-20-shift-2` / q48 | Biology | stem_is_option_fragment |
| `biology-2025-05-20-shift-2` / q49 | Biology | label_only_options,stem_is_option_fragment |
| `biology-2025-05-20-shift-2` / q50 | Biology | label_only_options,stem_is_option_fragment |
| `business-studies-2022` / q13 | Business Studies | merged_choice_list |
| `business-studies-2022` / q17 | Business Studies | merged_choice_list |
| `business-studies-2023-06-10-shift-3` / q02 | Business Studies | merged_choice_list |
| `business-studies-2023-06-10-shift-3` / q24 | Business Studies | merged_choice_list |
| `business-studies-2023-06-10-shift-3` / q34 | Business Studies | merged_choice_list |
| `business-studies-2023-06-11-shift-3` / q02 | Business Studies | merged_choice_list |
| `business-studies-2023-06-11-shift-3` / q03 | Business Studies | merged_choice_list |
| `business-studies-2023-06-11-shift-3` / q04 | Business Studies | merged_choice_list |
| `business-studies-2023-06-11-shift-3` / q06 | Business Studies | merged_choice_list |
| `business-studies-2023-06-11-shift-3` / q10 | Business Studies | merged_choice_list |
| `business-studies-2023-06-11-shift-3` / q12 | Business Studies | merged_choice_list |
| `business-studies-2023-06-11-shift-3` / q17 | Business Studies | merged_choice_list |
| `business-studies-2023-06-11-shift-3` / q18 | Business Studies | merged_choice_list |
| `business-studies-2023-06-11-shift-3` / q22 | Business Studies | merged_choice_list |
| `business-studies-2023-06-11-shift-3` / q23 | Business Studies | merged_choice_list |
| `business-studies-2023-06-12-shift-2` / q21 | Business Studies | merged_choice_list |
| `chemistry-2022-08-18` / q26 | Chemistry | merged_latex_options |
| `chemistry-2022-08-18` / q45 | Chemistry | huge_option_text |
| `chemistry-2022-08-23` / q48 | Chemistry | duplicate_key_option |
| `chemistry-2023-06-02-shift-3` / q45 | Chemistry | huge_option_text |
| `chemistry-2023-06-07-shift-3` / q24 | Chemistry | roman_option_fragments |
| `chemistry-2023-06-07-shift-3` / q37 | Chemistry | roman_option_fragments |
| `chemistry-2023-06-11-shift-3` / q18 | Chemistry | label_only_options |
| `chemistry-2023-06-13-shift-3` / q15 | Chemistry | merged_latex_options |
| `chemistry-2024-05-15-shift-1` / q50 | Chemistry | merged_latex_options |
| `chemistry-2025-05-21-shift-2` / q30 | Chemistry | label_only_options |
| `chemistry-2025-05-21-shift-2` / q42 | Chemistry | label_only_options,stem_is_option_fragment |
| `chemistry-2025-05-21-shift-2` / q43 | Chemistry | label_only_options,stem_is_option_fragment |
| `chemistry-2025-05-21-shift-2` / q44 | Chemistry | label_only_options,stem_is_option_fragment |
| `chemistry-2025-05-21-shift-2` / q45 | Chemistry | label_only_options,stem_is_option_fragment |
| `chemistry-2025-05-21-shift-2` / q46 | Chemistry | label_only_options,stem_is_option_fragment |
| `chemistry-2025-05-21-shift-2` / q47 | Chemistry | label_only_options |
| `chemistry-2025-05-21-shift-2` / q48 | Chemistry | label_only_options,stem_is_option_fragment |
| `chemistry-2025-05-21-shift-2` / q49 | Chemistry | label_only_options,stem_is_option_fragment |
| `chemistry-2025-05-21-shift-2` / q50 | Chemistry | label_only_options,stem_is_option_fragment |
| `chemistry-2025-05-23-shift-2` / q05 | Chemistry | label_only_options |
| `chemistry-2026-06-06-shift-1` / q02 | Chemistry | image_options_no_asset |
| `chemistry-2026-06-06-shift-1` / q49 | Chemistry | image_options_no_asset |
| `computer-science-2022` / q15 | Computer Science | roman_option_fragments |
| `computer-science-2025` / q32 | Computer Science | merged_latex_options |
| `cucet-2021-general-test` / q88 | General Test | duplicate_key_option |
| `economics-2022` / q04 | Economics | merged_choice_list |
| `english-2022-08-06-shift-1` / q06 | English | huge_option_text |
| `english-2022-08-06-shift-1` / q12 | English | huge_option_text |
| `english-2022-08-06-shift-1` / q33 | English | all_options_identical,duplicate_key_option |
| `english-2022-08-10` / q48 | English | duplicate_key_option |
| `english-2022-08-18` / q47 | English | duplicate_key_option |
| `english-2022-08-18` / q50 | English | duplicate_key_option |
| `english-2022-08-22` / q47 | English | duplicate_key_option |
| `english-2023-06-15-shift-3` / q05 | English | merged_latex_options,roman_option_fragments |
| `english-2023-06-15-shift-3` / q35 | English | duplicate_key_option |
| `english-2025-05-20-shift-1` / q01 | English | label_only_options,stem_is_option_fragment |
| `english-2025-05-20-shift-1` / q02 | English | label_only_options,stem_is_option_fragment |
| `english-2025-05-20-shift-1` / q03 | English | label_only_options,stem_is_option_fragment |
| `english-2025-05-20-shift-1` / q05 | English | label_only_options,stem_is_option_fragment |
| `english-2025-05-20-shift-1` / q06 | English | label_only_options,stem_is_option_fragment |
| `english-2025-05-20-shift-1` / q07 | English | label_only_options,stem_is_option_fragment |
| `english-2025-05-20-shift-1` / q08 | English | label_only_options,stem_is_option_fragment |
| `english-2025-05-20-shift-1` / q09 | English | stem_is_option_fragment |
| `english-2025-05-20-shift-1` / q11 | English | label_only_options,stem_is_option_fragment |
| `english-2025-05-20-shift-1` / q12 | English | label_only_options,stem_is_option_fragment |
| `english-2025-05-20-shift-2` / q01 | English | label_only_options,stem_is_option_fragment |
| `english-2025-05-20-shift-2` / q02 | English | label_only_options,stem_is_option_fragment |
| `english-2025-05-20-shift-2` / q03 | English | label_only_options,stem_is_option_fragment |
| `english-2025-05-20-shift-2` / q04 | English | label_only_options |
| `english-2025-05-20-shift-2` / q05 | English | label_only_options,stem_is_option_fragment |
| `english-2025-05-20-shift-2` / q06 | English | label_only_options,stem_is_option_fragment |
| `english-2025-05-20-shift-2` / q07 | English | label_only_options,stem_is_option_fragment |
| `english-2025-05-20-shift-2` / q08 | English | label_only_options,stem_is_option_fragment |
| `english-2025-05-20-shift-2` / q09 | English | label_only_options,stem_is_option_fragment |
| `english-2025-05-20-shift-2` / q10 | English | label_only_options,stem_is_option_fragment |
| `english-2025-05-20-shift-2` / q11 | English | label_only_options,stem_is_option_fragment |
| `english-2025-05-20-shift-2` / q12 | English | label_only_options,stem_is_option_fragment |
| `english-2025-05-20-shift-2` / q46 | English | label_only_options |
| `english-2026-05-11-shift-1` / q15 | English | duplicate_key_option |
| `english-2026-05-18-shift-1` / q02 | English | duplicate_key_option |
| `english-2026-05-21-shift-2` / q05 | English | duplicate_key_option |
| `english-2026-05-22-shift-2` / q10 | English | duplicate_key_option |
| `english-2026-05-26-shift-2` / q07 | English | duplicate_key_option |
| `english-2026-05-30-shift-1` / q06 | English | duplicate_key_option |
| `english-2026-05-30-shift-2` / q06 | English | duplicate_key_option |
| `english-2026-06-07-shift-2` / q07 | English | label_only_options |
| `english-2026-06-07-shift-2` / q10 | English | duplicate_key_option |
| `general-test-2022-08-06` / q21 | General Test | duplicate_key_option |
| `general-test-2022-08-06` / q32 | General Test | duplicate_key_option,roman_option_fragments |
| `general-test-2022-08-06` / q50 | General Test | label_only_options |
| `general-test-2022-08-08-shift-1` / q23 | General Test | label_only_options |
| `general-test-2022-08-18` / q47 | General Test | duplicate_key_option |
| `general-test-2022-08-18` / q49 | General Test | label_only_options |
| `general-test-2022-08-18` / q50 | General Test | label_only_options |
| `general-test-2022-08-22` / q70 | General Test | merged_latex_options |
| `general-test-2022-10-06-shift-1` / q03 | General Test | duplicate_key_option |
| `general-test-2022-10-06-shift-1` / q47 | General Test | duplicate_key_option |
| `general-test-2023-05-21-shift-1` / q07 | General Test | duplicate_key_option |
| `general-test-2023-05-27-shift-1` / q07 | General Test | duplicate_key_option |
| `general-test-2023-06-05-shift-1` / q51 | General Test | label_only_options |
| `general-test-2023-06-09-shift-2` / q14 | General Test | label_only_options |
| `general-test-2023-06-10-shift-3` / q33 | General Test | label_only_options |
| `general-test-2023-06-10-shift-3` / q55 | General Test | label_only_options |
| `general-test-2024-05-29-shift-1` / q15 | General Test | duplicate_key_option |
| `general-test-2024-05-29-shift-1` / q28 | General Test | merged_latex_options |
| `general-test-2025-05-20-shift-1` / q36 | General Test | label_only_options |
| `general-test-2025-05-20-shift-2` / q11 | General Test | duplicate_key_option |
| `general-test-2025-05-20-shift-2` / q24 | General Test | duplicate_key_option,merged_latex_options |
| `geography-2022` / q07 | Geography | huge_option_text |
| `geography-2022` / q14 | Geography | huge_option_text |
| `geography-2025-05-20-shift-1` / q42 | Geography | label_only_options |
| `geography-2025-05-20-shift-1` / q43 | Geography | label_only_options,stem_is_option_fragment |
| `geography-2025-05-20-shift-1` / q45 | Geography | label_only_options,stem_is_option_fragment |
| `geography-2025-05-20-shift-1` / q46 | Geography | label_only_options,stem_is_option_fragment |
| `geography-2025-05-20-shift-1` / q47 | Geography | label_only_options,stem_is_option_fragment |
| `geography-2025-05-20-shift-1` / q48 | Geography | label_only_options,stem_is_option_fragment |
| `geography-2025-05-20-shift-1` / q49 | Geography | label_only_options,stem_is_option_fragment |
| `geography-2025-05-20-shift-1` / q50 | Geography | label_only_options |
| `geography-2026-05-15-shift-1` / q09 | Geography | label_only_options |
| `hindi-2025` / q49 | Hindi | answer_key_conflict |
| `history-2022-08-21-shift-2` / q49 | History | huge_option_text |
| `history-2025-05-16-shift-1` / q41 | History | label_only_options,stem_is_option_fragment |
| `history-2025-05-16-shift-1` / q42 | History | label_only_options,stem_is_option_fragment |
| `history-2025-05-16-shift-1` / q43 | History | label_only_options,stem_is_option_fragment |
| `history-2025-05-16-shift-1` / q44 | History | label_only_options,stem_is_option_fragment |
| `history-2025-05-16-shift-1` / q45 | History | label_only_options,stem_is_option_fragment |
| `history-2025-05-16-shift-1` / q47 | History | label_only_options,stem_is_option_fragment |
| `history-2025-05-16-shift-1` / q48 | History | label_only_options,stem_is_option_fragment |
| `history-2025-05-16-shift-1` / q49 | History | label_only_options,stem_is_option_fragment |
| `history-2025-05-16-shift-1` / q50 | History | label_only_options,stem_is_option_fragment |
| `history-2025-05-20-shift-1` / q41 | History | label_only_options,stem_is_option_fragment |
| `history-2025-05-20-shift-1` / q42 | History | label_only_options,stem_is_option_fragment |
| `history-2025-05-20-shift-1` / q43 | History | label_only_options,stem_is_option_fragment |
| `history-2025-05-20-shift-1` / q44 | History | label_only_options,stem_is_option_fragment |
| `history-2025-05-20-shift-1` / q46 | History | stem_is_option_fragment |
| `history-2025-05-20-shift-1` / q47 | History | label_only_options,stem_is_option_fragment |
| `history-2025-06-03-shift-2` / q39 | History | label_only_options |
| `history-2025-06-03-shift-2` / q41 | History | label_only_options,stem_is_option_fragment |
| `history-2025-06-03-shift-2` / q42 | History | label_only_options,stem_is_option_fragment |
| `history-2025-06-03-shift-2` / q43 | History | label_only_options,stem_is_option_fragment |
| `history-2025-06-03-shift-2` / q49 | History | label_only_options,stem_is_option_fragment |
| `history-2025-06-03-shift-2` / q50 | History | label_only_options,stem_is_option_fragment |
| `history-2025-06-21-shift-1` / q43 | History | label_only_options,stem_is_option_fragment |
| `history-2025-06-21-shift-1` / q45 | History | stem_is_option_fragment |
| `history-2025-06-21-shift-1` / q46 | History | label_only_options,stem_is_option_fragment |
| `history-2025-06-21-shift-1` / q47 | History | label_only_options,stem_is_option_fragment |
| `history-2025-06-21-shift-1` / q49 | History | label_only_options,stem_is_option_fragment |
| `history-2025-06-21-shift-1` / q50 | History | label_only_options,stem_is_option_fragment |
| `mathematics-2022-08-17` / q45 | Mathematics | merged_latex_options,huge_option_text |
| `mathematics-2022-08-17` / q50 | Mathematics | huge_option_text |
| `mathematics-2022-08-22` / q04 | Mathematics | label_only_options |
| `mathematics-2022-08-22` / q35 | Mathematics | duplicate_key_option |
| `mathematics-2022-08-22` / q45 | Mathematics | merged_number_list |
| `mathematics-2022-08-22` / q50 | Mathematics | duplicate_key_option |
| `mathematics-2022-08-30` / q02 | Mathematics | merged_latex_options |
| `mathematics-2024-07-19-shift-1` / q04 | Mathematics | duplicate_key_option |
| `mathematics-2024-07-19-shift-1` / q31 | Mathematics | duplicate_key_option |
| `mathematics-2025-06-02-shift-1` / q04 | Mathematics | label_only_options |
| `mathematics-2025-06-02-shift-1` / q08 | Mathematics | duplicate_key_option |
| `mathematics-2025-06-02-shift-1` / q23 | Mathematics | label_only_options |
| `mathematics-2025-06-02-shift-1` / q25 | Mathematics | label_only_options |
| `mathematics-2025-06-02-shift-1` / q31 | Mathematics | label_only_options |
| `mathematics-2025-06-02-shift-1` / q32 | Mathematics | label_only_options |
| `mathematics-2025-06-02-shift-1` / q43 | Mathematics | label_only_options |
| `mathematics-2025-06-02-shift-1` / q45 | Mathematics | label_only_options |
| `mathematics-2025-06-02-shift-1` / q50 | Mathematics | label_only_options |
| `mathematics-2025-06-03-shift-2` / q16 | Mathematics | label_only_options |
| `mathematics-2025-06-03-shift-2` / q20 | Mathematics | label_only_options |
| `mathematics-2025-06-03-shift-2` / q31 | Mathematics | label_only_options |
| `mathematics-2026-05-14-shift-2` / q01 | Mathematics | label_only_options |
| `mathematics-2026-05-15-shift-1` / q05 | Mathematics | label_only_options |
| `mathematics-2026-05-15-shift-1` / q10 | Mathematics | label_only_options |
| `mathematics-2026-05-19-shift-1` / q05 | Mathematics | label_only_options |
| `mathematics-2026-05-20-shift-1` / q72 | Mathematics | duplicate_key_option |
| `mathematics-2026-05-20-shift-1` / q84 | Mathematics | duplicate_key_option |
| `physics-2022-08-06` / q27 | Physics | merged_latex_options |
| `physics-2022-08-06` / q37 | Physics | merged_latex_options,huge_option_text |
| `physics-2022-08-06` / q50 | Physics | huge_option_text |
| `physics-2022-08-22` / q06 | Physics | duplicate_key_option |
| `physics-2022-08-22` / q12 | Physics | huge_option_text |
| `physics-2022-08-22` / q38 | Physics | huge_option_text |
| `physics-2022-08-26` / q12 | Physics | label_only_options |
| `physics-2022-08-26` / q18 | Physics | huge_option_text |
| `physics-2023-05-21-shift-3` / q09 | Physics | duplicate_key_option |
| `physics-2023-05-21-shift-3` / q10 | Physics | duplicate_key_option |
| `physics-2023-05-25-shift-3` / q09 | Physics | merged_latex_options,huge_option_text |
| `physics-2024-05-16-shift-3` / q18 | Physics | merged_latex_options |
| `physics-2025-05-20-shift-2` / q21 | Physics | label_only_options |
| `physics-2025-05-20-shift-2` / q31 | Physics | label_only_options |
| `physics-2025-05-20-shift-2` / q33 | Physics | label_only_options |
| `physics-2025-05-20-shift-2` / q47 | Physics | duplicate_key_option |
| `physics-2025-05-20-shift-2` / q50 | Physics | label_only_options |

Sanitisation examples: `english-2024-05-29-shift-1/q02` option D “non-vegetarian sources only **Answer: C**” becomes “non-vegetarian sources only”; `accountancy-2023-06-01-shift-1/q29` option D loses an appended next-passage block; `political-science-2025-06-27-shift-2/q26` loses a duplicated option list and “Answer: D”. `computer-science-2024-07-19-shift-1/q24` was the false-positive check: its options “Front 100. Rear 100” / “Front 77. Rear 100” are legitimate and are left unchanged. The full list is in `PYQ_REBUILD_PLAN.json#sanitisations`.

---

## 7. Passage and case-study groups

- **134 passage groups / 184 questions** across the corpus.
- Multi-question groups in SHORT papers: Business Studies (2, 2, 4, 5), Chemistry 2026-06-06 (5 + 3), Economics (2, 2, 2), English 2024-05-29 (6, 5, 6, 3), Hindi 2025 (4, 3, 4).
- The allocator treats every passage group as an **atomic unit**; a group is never split across sets. Validation reports **0 split passages**.
- Data defect found: `general-test-2025-05-20-shift-2/q04` stores an option string as its stem; the real prompt is in the passage. It is quarantined (`c05031`) but its three sibling questions keep the passage.

---

## 8. Attempts and leaderboards

- **24 attempts / 959 attempt answers** exist in total.
- Only **3 PYQ papers** have attempts:
  - `english-2022-08-06-shift-1` — 9 submitted
  - `english-2024-05-15-shift-2` — 6 submitted
  - `english-2026-06-06-shift-1` — 7 attempts (6 scored); this paper is COMPLETE
- All other attempts belong to non-PYQ mock 246.
- There is **no leaderboard table**; leaderboards are computed from submitted attempts.
- **Freeze policy:** existing attempts and computed leaderboards keep their original `mock_id` / `version_id`. Archived papers remain readable for result review; no attempt is deleted or repointed.

---

## 9. Mock layer

- **245 PYQ mock tests**: 106 have 50 questions, 124 are short, and 15 are overlong (51–114 questions).
- **92 SHORT practice papers already show a 50-question mock** built with **384 foreign top-up questions** from other papers. These are the most misleading pages today: the practice paper says 40–49 questions while its ranked mock says 50 with borrowed content.
- **124 SHORT practice papers** have short mocks — the clearest user-visible gap.
- 14 exactly-50 papers have correct 50-question mocks.
- The 15 overlong papers have mocks equal to their full length (51–114 questions), including the 78-question Mathematics paper.
- The rebuild replaces the top-up mechanism with clean, same-subject pooled sets.

---

## 10. Pool math and planning basis

### 10.1 Basis used

`all_short_sanitised_no_complete_overlap`:

1. All 216 SHORT papers.
2. Conservative exact + near dedupe, with generic-visual groups preserved.
3. Passage groups atomic.
4. Quarantine removed: **239** of the 263 quarantined clusters are in the SHORT pool; the other **24** are overlong-only.
5. **Four** SHORT clusters also appear in a COMPLETE paper and are excluded — those questions stay live in the untouched/reduced paper. Another **1,683 clusters** exist only in COMPLETE papers and are outside the pool.
6. Recovery **not** applied; the 11 near-50 papers are pooled.
7. Applied Mathematics owns the 24 cross-subject duplicates.

This yields **5,538 eligible questions → 103 pooled sets → 388 unused**.

### 10.2 Per-subject pool

| Subject | Lang | Eligible | Sets | Unused | Passage units | Multi-Q passages |
| --- | --- | --- | --- | --- | --- | --- |
| Accountancy | English | 417 | 8 | 17 | 0 | 0 |
| Applied Mathematics | English | 75 | 1 | 25 | 0 | 0 |
| Biology | English | 791 | 15 | 41 | 1 | 0 |
| Business Studies | English | 310 | 6 | 10 | 6 | 4 |
| Chemistry | English | 869 | 17 | 19 | 11 | 2 |
| Computer Science | English | 153 | 3 | 3 | 0 | 0 |
| Economics | English | 122 | 2 | 22 | 6 | 3 |
| English | English | 786 | 15 | 36 | 6 | 4 |
| General Test | English | 239 | 4 | 39 | — | — |
| Geography | English | 172 | 3 | 22 | 2 | 0 |
| Hindi | Hindi | 94 | 1 | 44 | 3 | 3 |
| History | English | 362 | 7 | 12 | 1 | 0 |
| Legal Studies | English | 38 | 0 | 38 | 0 | 0 |
| Mathematics | English | 353 | 7 | 3 | 0 | 0 |
| Physics | English | 603 | 12 | 3 | 0 | 0 |
| Political Science | English | 105 | 2 | 5 | 1 | 0 |
| Sociology | English | 49 | 0 | 49 | 0 | 0 |

### 10.3 Sensitivity — if the 11 recovery candidates were held out

Holding the 11 near-50 papers out of the pool would reduce the pooled set count and leave those papers SHORT, which defeats the brief. Because recovery cannot key them to 50, they are **included**. This is a confirmation item at the gate.

### 10.4 General Test section allocation

- Eligible GT pool after quarantine: **239**.
- The classifier assigned **GK 46, Current 12, Quant 125, Logical 59** before quarantine; three classified questions were quarantined, leaving **GK 46, Current 12, Quant 123, Logical 58**.
- Empirical mix in the 14 complete GT papers: GK 27%, Current 12%, Quant 42%, Logical 19%.
- NTA's 2025/2026 GAT syllabus lists GK, Current Affairs, General Mental Ability, Numerical Ability, Reasoning (quant/geometry/mensuration/statistics), Logical & Analytical Reasoning, and General Science/Environment Literacy, but **publishes no fixed sectional count**.
- Chosen quota per pooled set: **11 GK + 3 Current + 25 Quant + 11 Logical = 50**. Scarce sections are exhausted first; Quant absorbs the surplus. Result: **4 GT pooled sets**, with **39 GT questions unused** (2 GK, 23 Quant, 14 Logical). The **14 reduced GT sets** use each overlong paper's own section mix, not this quota.
- **Ordering:** pooled GT sets group GK → Current → Quant → Logical, each section oldest-first. This is the only deliberate exception to one global chronological sequence; all other sets are globally oldest-first, then original paper order.

| Set | GK | Current | Quant | Logical |
| --- | --- | --- | --- | --- |
| cuet-general-test-pyq-set-15 | 11 | 3 | 25 | 11 |
| cuet-general-test-pyq-set-16 | 11 | 3 | 25 | 11 |
| cuet-general-test-pyq-set-17 | 11 | 3 | 25 | 11 |
| cuet-general-test-pyq-set-18 | 11 | 3 | 25 | 11 |

---

## 11. Database and site-model gaps

| Area | Gap | Required by rebuild |
| --- | --- | --- |
| `practice_papers` | no `language` | Need per-paper language for filters and redirects |
| `practice_papers` | no `is_archived`, `replaced_by` | Need archive + redirect target |
| `practice_questions` | no `source_year`, `source_date`, `source_shift`, `source_paper_id` (only `source_question_no`) | Required source tag on every question |
| `questions` | only `year` | PYQ tag needs full date/shift |
| `slug_redirects` | table exists, empty | 301s for 216 archived slugs |
| leaderboards | no table; computed from attempts | Freeze by leaving attempts untouched |
| List page | `MIN_LISTED_QUESTIONS = 30` hides short papers | New sets are 50, so all become visible |
| Stats | `recoveredQuestionCount = paper.questions.length` | Must become the single 50-question source of truth |

---

## 12. Verification of the audit

- Source: isolated local D1 mirror; all reads used `readOnly`.
- Every count in this document is reproducible from the scripts in `scratch/` (`audit-summary.mjs`, `questions-audit.mjs`, `duplicates2.mjs`, `final-anomalies.mjs`, `build-plan.mjs`, `validate-plan.mjs`, `check-assets.mjs`, `ocr-recovery.py`).
- Plan validation: every set has exactly 50 questions; 5,900 unique clusters; 0 intra-set or cross-set duplicates; 0 missing source tags or answers; 0 split passages; 0 slug collisions; 0 missing local assets; 37 image-option questions resolve to existing files.
- No writes were made to D1, KV, exports or production.

---

## 13. Open editorial items (not blockers)

1. `hindi-2022-08-30-shift-2` — 50 questions with clear OCR corruption in stems and options. It is exactly 50 and therefore untouched by the rebuild; re-OCR is recommended as a separate task.
2. 13 unbalanced tables and 2 odd display-math questions need editorial review.
3. 2,123 missing explanations remain missing; **1,457 of the 5,900 published questions** have no explanation. The rebuild does not invent them.
4. `topic_id` will stay null; no inference is applied.
5. **301 published questions have no recorded exam date and 1,219 have no recorded shift.** Their source tags fall back to year only; no date or shift is guessed.
6. **21 questions have a duplicated non-key distractor.** The correct option is unique, so they remain answerable; they are retained and flagged for editorial cleanup rather than quarantined.
7. **192 valid questions from the 12 zero-target papers are not published** (they sit in the unused pool). This is a content-preservation gate decision.
8. `TURSO_AUTH_TOKEN` rotation remains outstanding from earlier work.

---

## 14. Decisions required at the approval gate

1. **>50 policy** — approve reducing the 15 overlong papers to 50-question sets (recommended, matches the brief) **or** keep them as-is (violates the “reduce to 50” requirement).
2. **Recovery candidates** — approve including the 11 near-50 papers in the pool (recommended; otherwise they stay SHORT and the set count falls).
3. **Applied Mathematics ownership** — approve the 24 cross-subject duplicates living in the Applied Mathematics set and not repeated in Mathematics (recommended).
4. **General Test quota** — approve 11/3/25/11 per pooled set with 39 GT leftovers (recommended, given the pool and the absence of official sectional weights).
5. **Sanitisation and quarantine** — approve deterministic repair of 174 questions and quarantine of 263 clusters, with no guessed answers (recommended).
6. **Zero-target papers** — approve archiving the 12 papers that carry no questions into a set. Legal Studies and Sociology cannot form a 50-question set; the other 10 fall in the unused tail. Their 192 valid unused questions will not be published unless a different allocation policy is chosen.
7. **Missing metadata** — approve publishing 301 questions without a date and 1,219 without a shift, using year-only source tags. No date or shift will be invented.
8. **Explanations** — approve publishing 1,457 questions without an explanation. No explanation will be generated or copied from an unverified source.

No writes occur until these are approved.

---

## Appendix A — Full inventory (245 papers)

| Slug | Subject | Lang | Year | Date | Shift | Q | Source Q | Missing | Status | Mock Q | Foreign top-up | Attempts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `accountancy-2022` | Accountancy | English | 2022 | — | — | 35 | 59 | 24 | SHORT | 35 | 0 | 0 |
| `accountancy-2023-06-01-shift-1` | Accountancy | English | 2023 | 2023-06-01 | Shift 1 | 39 | 49 | 10 | SHORT | 39 | 0 | 0 |
| `accountancy-2023-06-02-shift-1` | Accountancy | English | 2023 | 2023-06-02 | Shift 1 | 49 | 50 | 1 | SHORT | 50 | 1 | 0 |
| `accountancy-2023-06-05-shift-1` | Accountancy | English | 2023 | 2023-06-05 | Shift 1 | 42 | 50 | 8 | SHORT | 50 | 8 | 0 |
| `accountancy-2023-06-07-shift-1` | Accountancy | English | 2023 | 2023-06-07 | Shift 1 | 43 | 46 | 3 | SHORT | 50 | 7 | 0 |
| `accountancy-2023-06-10-shift-3` | Accountancy | English | 2023 | 2023-06-10 | Shift 3 | 30 | 50 | 20 | SHORT | 30 | 0 | 0 |
| `accountancy-2023-06-12-shift-3` | Accountancy | English | 2023 | 2023-06-12 | Shift 3 | 45 | 48 | 3 | SHORT | 50 | 5 | 0 |
| `accountancy-2024-05-17-shift-2` | Accountancy | English | 2024 | 2024-05-17 | Shift 2 | 48 | 49 | 1 | SHORT | 50 | 2 | 0 |
| `accountancy-2024-07-19-shift-1` | Accountancy | English | 2024 | 2024-07-19 | Shift 1 | 47 | 50 | 3 | SHORT | 50 | 3 | 0 |
| `accountancy-2025-06-02-shift-2` | Accountancy | English | 2025 | 2025-06-02 | Shift 2 | 34 | 50 | 16 | SHORT | 34 | 0 | 0 |
| `accountancy-2025-06-03-shift-2` | Accountancy | English | 2025 | 2025-06-03 | Shift 2 | 35 | 50 | 15 | SHORT | 35 | 0 | 0 |
| `applied-mathematics-2025-06-02-shift-1` | Applied Mathematics | English | 2025 | 2025-06-02 | Shift 1 | 45 | 50 | 5 | SHORT | 50 | 5 | 0 |
| `applied-mathematics-2025-06-03-shift-2` | Applied Mathematics | English | 2025 | 2025-06-03 | Shift 2 | 46 | 50 | 4 | SHORT | 50 | 4 | 0 |
| `biology-2022-08-18` | Biology | English | 2022 | 2022-08-18 | — | 47 | 50 | 3 | SHORT | 50 | 3 | 0 |
| `biology-2022-08-20` | Biology | English | 2022 | 2022-08-20 | — | 48 | 50 | 2 | SHORT | 50 | 2 | 0 |
| `biology-2022-08-23-shift-2` | Biology | English | 2022 | 2022-08-23 | Shift 2 | 49 | 50 | 1 | SHORT | 50 | 1 | 0 |
| `biology-2022-08-30` | Biology | English | 2022 | 2022-08-30 | — | 46 | 50 | 4 | SHORT | 50 | 4 | 0 |
| `biology-2023-05-22-shift-1` | Biology | English | 2023 | 2023-05-22 | Shift 1 | 48 | 50 | 2 | SHORT | 50 | 2 | 0 |
| `biology-2023-05-28-shift-1` | Biology | English | 2023 | 2023-05-28 | Shift 1 | 49 | 50 | 1 | SHORT | 50 | 1 | 0 |
| `biology-2023-05-30-shift-1` | Biology | English | 2023 | 2023-05-30 | Shift 1 | 45 | 50 | 5 | SHORT | 50 | 4 | 0 |
| `biology-2023-05-30-shift-2` | Biology | English | 2023 | 2023-05-30 | Shift 2 | 46 | 50 | 4 | SHORT | 50 | 4 | 0 |
| `biology-2023-05-31-shift-3` | Biology | English | 2023 | 2023-05-31 | Shift 3 | 47 | 50 | 3 | SHORT | 50 | 2 | 0 |
| `biology-2023-06-01-shift-3` | Biology | English | 2023 | 2023-06-01 | Shift 3 | 49 | 50 | 1 | SHORT | 50 | 1 | 0 |
| `biology-2023-06-05-shift-3` | Biology | English | 2023 | 2023-06-05 | Shift 3 | 48 | 50 | 2 | SHORT | 50 | 2 | 0 |
| `biology-2023-06-10-shift-1` | Biology | English | 2023 | 2023-06-10 | Shift 1 | 48 | 49 | 1 | SHORT | 50 | 2 | 0 |
| `biology-2023-06-10-shift-3` | Biology | English | 2023 | 2023-06-10 | Shift 3 | 48 | 50 | 2 | SHORT | 50 | 2 | 0 |
| `biology-2024-05-15-shift-1` | Biology | English | 2024 | 2024-05-15 | Shift 1 | 49 | 50 | 1 | SHORT | 50 | 1 | 0 |
| `biology-2024-05-29-shift-1` | Biology | English | 2024 | 2024-05-29 | Shift 1 | 45 | 50 | 5 | SHORT | 50 | 5 | 0 |
| `biology-2024-07-19` | Biology | English | 2024 | 2024-07-19 | — | 48 | 50 | 2 | SHORT | 50 | 2 | 0 |
| `biology-2025-05-20-shift-1` | Biology | English | 2025 | 2025-05-20 | Shift 1 | 50 | 50 | — | COMPLETE | 50 | 0 | 0 |
| `biology-2025-05-20-shift-2` | Biology | English | 2025 | 2025-05-20 | Shift 2 | 42 | 50 | 8 | SHORT | 50 | 7 | 0 |
| `business-studies-2022` | Business Studies | English | 2022 | — | — | 31 | 50 | 19 | SHORT | 31 | 0 | 0 |
| `business-studies-2023-06-10-shift-3` | Business Studies | English | 2023 | 2023-06-10 | Shift 3 | 46 | 48 | 2 | SHORT | 50 | 4 | 0 |
| `business-studies-2023-06-11-shift-3` | Business Studies | English | 2023 | 2023-06-11 | Shift 3 | 43 | 47 | 4 | SHORT | 50 | 7 | 0 |
| `business-studies-2023-06-12-shift-2` | Business Studies | English | 2023 | 2023-06-12 | Shift 2 | 44 | 48 | 4 | SHORT | 50 | 6 | 0 |
| `business-studies-2023-06-12-shift-3` | Business Studies | English | 2023 | 2023-06-12 | Shift 3 | 41 | 50 | 9 | SHORT | 50 | 9 | 0 |
| `business-studies-2024-05-17-shift-2` | Business Studies | English | 2024 | 2024-05-17 | Shift 2 | 48 | 49 | 1 | SHORT | 50 | 2 | 0 |
| `business-studies-2025-05-30-shift-1` | Business Studies | English | 2025 | 2025-05-30 | Shift 1 | 40 | 50 | 10 | SHORT | 50 | 10 | 0 |
| `business-studies-2025-05-30-shift-2` | Business Studies | English | 2025 | 2025-05-30 | Shift 2 | 39 | 50 | 11 | SHORT | 39 | 0 | 0 |
| `chemistry-2022-08-17` | Chemistry | English | 2022 | 2022-08-17 | — | 43 | 48 | 5 | SHORT | 50 | 7 | 0 |
| `chemistry-2022-08-18` | Chemistry | English | 2022 | 2022-08-18 | — | 42 | 50 | 8 | SHORT | 50 | 9 | 0 |
| `chemistry-2022-08-23` | Chemistry | English | 2022 | 2022-08-23 | — | 40 | 50 | 10 | SHORT | 39 | 0 | 0 |
| `chemistry-2023-06-02-shift-3` | Chemistry | English | 2023 | 2023-06-02 | Shift 3 | 46 | 50 | 4 | SHORT | 50 | 4 | 0 |
| `chemistry-2023-06-05-shift-1` | Chemistry | English | 2023 | 2023-06-05 | Shift 1 | 45 | 50 | 5 | SHORT | 50 | 4 | 0 |
| `chemistry-2023-06-07-shift-3` | Chemistry | English | 2023 | 2023-06-07 | Shift 3 | 40 | 50 | 10 | SHORT | 50 | 9 | 0 |
| `chemistry-2023-06-08-shift-3` | Chemistry | English | 2023 | 2023-06-08 | Shift 3 | 48 | 50 | 2 | SHORT | 50 | 2 | 0 |
| `chemistry-2023-06-10-shift-1` | Chemistry | English | 2023 | 2023-06-10 | Shift 1 | 43 | 50 | 7 | SHORT | 50 | 8 | 0 |
| `chemistry-2023-06-11-shift-3` | Chemistry | English | 2023 | 2023-06-11 | Shift 3 | 49 | 50 | 1 | SHORT | 50 | 1 | 0 |
| `chemistry-2023-06-13-shift-3` | Chemistry | English | 2023 | 2023-06-13 | Shift 3 | 42 | 50 | 8 | SHORT | 50 | 6 | 0 |
| `chemistry-2023-06-15-shift-1` | Chemistry | English | 2023 | 2023-06-15 | Shift 1 | 49 | 50 | 1 | SHORT | 50 | 2 | 0 |
| `chemistry-2024-05-15-shift-1` | Chemistry | English | 2024 | 2024-05-15 | Shift 1 | 46 | 50 | 4 | SHORT | 50 | 4 | 0 |
| `chemistry-2024-05-29` | Chemistry | English | 2024 | 2024-05-29 | — | 48 | 50 | 2 | SHORT | 50 | 2 | 0 |
| `chemistry-2024-07-19` | Chemistry | English | 2024 | 2024-07-19 | — | 45 | 50 | 5 | SHORT | 50 | 5 | 0 |
| `chemistry-2025-05-21-shift-2` | Chemistry | English | 2025 | 2025-05-21 | Shift 2 | 43 | 50 | 7 | SHORT | 50 | 7 | 0 |
| `chemistry-2025-05-23-shift-2` | Chemistry | English | 2025 | 2025-05-23 | Shift 2 | 47 | 50 | 3 | SHORT | 50 | 4 | 0 |
| `chemistry-2026-05-11-shift-1` | Chemistry | English | 2026 | 2026-05-11 | Shift 1 | 6 | 50 | 44 | SHORT | 6 | 0 | 0 |
| `chemistry-2026-05-12-shift-2` | Chemistry | English | 2026 | 2026-05-12 | Shift 2 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `chemistry-2026-05-15-shift-1` | Chemistry | English | 2026 | 2026-05-15 | Shift 1 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `chemistry-2026-05-18-shift-1` | Chemistry | English | 2026 | 2026-05-18 | Shift 1 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `chemistry-2026-05-18-shift-2` | Chemistry | English | 2026 | 2026-05-18 | Shift 2 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `chemistry-2026-05-19-shift-1` | Chemistry | English | 2026 | 2026-05-19 | Shift 1 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `chemistry-2026-05-21-shift-1` | Chemistry | English | 2026 | 2026-05-21 | Shift 1 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `chemistry-2026-05-22-shift-1` | Chemistry | English | 2026 | 2026-05-22 | Shift 1 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `chemistry-2026-05-22-shift-2` | Chemistry | English | 2026 | 2026-05-22 | Shift 2 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `chemistry-2026-05-26-shift-1` | Chemistry | English | 2026 | 2026-05-26 | Shift 1 | 8 | 50 | 42 | SHORT | 8 | 0 | 0 |
| `chemistry-2026-05-29-shift-2` | Chemistry | English | 2026 | 2026-05-29 | Shift 2 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `chemistry-2026-05-30-shift-1` | Chemistry | English | 2026 | 2026-05-30 | Shift 1 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `chemistry-2026-05-30-shift-2` | Chemistry | English | 2026 | 2026-05-30 | Shift 2 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `chemistry-2026-05-31-shift-2` | Chemistry | English | 2026 | 2026-05-31 | Shift 2 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `chemistry-2026-06-06-shift-1` | Chemistry | English | 2026 | 2026-06-06 | Shift 1 | 47 | 50 | 3 | SHORT | 50 | 3 | 0 |
| `computer-science-2022` | Computer Science | English | 2022 | — | — | 39 | 50 | 11 | SHORT | 39 | 0 | 0 |
| `computer-science-2024-07-19-shift-1` | Computer Science | English | 2024 | 2024-07-19 | Shift 1 | 45 | 50 | 5 | SHORT | 50 | 5 | 0 |
| `computer-science-2025` | Computer Science | English | 2025 | — | — | 45 | 50 | 5 | SHORT | 50 | 6 | 0 |
| `computer-science-2026-05-11-shift-2` | Computer Science | English | 2026 | 2026-05-11 | Shift 2 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `computer-science-2026-05-21-shift-1` | Computer Science | English | 2026 | 2026-05-21 | Shift 1 | 8 | 50 | 42 | SHORT | 8 | 0 | 0 |
| `computer-science-2026-05-31-shift-1` | Computer Science | English | 2026 | 2026-05-31 | Shift 1 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `economics-2022` | Economics | English | 2022 | — | — | 29 | 48 | 19 | SHORT | 29 | 0 | 0 |
| `economics-2024-05-16-shift-1` | Economics | English | 2024 | 2024-05-16 | Shift 1 | 48 | 50 | 2 | SHORT | 50 | 2 | 0 |
| `economics-2025-05-30-shift-1` | Economics | English | 2025 | 2025-05-30 | Shift 1 | 21 | 50 | 29 | SHORT | 21 | 0 | 0 |
| `economics-2025-05-30-shift-2` | Economics | English | 2025 | 2025-05-30 | Shift 2 | 26 | 50 | 24 | SHORT | 26 | 0 | 0 |
| `english-2022-08-06-shift-1` | English | English | 2022 | 2022-08-06 | Shift 1 | 48 | 49 | 1 | SHORT | 50 | 2 | 9 |
| `english-2022-08-10` | English | English | 2022 | 2022-08-10 | — | 48 | 50 | 2 | SHORT | 50 | 2 | 0 |
| `english-2022-08-16-shift-1` | English | English | 2022 | 2022-08-16 | Shift 1 | 50 | 50 | — | COMPLETE | 50 | 0 | 0 |
| `english-2022-08-18` | English | English | 2022 | 2022-08-18 | — | 47 | 50 | 3 | SHORT | 50 | 3 | 0 |
| `english-2022-08-22` | English | English | 2022 | 2022-08-22 | — | 46 | 50 | 4 | SHORT | 50 | 4 | 0 |
| `english-2023-05-21-shift-1` | English | English | 2023 | 2023-05-21 | Shift 1 | 50 | 50 | — | COMPLETE | 50 | 0 | 0 |
| `english-2023-06-02-shift-3` | English | English | 2023 | 2023-06-02 | Shift 3 | 50 | 50 | — | COMPLETE | 50 | 0 | 0 |
| `english-2023-06-05-shift-3` | English | English | 2023 | 2023-06-05 | Shift 3 | 50 | 50 | — | COMPLETE | 50 | 0 | 0 |
| `english-2023-06-06-shift-2` | English | English | 2023 | 2023-06-06 | Shift 2 | 50 | 50 | — | COMPLETE | 50 | 0 | 0 |
| `english-2023-06-09-shift-2` | English | English | 2023 | 2023-06-09 | Shift 2 | 47 | 50 | 3 | SHORT | 50 | 3 | 0 |
| `english-2023-06-10-shift-2` | English | English | 2023 | 2023-06-10 | Shift 2 | 49 | 50 | 1 | SHORT | 50 | 1 | 0 |
| `english-2023-06-11-shift-1` | English | English | 2023 | 2023-06-11 | Shift 1 | 49 | 50 | 1 | SHORT | 50 | 1 | 0 |
| `english-2023-06-13-shift-3` | English | English | 2023 | 2023-06-13 | Shift 3 | 50 | 50 | — | COMPLETE | 50 | 0 | 0 |
| `english-2023-06-15-shift-3` | English | English | 2023 | 2023-06-15 | Shift 3 | 49 | 50 | 1 | SHORT | 50 | 1 | 0 |
| `english-2024-05-15-shift-2` | English | English | 2024 | 2024-05-15 | Shift 2 | 33 | 50 | 17 | SHORT | 33 | 0 | 6 |
| `english-2024-05-29-shift-1` | English | English | 2024 | 2024-05-29 | Shift 1 | 47 | 50 | 3 | SHORT | 50 | 3 | 0 |
| `english-2025-05-20-shift-1` | English | English | 2025 | 2025-05-20 | Shift 1 | 46 | 50 | 4 | SHORT | 50 | 4 | 0 |
| `english-2025-05-20-shift-2` | English | English | 2025 | 2025-05-20 | Shift 2 | 49 | 50 | 1 | SHORT | 50 | 1 | 0 |
| `english-2026-05-11-shift-1` | English | English | 2026 | 2026-05-11 | Shift 1 | 43 | 50 | 7 | SHORT | 50 | 7 | 0 |
| `english-2026-05-11-shift-2` | English | English | 2026 | 2026-05-11 | Shift 2 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `english-2026-05-12-shift-1` | English | English | 2026 | 2026-05-12 | Shift 1 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `english-2026-05-12-shift-2` | English | English | 2026 | 2026-05-12 | Shift 2 | 8 | 50 | 42 | SHORT | 8 | 0 | 0 |
| `english-2026-05-13-shift-1` | English | English | 2026 | 2026-05-13 | Shift 1 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `english-2026-05-13-shift-2` | English | English | 2026 | 2026-05-13 | Shift 2 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `english-2026-05-14-shift-1` | English | English | 2026 | 2026-05-14 | Shift 1 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `english-2026-05-14-shift-2` | English | English | 2026 | 2026-05-14 | Shift 2 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `english-2026-05-15-shift-1` | English | English | 2026 | 2026-05-15 | Shift 1 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `english-2026-05-18-shift-1` | English | English | 2026 | 2026-05-18 | Shift 1 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `english-2026-05-18-shift-2` | English | English | 2026 | 2026-05-18 | Shift 2 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `english-2026-05-19-shift-1` | English | English | 2026 | 2026-05-19 | Shift 1 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `english-2026-05-20-shift-1` | English | English | 2026 | 2026-05-20 | Shift 1 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `english-2026-05-21-shift-1` | English | English | 2026 | 2026-05-21 | Shift 1 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `english-2026-05-21-shift-2` | English | English | 2026 | 2026-05-21 | Shift 2 | 6 | 50 | 44 | SHORT | 6 | 0 | 0 |
| `english-2026-05-22-shift-2` | English | English | 2026 | 2026-05-22 | Shift 2 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `english-2026-05-23-shift-2` | English | English | 2026 | 2026-05-23 | Shift 2 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `english-2026-05-24-shift-1` | English | English | 2026 | 2026-05-24 | Shift 1 | 8 | 50 | 42 | SHORT | 8 | 0 | 0 |
| `english-2026-05-25-shift-1` | English | English | 2026 | 2026-05-25 | Shift 1 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `english-2026-05-26-shift-1` | English | English | 2026 | 2026-05-26 | Shift 1 | 13 | 50 | 37 | SHORT | 13 | 0 | 0 |
| `english-2026-05-26-shift-2` | English | English | 2026 | 2026-05-26 | Shift 2 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `english-2026-05-27-shift-1` | English | English | 2026 | 2026-05-27 | Shift 1 | 6 | 50 | 44 | SHORT | 6 | 0 | 0 |
| `english-2026-05-29-shift-2` | English | English | 2026 | 2026-05-29 | Shift 2 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `english-2026-05-30-shift-1` | English | English | 2026 | 2026-05-30 | Shift 1 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `english-2026-05-30-shift-2` | English | English | 2026 | 2026-05-30 | Shift 2 | 6 | 50 | 44 | SHORT | 6 | 0 | 0 |
| `english-2026-05-31-shift-1` | English | English | 2026 | 2026-05-31 | Shift 1 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `english-2026-05-31-shift-2` | English | English | 2026 | 2026-05-31 | Shift 2 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `english-2026-06-06-shift-1` | English | English | 2026 | 2026-06-06 | Shift 1 | 50 | 50 | — | COMPLETE | 50 | 0 | 7 |
| `english-2026-06-06-shift-2` | English | English | 2026 | 2026-06-06 | Shift 2 | 5 | 50 | 45 | SHORT | 5 | 0 | 0 |
| `english-2026-06-07-shift-2` | English | English | 2026 | 2026-06-07 | Shift 2 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `cucet-2021-general-test` | General Test | English | 2021 | 2021-09-23 | Shift 1 | 114 | 125 | 11 | COMPLETE | 113 | 0 | 0 |
| `general-test-2022-08-06` | General Test | English | 2022 | 2022-08-06 | — | 70 | 75 | 5 | COMPLETE | 69 | 0 | 0 |
| `general-test-2022-08-08-shift-1` | General Test | English | 2022 | 2022-08-08 | Shift 1 | 61 | 75 | 14 | COMPLETE | 61 | 0 | 0 |
| `general-test-2022-08-18` | General Test | English | 2022 | 2022-08-18 | — | 66 | 75 | 9 | COMPLETE | 65 | 0 | 0 |
| `general-test-2022-08-22` | General Test | English | 2022 | 2022-08-22 | — | 62 | 70 | 8 | COMPLETE | 61 | 0 | 0 |
| `general-test-2022-08-23-shift-1` | General Test | English | 2022 | 2022-08-23 | Shift 1 | 71 | 75 | 4 | COMPLETE | 70 | 0 | 0 |
| `general-test-2022-10-06-shift-1` | General Test | English | 2022 | 2022-10-06 | Shift 1 | 69 | 75 | 6 | COMPLETE | 66 | 0 | 0 |
| `general-test-2023-05-21-shift-1` | General Test | English | 2023 | 2023-05-21 | Shift 1 | 58 | 60 | 2 | COMPLETE | 57 | 0 | 0 |
| `general-test-2023-05-27-shift-1` | General Test | English | 2023 | 2023-05-27 | Shift 1 | 58 | 60 | 2 | COMPLETE | 54 | 0 | 0 |
| `general-test-2023-06-05-shift-1` | General Test | English | 2023 | 2023-06-05 | Shift 1 | 57 | 60 | 3 | COMPLETE | 57 | 0 | 0 |
| `general-test-2023-06-09-shift-2` | General Test | English | 2023 | 2023-06-09 | Shift 2 | 60 | 60 | — | COMPLETE | 57 | 0 | 0 |
| `general-test-2023-06-10-shift-3` | General Test | English | 2023 | 2023-06-10 | Shift 3 | 59 | 60 | 1 | COMPLETE | 58 | 0 | 0 |
| `general-test-2024-05-15-shift-3` | General Test | English | 2024 | 2024-05-15 | Shift 3 | 53 | 60 | 7 | COMPLETE | 51 | 0 | 0 |
| `general-test-2024-05-29-shift-1` | General Test | English | 2024 | 2024-05-29 | Shift 1 | 53 | 60 | 7 | COMPLETE | 52 | 0 | 0 |
| `general-test-2025-05-20-shift-1` | General Test | English | 2025 | 2025-05-20 | Shift 1 | 49 | 50 | 1 | SHORT | 50 | 6 | 0 |
| `general-test-2025-05-20-shift-2` | General Test | English | 2025 | 2025-05-20 | Shift 2 | 44 | 50 | 6 | SHORT | 50 | 9 | 0 |
| `general-test-2026-05-12-shift-1` | General Test | English | 2026 | 2026-05-12 | Shift 1 | 10 | 60 | 50 | SHORT | 10 | 0 | 0 |
| `general-test-2026-05-14-shift-1` | General Test | English | 2026 | 2026-05-14 | Shift 1 | 8 | 60 | 52 | SHORT | 8 | 0 | 0 |
| `general-test-2026-05-14-shift-2` | General Test | English | 2026 | 2026-05-14 | Shift 2 | 10 | 60 | 50 | SHORT | 10 | 0 | 0 |
| `general-test-2026-05-18-shift-1` | General Test | English | 2026 | 2026-05-18 | Shift 1 | 9 | 60 | 51 | SHORT | 9 | 0 | 0 |
| `general-test-2026-05-18-shift-2` | General Test | English | 2026 | 2026-05-18 | Shift 2 | 7 | 60 | 53 | SHORT | 7 | 0 | 0 |
| `general-test-2026-05-19-shift-1` | General Test | English | 2026 | 2026-05-19 | Shift 1 | 9 | 60 | 51 | SHORT | 9 | 0 | 0 |
| `general-test-2026-05-19-shift-2` | General Test | English | 2026 | 2026-05-19 | Shift 2 | 10 | 60 | 50 | SHORT | 10 | 0 | 0 |
| `general-test-2026-05-20-shift-1` | General Test | English | 2026 | 2026-05-20 | Shift 1 | 7 | 60 | 53 | SHORT | 7 | 0 | 0 |
| `general-test-2026-05-21-shift-1` | General Test | English | 2026 | 2026-05-21 | Shift 1 | 9 | 60 | 51 | SHORT | 9 | 0 | 0 |
| `general-test-2026-05-21-shift-2` | General Test | English | 2026 | 2026-05-21 | Shift 2 | 9 | 60 | 51 | SHORT | 9 | 0 | 0 |
| `general-test-2026-05-22-shift-1` | General Test | English | 2026 | 2026-05-22 | Shift 1 | 7 | 60 | 53 | SHORT | 7 | 0 | 0 |
| `general-test-2026-05-22-shift-2` | General Test | English | 2026 | 2026-05-22 | Shift 2 | 10 | 60 | 50 | SHORT | 10 | 0 | 0 |
| `general-test-2026-05-26-shift-1` | General Test | English | 2026 | 2026-05-26 | Shift 1 | 3 | 60 | 57 | SHORT | 3 | 0 | 0 |
| `general-test-2026-05-29-shift-1` | General Test | English | 2026 | 2026-05-29 | Shift 1 | 8 | 60 | 52 | SHORT | 8 | 0 | 0 |
| `general-test-2026-05-29-shift-2` | General Test | English | 2026 | 2026-05-29 | Shift 2 | 8 | 60 | 52 | SHORT | 8 | 0 | 0 |
| `general-test-2026-05-30-shift-1` | General Test | English | 2026 | 2026-05-30 | Shift 1 | 2 | 60 | 58 | SHORT | 2 | 0 | 0 |
| `general-test-2026-05-30-shift-2` | General Test | English | 2026 | 2026-05-30 | Shift 2 | 4 | 60 | 56 | SHORT | 4 | 0 | 0 |
| `general-test-2026-05-31-shift-1` | General Test | English | 2026 | 2026-05-31 | Shift 1 | 10 | 60 | 50 | SHORT | 10 | 0 | 0 |
| `general-test-2026-05-31-shift-2` | General Test | English | 2026 | 2026-05-31 | Shift 2 | 10 | 60 | 50 | SHORT | 10 | 0 | 0 |
| `general-test-2026-06-06-shift-1` | General Test | English | 2026 | 2026-06-06 | Shift 1 | 4 | 60 | 56 | SHORT | 4 | 0 | 0 |
| `geography-2022` | Geography | English | 2022 | — | — | 45 | 50 | 5 | SHORT | 50 | 5 | 0 |
| `geography-2024-05-17-shift-1` | Geography | English | 2024 | 2024-05-17 | Shift 1 | 49 | 50 | 1 | SHORT | 50 | 1 | 0 |
| `geography-2025-05-16-shift-1` | Geography | English | 2025 | 2025-05-16 | Shift 1 | 50 | 50 | — | COMPLETE | 50 | 0 | 0 |
| `geography-2025-05-20-shift-1` | Geography | English | 2025 | 2025-05-20 | Shift 1 | 46 | 50 | 4 | SHORT | 50 | 4 | 0 |
| `geography-2026-05-11-shift-1` | Geography | English | 2026 | 2026-05-11 | Shift 1 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `geography-2026-05-13-shift-1` | Geography | English | 2026 | 2026-05-13 | Shift 1 | 8 | 50 | 42 | SHORT | 8 | 0 | 0 |
| `geography-2026-05-14-shift-1` | Geography | English | 2026 | 2026-05-14 | Shift 1 | 7 | 50 | 43 | SHORT | 7 | 0 | 0 |
| `geography-2026-05-15-shift-1` | Geography | English | 2026 | 2026-05-15 | Shift 1 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `geography-2026-05-21-shift-1` | Geography | English | 2026 | 2026-05-21 | Shift 1 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `hindi-2022-08-30-shift-2` | Hindi | Hindi | 2022 | 2022-08-30 | Shift 2 | 50 | 50 | — | COMPLETE | 50 | 0 | 0 |
| `hindi-2024-05-16-shift-2` | Hindi | Hindi | 2024 | 2024-05-16 | Shift 2 | 48 | 50 | 2 | SHORT | 50 | 2 | 0 |
| `hindi-2025` | Hindi | Hindi | 2025 | — | — | 47 | 49 | 2 | SHORT | 50 | 3 | 0 |
| `history-2022` | History | English | 2022 | — | — | 36 | 50 | 14 | SHORT | 36 | 0 | 0 |
| `history-2022-08-21-shift-1` | History | English | 2022 | 2022-08-21 | Shift 1 | 40 | 40 | — | SHORT | 50 | 10 | 0 |
| `history-2022-08-21-shift-2` | History | English | 2022 | 2022-08-21 | Shift 2 | 46 | 49 | 3 | SHORT | 50 | 4 | 0 |
| `history-2024-05-18-shift-1` | History | English | 2024 | 2024-05-18 | Shift 1 | 48 | 50 | 2 | SHORT | 50 | 2 | 0 |
| `history-2025-05-16-shift-1` | History | English | 2025 | 2025-05-16 | Shift 1 | 45 | 50 | 5 | SHORT | 50 | 5 | 0 |
| `history-2025-05-20-shift-1` | History | English | 2025 | 2025-05-20 | Shift 1 | 45 | 50 | 5 | SHORT | 50 | 5 | 0 |
| `history-2025-06-03-shift-2` | History | English | 2025 | 2025-06-03 | Shift 2 | 42 | 50 | 8 | SHORT | 50 | 8 | 0 |
| `history-2025-06-21-shift-1` | History | English | 2025 | 2025-06-21 | Shift 1 | 44 | 50 | 6 | SHORT | 50 | 6 | 0 |
| `history-2026-05-11-shift-1` | History | English | 2026 | 2026-05-11 | Shift 1 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `history-2026-05-11-shift-2` | History | English | 2026 | 2026-05-11 | Shift 2 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `history-2026-05-13-shift-1` | History | English | 2026 | 2026-05-13 | Shift 1 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `history-2026-05-21-shift-1` | History | English | 2026 | 2026-05-21 | Shift 1 | 5 | 50 | 45 | SHORT | 5 | 0 | 0 |
| `history-2026-05-29-shift-2` | History | English | 2026 | 2026-05-29 | Shift 2 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `legal-studies-2022` | Legal Studies | English | 2022 | — | — | 38 | 48 | 10 | SHORT | 38 | 0 | 0 |
| `mathematics-2022-08-17` | Mathematics | English | 2022 | 2022-08-17 | — | 45 | 50 | 5 | SHORT | 50 | 5 | 0 |
| `mathematics-2022-08-22` | Mathematics | English | 2022 | 2022-08-22 | — | 42 | 50 | 8 | SHORT | 50 | 8 | 0 |
| `mathematics-2022-08-30` | Mathematics | English | 2022 | 2022-08-30 | — | 40 | 50 | 10 | SHORT | 50 | 10 | 0 |
| `mathematics-2024-05-16-shift-1` | Mathematics | English | 2024 | 2024-05-16 | Shift 1 | 50 | 50 | — | COMPLETE | 50 | 1 | 0 |
| `mathematics-2024-07-19-shift-1` | Mathematics | English | 2024 | 2024-07-19 | Shift 1 | 47 | 50 | 3 | SHORT | 50 | 3 | 0 |
| `mathematics-2025-06-02-shift-1` | Mathematics | English | 2025 | 2025-06-02 | Shift 1 | 48 | 50 | 2 | SHORT | 50 | 2 | 0 |
| `mathematics-2025-06-03-shift-2` | Mathematics | English | 2025 | 2025-06-03 | Shift 2 | 46 | 50 | 4 | SHORT | 50 | 4 | 0 |
| `mathematics-2026-05-14-shift-2` | Mathematics | English | 2026 | 2026-05-14 | Shift 2 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `mathematics-2026-05-15-shift-1` | Mathematics | English | 2026 | 2026-05-15 | Shift 1 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `mathematics-2026-05-18-shift-1` | Mathematics | English | 2026 | 2026-05-18 | Shift 1 | 8 | 50 | 42 | SHORT | 8 | 0 | 0 |
| `mathematics-2026-05-18-shift-2` | Mathematics | English | 2026 | 2026-05-18 | Shift 2 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `mathematics-2026-05-19-shift-1` | Mathematics | English | 2026 | 2026-05-19 | Shift 1 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `mathematics-2026-05-20-shift-1` | Mathematics | English | 2026 | 2026-05-20 | Shift 1 | 78 | 85 | 7 | COMPLETE | 78 | 0 | 0 |
| `mathematics-2026-05-21-shift-1` | Mathematics | English | 2026 | 2026-05-21 | Shift 1 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `mathematics-2026-05-21-shift-2` | Mathematics | English | 2026 | 2026-05-21 | Shift 2 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `mathematics-2026-05-22-shift-1` | Mathematics | English | 2026 | 2026-05-22 | Shift 1 | 8 | 50 | 42 | SHORT | 8 | 0 | 0 |
| `mathematics-2026-05-22-shift-2` | Mathematics | English | 2026 | 2026-05-22 | Shift 2 | 8 | 50 | 42 | SHORT | 8 | 0 | 0 |
| `mathematics-2026-05-26-shift-2` | Mathematics | English | 2026 | 2026-05-26 | Shift 2 | 8 | 50 | 42 | SHORT | 8 | 0 | 0 |
| `mathematics-2026-05-29-shift-1` | Mathematics | English | 2026 | 2026-05-29 | Shift 1 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `mathematics-2026-05-29-shift-2` | Mathematics | English | 2026 | 2026-05-29 | Shift 2 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `mathematics-2026-05-30-shift-1` | Mathematics | English | 2026 | 2026-05-30 | Shift 1 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `mathematics-2026-05-30-shift-2` | Mathematics | English | 2026 | 2026-05-30 | Shift 2 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `mathematics-2026-05-31-shift-2` | Mathematics | English | 2026 | 2026-05-31 | Shift 2 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `physics-2022-08-06` | Physics | English | 2022 | 2022-08-06 | — | 40 | 50 | 10 | SHORT | 39 | 0 | 0 |
| `physics-2022-08-22` | Physics | English | 2022 | 2022-08-22 | — | 47 | 50 | 3 | SHORT | 50 | 5 | 0 |
| `physics-2022-08-26` | Physics | English | 2022 | 2022-08-26 | — | 38 | 50 | 12 | SHORT | 38 | 0 | 0 |
| `physics-2023-05-21-shift-3` | Physics | English | 2023 | 2023-05-21 | Shift 3 | 48 | 50 | 2 | SHORT | 50 | 3 | 0 |
| `physics-2023-05-22-shift-3` | Physics | English | 2023 | 2023-05-22 | Shift 3 | 45 | 50 | 5 | SHORT | 50 | 6 | 0 |
| `physics-2023-05-25-shift-3` | Physics | English | 2023 | 2023-05-25 | Shift 3 | 49 | 50 | 1 | SHORT | 50 | 0 | 0 |
| `physics-2023-05-30-shift-1` | Physics | English | 2023 | 2023-05-30 | Shift 1 | 45 | 50 | 5 | SHORT | 50 | 5 | 0 |
| `physics-2023-06-09-shift-3` | Physics | English | 2023 | 2023-06-09 | Shift 3 | 48 | 50 | 2 | SHORT | 50 | 2 | 0 |
| `physics-2024-05-16-shift-3` | Physics | English | 2024 | 2024-05-16 | Shift 3 | 44 | 50 | 6 | SHORT | 50 | 7 | 0 |
| `physics-2024-07-19-shift-1` | Physics | English | 2024 | 2024-07-19 | Shift 1 | 43 | 50 | 7 | SHORT | 50 | 7 | 0 |
| `physics-2025-05-20-shift-2` | Physics | English | 2025 | 2025-05-20 | Shift 2 | 48 | 50 | 2 | SHORT | 50 | 2 | 0 |
| `physics-2025-05-21-shift-2` | Physics | English | 2025 | 2025-05-21 | Shift 2 | 50 | 50 | — | COMPLETE | 50 | 0 | 0 |
| `physics-2026-05-12-shift-2` | Physics | English | 2026 | 2026-05-12 | Shift 2 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `physics-2026-05-14-shift-2` | Physics | English | 2026 | 2026-05-14 | Shift 2 | 8 | 50 | 42 | SHORT | 8 | 0 | 0 |
| `physics-2026-05-15-shift-1` | Physics | English | 2026 | 2026-05-15 | Shift 1 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `physics-2026-05-18-shift-1` | Physics | English | 2026 | 2026-05-18 | Shift 1 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `physics-2026-05-18-shift-2` | Physics | English | 2026 | 2026-05-18 | Shift 2 | 7 | 50 | 43 | SHORT | 7 | 0 | 0 |
| `physics-2026-05-19-shift-1` | Physics | English | 2026 | 2026-05-19 | Shift 1 | 9 | 50 | 41 | SHORT | 9 | 0 | 0 |
| `physics-2026-05-22-shift-1` | Physics | English | 2026 | 2026-05-22 | Shift 1 | 8 | 50 | 42 | SHORT | 8 | 0 | 0 |
| `physics-2026-05-22-shift-2` | Physics | English | 2026 | 2026-05-22 | Shift 2 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `physics-2026-05-25-shift-1` | Physics | English | 2026 | 2026-05-25 | Shift 1 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `physics-2026-05-29-shift-1` | Physics | English | 2026 | 2026-05-29 | Shift 1 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `physics-2026-05-29-shift-2` | Physics | English | 2026 | 2026-05-29 | Shift 2 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `physics-2026-05-30-shift-1` | Physics | English | 2026 | 2026-05-30 | Shift 1 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `physics-2026-05-31-shift-2` | Physics | English | 2026 | 2026-05-31 | Shift 2 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `physics-2026-06-06-shift-1` | Physics | English | 2026 | 2026-06-06 | Shift 1 | 10 | 50 | 40 | SHORT | 10 | 0 | 0 |
| `political-science-2022` | Political Science | English | 2022 | — | — | 46 | 49 | 3 | SHORT | 50 | 4 | 0 |
| `political-science-2024-05-18-shift-2` | Political Science | English | 2024 | 2024-05-18 | Shift 2 | 50 | 50 | — | COMPLETE | 50 | 0 | 0 |
| `political-science-2025-06-20-shift-1` | Political Science | English | 2025 | 2025-06-20 | Shift 1 | 35 | 49 | 14 | SHORT | 35 | 0 | 0 |
| `political-science-2025-06-27-shift-2` | Political Science | English | 2025 | 2025-06-27 | Shift 2 | 29 | 50 | 21 | SHORT | 29 | 0 | 0 |
| `psychology-2024-07-19-shift-1` | Psychology | English | 2024 | 2024-07-19 | Shift 1 | 50 | 50 | — | COMPLETE | 50 | 0 | 0 |
| `sociology-2024-05-18-shift-3` | Sociology | English | 2024 | 2024-05-18 | Shift 3 | 49 | 50 | 1 | SHORT | 49 | 0 | 0 |

## Appendix B — Reconciliation

### B.1 SHORT pool

| Stage | Rows |
| --- | --- |
| Raw practice questions | 7,527 |
| Collapsed exact/near duplicate rows | −63 |
| Distinct question clusters | 7,464 |
| Clusters that exist only in COMPLETE papers (outside the pool) | −1,683 |
| SHORT-pool clusters | 5,781 |
| Quarantined clusters in the SHORT pool | −239 |
| SHORT clusters also present in a COMPLETE paper | −4 |
| **Eligible SHORT pool** | **5,538** |
| Published in 103 pooled sets | 5,150 |
| Unused pool (retained, not published) | 388 |

The SHORT pool reconciles exactly: **5,538 = 5,150 published + 388 unused**.

### B.2 COMPLETE papers

| Stage | Rows |
| --- | --- |
| Exactly-50 papers | 14 papers / 700 questions |
| Overlong papers | 15 papers / 989 questions |
| Published in 15 reduced sets | 750 |
| Trimmed from overlong papers (retained in archive) | 215 |
| Overlong-only quarantined clusters | 24 |
| **Overlong total** | **989** |

The overlong total reconciles exactly: **989 = 750 + 215 + 24**. Cross-paper duplicates are represented once in the cluster list and are recorded per question in `also_appeared_in`.

---

*Generated from the read-only audit dataset. Do not apply without the written approval in §14.*
