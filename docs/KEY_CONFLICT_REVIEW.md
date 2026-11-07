# Answer-Key Conflict Review

Editorial review record for answer-key disagreements discovered while removing the pre-existing public answer-key leak from `public/local-papers/papers/*.json` (base commit `a16cbaa`, 2026-11-06).

## Why this file exists

The public paper JSON for 18 pre-existing papers carried `correctAnswer` values in the client-served files. The runtime normaliser (`src/lib/practice-normalize.ts`) preferred that public inline value over the server-side `src/data/local-papers/keys.json` entry. All inline values were therefore migrated into `keys.json` and removed from the public files, so scoring behaviour is unchanged.

Six of those inline values disagreed with the previous `keys.json` value. Because the inline value was the one actually used for scoring until now, it was written into `keys.json` and the displaced value is recorded below. The six questions also carried the review flag `key_conflict_review`; see the verification record below — all six were verified on 2026-11-06 and the flags were removed (keys unchanged).

## Snapshot

| Measure | Before | After |
| :--- | ---: | ---: |
| Public questions with non-null `correctAnswer` | 56 | 0 |
| Public questions with non-null `explanationEn` | 0 | 0 |
| Questions keyed in `keys.json` | 7511 | 7527 |
| Orphan `keys.json` entries | 1 | 0 |

Migrated inline-only keys into `keys.json`: **17** · already-equal keys confirmed: **33** · conflicts recorded: **6** · inline fields nulled: **56**.

## Conflicts requiring editorial verification

> **Editorial verification complete (2026-11-06).** All six conflicts were resolved and in every case the value already stored in `keys.json` (the migrated inline value) is correct. No key was changed; the `key_conflict_review` flag was removed from the five paper JSONs. Verification basis per conflict:

| # | Paper slug | Question | Verified key | Verification basis |
| ---: | :--- | :--- | :---: | :--- |
| 1 | `chemistry-2026-06-06-shift-1` | `q31` | **D** | Friedel–Crafts acylation of chlorobenzene with CH₃COCl/anhyd. AlCl₃. Chlorine is deactivating but ortho/para-directing; para dominates sterically → p-chloroacetophenone (option D image). Old `C` was the ortho minor product. |
| 2 | `chemistry-2026-06-06-shift-1` | `q50` | **C** | Aniline → benzenediazonium chloride (nitrous acid, 273 K); cold azo coupling with N,N-dimethylaniline occurs at its para position → p-(dimethylamino)azobenzene (option C image). Old `B` was the hydrazo (reduced) structure. |
| 3 | `general-test-2026-05-30-shift-1` | `q15` | **D** | Computed: cone volume = ⅓π·9²·15 = 405π; cylinder h = 45 ⇒ r² = 9 ⇒ diameter 6 cm (option D). Old `B` (5 cm) is arithmetically wrong. |
| 4 | `geography-2026-05-14-shift-1` | `q04` | **D** | Census 2011 census-town criteria: minimum population 5,000, ≥75% male working population in non-agricultural pursuits, density ≥400 persons/km² — all three listed criteria are correct (option D "1, 2, and 3"). |
| 5 | `geography-2026-05-21-shift-1` | `q04` | **D** | All four statements are the NCERT Class 12 *India People and Economy* human-settlements definitions (clustered in fertile alluvial plains/NE states; semi-clustered from segregation or fragmentation; hamleted called panna, para, palli, nagla, dhani; dispersed as isolated huts in remote jungles or hills) → option D. |
| 6 | `history-2026-05-29-shift-2` | `q04` | **B** | Dyarchy in the provinces was introduced by the Government of India Act, 1919 (Montagu–Chelmsford reforms). The 1909 Act (Morley–Minto) introduced separate electorates, not dyarchy. Old `A` was factually wrong. |

### Original conflict record (before verification)

| # | Paper slug | Question | Old `keys.json` | Public inline (now in `keys.json`) | Stem excerpt |
| ---: | :--- | :--- | :---: | :---: | :--- |
| 1 | `chemistry-2026-06-06-shift-1` | `q31` | C | D | What would be the major product A? |
| 2 | `chemistry-2026-06-06-shift-1` | `q50` | B | C | What would be the structure of final product X in the following chemical reaction? |
| 3 | `general-test-2026-05-30-shift-1` | `q15` | B | D | A cone of radius 9 cm and height 15 cm is melted and made into a cylinder of height 45 cm. The diameter of the cylinder is: |
| 4 | `geography-2026-05-14-shift-1` | `q04` | C | D | Match the Census definition of Urban Areas in India (2011): 1. Minimum Population: 5,000 2. Non-Agri workers: 75% 3. Density: 400 persons/sq km Which of the above are correct criteria? |
| 5 | `geography-2026-05-21-shift-1` | `q04` | B | D | Consider the following statements regarding Human Settlements in India: 1. Clustered settlements are distinctively found in the fertile alluvial plains and the northeastern states. 2. Semi-clustered s… |
| 6 | `history-2026-05-29-shift-2` | `q04` | A | B | Which among the following Acts introduced the system of Dyarchy in the provinces? |

### Option text for the two candidate answers

1. `chemistry-2026-06-06-shift-1` `q31`: old `C` = (no option text) · inline `D` = (no option text)
2. `chemistry-2026-06-06-shift-1` `q50`: old `B` = (no option text) · inline `C` = (no option text)
3. `general-test-2026-05-30-shift-1` `q15`: old `B` = $ 5 \, cm $ · inline `D` = 6 cm
4. `geography-2026-05-14-shift-1` `q04`: old `C` = 1 and 3 · inline `D` = 1, 2, and 3
5. `geography-2026-05-21-shift-1` `q04`: old `B` = 2 and 3 only · inline `D` = 1, 2, 3 and 4
6. `history-2026-05-29-shift-2` `q04`: old `A` = Government of India Act, 1909 · inline `B` = Government of India Act, 1919

## Other pre-existing defects fixed alongside

- Removed orphan `keys.json` entry `general-test-2026-05-20-shift-1` / `q03` (answer B; question does not exist in the paper JSON).
- Corrected stale internal `exam.questionCount` in `history-2026-05-29-shift-2.json` from 7 to 10 (matches the 10 questions and the `index.json` row).

## Regression test and reproduction

- Enforcement: `tests/unit/answer-key-boundary.test.ts` (runs in the normal `vitest run` suite).
- Verification after remediation (all pass against this repository state):

```bash
npx vitest run tests/unit/answer-key-boundary.test.ts
```

A local leak scan can be reproduced with any JSON reader: for every file under
`public/local-papers/papers/`, assert `exam.questions[*].correctAnswer` and
`exam.questions[*].explanationEn` are `null`, and assert every question id has exactly one
`a`-valued entry in `src/data/local-papers/keys.json`.
