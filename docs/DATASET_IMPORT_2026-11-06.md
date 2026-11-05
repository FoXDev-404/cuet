# CUET question-paper dataset import — 2026-11-06

Source: PaddleOCR-VL 1.6 `CUET_JSON_OUTPUT` bundle (180 papers, 8,366 extracted questions).

## Policy

- Only questions with a printed answer that exists among the printed options are imported
  into the playable library; unkeyed questions stay in the OCR bundle for editorial review.
- Structurally broken OCR rows (missing/unresolved options, unreadable text, markdown
  mismatch, visual question with no usable asset) are rejected.
- Explanations are **not** imported by default: the bundle's explanations are
  model-generated prose and spot checks found cross-question contamination. The answer
  key is printed source data; the explanation is an editorial task. Pass
  `--with-explanations` only after a reviewer has cleared a batch.
- At least 2 scorable questions are required for a paper to become a mock.
- Existing library papers are never overwritten; overlapping slugs keep the curated copy.
- Public paper JSON never contains `correctAnswer` or `explanation`; keys stay in
  `src/data/local-papers/keys.json` and D1.
- Only question-linked, non-decorative image assets are copied.

## Result

| Metric | Count |
| --- | ---: |
| Questions in OCR bundle | 8366 |
| Papers scanned | 180 |
| Papers added | 31 |
| Papers skipped (quality) | 44 |
| Existing paper overlaps kept | 105 |
| Questions considered (new papers) | 3366 |
| Scorable questions added | 1236 |
| Unkeyed questions excluded | 2004 |
| Invalid / non-playable questions excluded | 92 |
| Duplicate questions excluded | 33 |
| Explanations imported | 0 |
| Image assets copied | 6 |
| Image asset bytes | 1.3 MB |
| Assets deduplicated against library | 0 |

## Papers added

| Subject | Slug | Year | Scorable Q | Image Q | Assets | Minutes |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Accountancy | [accountancy-2022](/mock-tests/accountancy-2022) | 2022 | 35 | 0 | 0 | 42 |
| Accountancy | [accountancy-2023-06-01-shift-1](/mock-tests/accountancy-2023-06-01-shift-1) | 2023 | 39 | 0 | 0 | 47 |
| Accountancy | [accountancy-2023-06-02-shift-1](/mock-tests/accountancy-2023-06-02-shift-1) | 2023 | 49 | 0 | 0 | 59 |
| Accountancy | [accountancy-2023-06-05-shift-1](/mock-tests/accountancy-2023-06-05-shift-1) | 2023 | 42 | 0 | 0 | 50 |
| Accountancy | [accountancy-2023-06-07-shift-1](/mock-tests/accountancy-2023-06-07-shift-1) | 2023 | 43 | 0 | 0 | 52 |
| Accountancy | [accountancy-2023-06-10-shift-3](/mock-tests/accountancy-2023-06-10-shift-3) | 2023 | 30 | 0 | 0 | 36 |
| Accountancy | [accountancy-2023-06-12-shift-3](/mock-tests/accountancy-2023-06-12-shift-3) | 2023 | 45 | 0 | 0 | 54 |
| Accountancy | [accountancy-2024-05-17-shift-2](/mock-tests/accountancy-2024-05-17-shift-2) | 2024 | 48 | 0 | 0 | 58 |
| Accountancy | [accountancy-2024-07-19-shift-1](/mock-tests/accountancy-2024-07-19-shift-1) | 2024 | 47 | 0 | 0 | 56 |
| Accountancy | [accountancy-2025-06-02-shift-2](/mock-tests/accountancy-2025-06-02-shift-2) | 2025 | 34 | 0 | 0 | 41 |
| Accountancy | [accountancy-2025-06-03-shift-2](/mock-tests/accountancy-2025-06-03-shift-2) | 2025 | 35 | 0 | 0 | 42 |
| Business Studies | [business-studies-2022](/mock-tests/business-studies-2022) | 2022 | 31 | 3 | 3 | 37 |
| Business Studies | [business-studies-2023-06-10-shift-3](/mock-tests/business-studies-2023-06-10-shift-3) | 2023 | 46 | 0 | 0 | 55 |
| Business Studies | [business-studies-2023-06-11-shift-3](/mock-tests/business-studies-2023-06-11-shift-3) | 2023 | 43 | 0 | 0 | 52 |
| Business Studies | [business-studies-2023-06-12-shift-2](/mock-tests/business-studies-2023-06-12-shift-2) | 2023 | 44 | 0 | 0 | 53 |
| Business Studies | [business-studies-2023-06-12-shift-3](/mock-tests/business-studies-2023-06-12-shift-3) | 2023 | 41 | 0 | 0 | 49 |
| Business Studies | [business-studies-2024-05-17-shift-2](/mock-tests/business-studies-2024-05-17-shift-2) | 2024 | 48 | 0 | 0 | 58 |
| Business Studies | [business-studies-2025-05-30-shift-1](/mock-tests/business-studies-2025-05-30-shift-1) | 2025 | 40 | 0 | 0 | 48 |
| Business Studies | [business-studies-2025-05-30-shift-2](/mock-tests/business-studies-2025-05-30-shift-2) | 2025 | 39 | 0 | 0 | 47 |
| Economics | [economics-2022](/mock-tests/economics-2022) | 2022 | 29 | 0 | 0 | 35 |
| Economics | [economics-2024-05-16-shift-1](/mock-tests/economics-2024-05-16-shift-1) | 2024 | 48 | 1 | 1 | 58 |
| Economics | [economics-2025-05-30-shift-1](/mock-tests/economics-2025-05-30-shift-1) | 2025 | 21 | 0 | 0 | 25 |
| Economics | [economics-2025-05-30-shift-2](/mock-tests/economics-2025-05-30-shift-2) | 2025 | 26 | 0 | 0 | 31 |
| History | [history-2022](/mock-tests/history-2022) | 2022 | 36 | 0 | 0 | 43 |
| Legal Studies | [legal-studies-2022](/mock-tests/legal-studies-2022) | 2022 | 38 | 0 | 0 | 46 |
| Political Science | [political-science-2022](/mock-tests/political-science-2022) | 2022 | 46 | 0 | 0 | 55 |
| Political Science | [political-science-2024-05-18-shift-2](/mock-tests/political-science-2024-05-18-shift-2) | 2024 | 50 | 0 | 0 | 60 |
| Political Science | [political-science-2025-06-20-shift-1](/mock-tests/political-science-2025-06-20-shift-1) | 2025 | 35 | 1 | 2 | 42 |
| Political Science | [political-science-2025-06-27-shift-2](/mock-tests/political-science-2025-06-27-shift-2) | 2025 | 29 | 0 | 0 | 35 |
| Psychology | [psychology-2024-07-19-shift-1](/mock-tests/psychology-2024-07-19-shift-1) | 2024 | 50 | 0 | 0 | 60 |
| Sociology | [sociology-2024-05-18-shift-3](/mock-tests/sociology-2024-05-18-shift-3) | 2024 | 49 | 0 | 0 | 59 |

## Papers skipped

| Subject | Slug | Extracted Q | Printed answers | Reason |
| --- | --- | ---: | ---: | --- |
| Accountancy | accountancy-2023-06-16-shift-3 | 49 | 0 | no printed answers |
| Accountancy | accountancy-2023-06-20-shift-2 | 50 | 0 | no printed answers |
| Accountancy | accountancy-2025 | 5 | 0 | no printed answers |
| Agriculture | agriculture-2022 | 50 | 0 | no printed answers |
| Agriculture | agriculture-2023-05-26 | 50 | 0 | no printed answers |
| Agriculture | agriculture-2024-07-19 | 50 | 0 | no printed answers |
| Agriculture | agriculture-2025 | 50 | 0 | no printed answers |
| Anthropology | anthropology-2025 | 49 | 0 | no printed answers |
| Biology | biology-2025 | 87 | 0 | no printed answers |
| Business Studies | business-studies-2022-10-06-shift-1 | 0 | 0 | no printed answers |
| Business Studies | business-studies-2023-06-16-shift-3 | 49 | 0 | no printed answers |
| Business Studies | business-studies-2025 | 1 | 0 | no printed answers |
| CUCET | cucet-2021-09-23-shift-1 | 117 | 0 | no printed answers |
| CUCET | cucet-2021-09-23-shift-2 | 78 | 0 | no printed answers |
| Chemistry | chemistry-2025 | 91 | 0 | no printed answers |
| Economics | economics-2024-05-16-shift-1a | 51 | 0 | no printed answers |
| Economics | economics-2025 | 4 | 4 | fewer than 2 scorable questions |
| Engineering Graphics | engineering-graphics-2022-09-11-shift-1 | 0 | 0 | no printed answers |
| English | english-2022-09-16-shift-1 | 0 | 0 | no printed answers |
| English | english-2025 | 88 | 0 | no printed answers |
| Entrepreneurship | entrepreneurship-2022-08-30-shift-1 | 0 | 0 | no printed answers |
| Environmental Science | environmental-science-2025 | 4 | 1 | no question passed validation |
| Fine Arts | fine-arts-2025 | 49 | 0 | no printed answers |
| General Test | general-test-2024-05-15-shift-2 | 0 | 0 | no printed answers |
| General Test | general-test-2025 | 91 | 0 | no printed answers |
| Geography | geography-2024-05-17-shift-1a | 21 | 0 | no printed answers |
| Geography | geography-2025 | 47 | 0 | no printed answers |
| Hindi | hindi-2024-05-16-shift-1 | 0 | 0 | no printed answers |
| History | history-2024-05-18-shift-1a | 31 | 0 | no printed answers |
| History | history-2025 | 62 | 0 | no printed answers |
| Home Science | home-science-2025 | 87 | 0 | no printed answers |
| Knowledge Tradition & Practices India | knowledge-tradition-and-practices-india-2025 | 50 | 0 | no printed answers |
| Legal Studies | legal-studies-2022-09-11-shift-1 | 0 | 0 | no printed answers |
| Mass Media | mass-media-2025 | 50 | 0 | no printed answers |
| Mathematics | mathematics-2024-05-16-shift-2 | 49 | 0 | no printed answers |
| Mathematics | mathematics-2025 | 96 | 0 | no printed answers |
| Performing Arts | performing-arts-2025 | 139 | 0 | no printed answers |
| Physical Education | physical-education-2024-05-17-shift-1 | 0 | 0 | no printed answers |
| Physics | physics-2024-05-16-shift-2 | 49 | 0 | no printed answers |
| Physics | physics-2025 | 45 | 0 | no printed answers |
| Political Science & Sociology | political-science-and-sociology-2022-08-25-shift-2 | 4 | 0 | no printed answers |
| Political Science | political-science-2024-05-18-shift-1 | 32 | 0 | no printed answers |
| Political Science | political-science-2025 | 4 | 0 | no printed answers |
| Sociology | sociology-2022-08-25-shift-1 | 0 | 0 | no printed answers |

## Overlaps already in the curated library

- `applied-mathematics-2025-06-02-shift-1` (37 printed answers in this bundle vs 45 scorable in the library)
- `applied-mathematics-2025-06-03-shift-2` (39 printed answers in this bundle vs 46 scorable in the library)
- `biology-2022-08-18` (49 printed answers in this bundle vs 47 scorable in the library)
- `biology-2022-08-20` (49 printed answers in this bundle vs 48 scorable in the library)
- `biology-2022-08-23-shift-2` (0 printed answers in this bundle vs 49 scorable in the library)
- `biology-2022-08-30` (1 printed answers in this bundle vs 46 scorable in the library)
- `biology-2023-05-22-shift-1` (49 printed answers in this bundle vs 48 scorable in the library)
- `biology-2023-05-28-shift-1` (0 printed answers in this bundle vs 49 scorable in the library)
- `biology-2023-05-30-shift-1` (47 printed answers in this bundle vs 45 scorable in the library)
- `biology-2023-05-30-shift-2` (47 printed answers in this bundle vs 46 scorable in the library)
- `biology-2023-05-31-shift-3` (0 printed answers in this bundle vs 47 scorable in the library)
- `biology-2023-06-01-shift-3` (47 printed answers in this bundle vs 49 scorable in the library)
- `biology-2023-06-05-shift-3` (0 printed answers in this bundle vs 48 scorable in the library)
- `biology-2023-06-10-shift-1` (38 printed answers in this bundle vs 48 scorable in the library)
- `biology-2023-06-10-shift-3` (48 printed answers in this bundle vs 48 scorable in the library)
- `biology-2024-05-15-shift-1` (46 printed answers in this bundle vs 49 scorable in the library)
- `biology-2024-05-29-shift-1` (44 printed answers in this bundle vs 45 scorable in the library)
- `biology-2024-07-19` (49 printed answers in this bundle vs 48 scorable in the library)
- `biology-2025-05-20-shift-1` (42 printed answers in this bundle vs 50 scorable in the library)
- `biology-2025-05-20-shift-2` (46 printed answers in this bundle vs 42 scorable in the library)
- `chemistry-2022-08-17` (47 printed answers in this bundle vs 43 scorable in the library)
- `chemistry-2022-08-18` (43 printed answers in this bundle vs 42 scorable in the library)
- `chemistry-2022-08-23` (46 printed answers in this bundle vs 40 scorable in the library)
- `chemistry-2023-06-02-shift-3` (47 printed answers in this bundle vs 46 scorable in the library)
- `chemistry-2023-06-05-shift-1` (49 printed answers in this bundle vs 45 scorable in the library)
- `chemistry-2023-06-07-shift-3` (0 printed answers in this bundle vs 40 scorable in the library)
- `chemistry-2023-06-08-shift-3` (0 printed answers in this bundle vs 48 scorable in the library)
- `chemistry-2023-06-10-shift-1` (0 printed answers in this bundle vs 43 scorable in the library)
- `chemistry-2023-06-11-shift-3` (47 printed answers in this bundle vs 49 scorable in the library)
- `chemistry-2023-06-13-shift-3` (45 printed answers in this bundle vs 42 scorable in the library)
- `chemistry-2023-06-15-shift-1` (0 printed answers in this bundle vs 49 scorable in the library)
- `chemistry-2024-05-15-shift-1` (48 printed answers in this bundle vs 46 scorable in the library)
- `chemistry-2024-05-29` (48 printed answers in this bundle vs 48 scorable in the library)
- `chemistry-2024-07-19` (49 printed answers in this bundle vs 45 scorable in the library)
- `chemistry-2025-05-21-shift-2` (41 printed answers in this bundle vs 43 scorable in the library)
- `chemistry-2025-05-23-shift-2` (41 printed answers in this bundle vs 47 scorable in the library)
- `computer-science-2022` (37 printed answers in this bundle vs 39 scorable in the library)
- `computer-science-2024-07-19-shift-1` (48 printed answers in this bundle vs 45 scorable in the library)
- `computer-science-2025` (4 printed answers in this bundle vs 45 scorable in the library)
- `english-2022-08-06-shift-1` (50 printed answers in this bundle vs 48 scorable in the library)
- `english-2022-08-10` (49 printed answers in this bundle vs 48 scorable in the library)
- `english-2022-08-16-shift-1` (47 printed answers in this bundle vs 50 scorable in the library)
- `english-2022-08-18` (49 printed answers in this bundle vs 47 scorable in the library)
- `english-2022-08-22` (50 printed answers in this bundle vs 46 scorable in the library)
- `english-2023-05-21-shift-1` (49 printed answers in this bundle vs 50 scorable in the library)
- `english-2023-06-02-shift-3` (48 printed answers in this bundle vs 50 scorable in the library)
- `english-2023-06-05-shift-3` (26 printed answers in this bundle vs 50 scorable in the library)
- `english-2023-06-06-shift-2` (47 printed answers in this bundle vs 50 scorable in the library)
- `english-2023-06-09-shift-2` (50 printed answers in this bundle vs 47 scorable in the library)
- `english-2023-06-10-shift-2` (50 printed answers in this bundle vs 49 scorable in the library)
- `english-2023-06-11-shift-1` (49 printed answers in this bundle vs 49 scorable in the library)
- `english-2023-06-13-shift-3` (45 printed answers in this bundle vs 50 scorable in the library)
- `english-2023-06-15-shift-3` (50 printed answers in this bundle vs 49 scorable in the library)
- `english-2024-05-15-shift-2` (0 printed answers in this bundle vs 33 scorable in the library)
- `english-2024-05-29-shift-1` (36 printed answers in this bundle vs 47 scorable in the library)
- `english-2025-05-20-shift-1` (42 printed answers in this bundle vs 46 scorable in the library)
- `english-2025-05-20-shift-2` (43 printed answers in this bundle vs 49 scorable in the library)
- `general-test-2022-08-06` (69 printed answers in this bundle vs 70 scorable in the library)
- `general-test-2022-08-08-shift-1` (62 printed answers in this bundle vs 61 scorable in the library)
- `general-test-2022-08-18` (65 printed answers in this bundle vs 66 scorable in the library)
- `general-test-2022-08-22` (63 printed answers in this bundle vs 62 scorable in the library)
- `general-test-2022-08-23-shift-1` (64 printed answers in this bundle vs 71 scorable in the library)
- `general-test-2022-10-06-shift-1` (0 printed answers in this bundle vs 69 scorable in the library)
- `general-test-2023-05-21-shift-1` (0 printed answers in this bundle vs 58 scorable in the library)
- `general-test-2023-05-27-shift-1` (59 printed answers in this bundle vs 58 scorable in the library)
- `general-test-2023-06-05-shift-1` (0 printed answers in this bundle vs 57 scorable in the library)
- `general-test-2023-06-09-shift-2` (0 printed answers in this bundle vs 60 scorable in the library)
- `general-test-2023-06-10-shift-3` (59 printed answers in this bundle vs 59 scorable in the library)
- `general-test-2024-05-15-shift-3` (54 printed answers in this bundle vs 53 scorable in the library)
- `general-test-2024-05-29-shift-1` (55 printed answers in this bundle vs 53 scorable in the library)
- `general-test-2025-05-20-shift-1` (36 printed answers in this bundle vs 49 scorable in the library)
- `general-test-2025-05-20-shift-2` (32 printed answers in this bundle vs 44 scorable in the library)
- `geography-2022` (46 printed answers in this bundle vs 45 scorable in the library)
- `geography-2024-05-17-shift-1` (48 printed answers in this bundle vs 49 scorable in the library)
- `geography-2025-05-16-shift-1` (43 printed answers in this bundle vs 50 scorable in the library)
- `geography-2025-05-20-shift-1` (41 printed answers in this bundle vs 46 scorable in the library)
- `hindi-2022-08-30-shift-2` (0 printed answers in this bundle vs 50 scorable in the library)
- `hindi-2024-05-16-shift-2` (49 printed answers in this bundle vs 48 scorable in the library)
- `hindi-2025` (0 printed answers in this bundle vs 47 scorable in the library)
- `history-2022-08-21-shift-1` (0 printed answers in this bundle vs 40 scorable in the library)
- `history-2022-08-21-shift-2` (0 printed answers in this bundle vs 46 scorable in the library)
- `history-2024-05-18-shift-1` (50 printed answers in this bundle vs 48 scorable in the library)
- `history-2025-05-16-shift-1` (46 printed answers in this bundle vs 45 scorable in the library)
- `history-2025-05-20-shift-1` (44 printed answers in this bundle vs 45 scorable in the library)
- `history-2025-06-03-shift-2` (41 printed answers in this bundle vs 42 scorable in the library)
- `history-2025-06-21-shift-1` (44 printed answers in this bundle vs 44 scorable in the library)
- `mathematics-2022-08-17` (44 printed answers in this bundle vs 45 scorable in the library)
- `mathematics-2022-08-22` (45 printed answers in this bundle vs 42 scorable in the library)
- `mathematics-2022-08-30` (43 printed answers in this bundle vs 40 scorable in the library)
- `mathematics-2024-05-16-shift-1` (45 printed answers in this bundle vs 50 scorable in the library)
- `mathematics-2024-07-19-shift-1` (48 printed answers in this bundle vs 47 scorable in the library)
- `mathematics-2025-06-02-shift-1` (39 printed answers in this bundle vs 48 scorable in the library)
- `mathematics-2025-06-03-shift-2` (38 printed answers in this bundle vs 46 scorable in the library)
- `physics-2022-08-06` (46 printed answers in this bundle vs 40 scorable in the library)
- `physics-2022-08-22` (41 printed answers in this bundle vs 47 scorable in the library)
- `physics-2022-08-26` (44 printed answers in this bundle vs 38 scorable in the library)
- `physics-2023-05-21-shift-3` (49 printed answers in this bundle vs 48 scorable in the library)
- `physics-2023-05-22-shift-3` (48 printed answers in this bundle vs 45 scorable in the library)
- `physics-2023-05-25-shift-3` (0 printed answers in this bundle vs 49 scorable in the library)
- `physics-2023-05-30-shift-1` (44 printed answers in this bundle vs 45 scorable in the library)
- `physics-2023-06-09-shift-3` (45 printed answers in this bundle vs 48 scorable in the library)
- `physics-2024-05-16-shift-3` (46 printed answers in this bundle vs 44 scorable in the library)
- `physics-2024-07-19-shift-1` (50 printed answers in this bundle vs 43 scorable in the library)
- `physics-2025-05-20-shift-2` (37 printed answers in this bundle vs 48 scorable in the library)
- `physics-2025-05-21-shift-2` (41 printed answers in this bundle vs 50 scorable in the library)

## Next steps

1. `npm run db:migrate:local`
2. `node scripts/import-practice-library.mjs --local`
3. `node scripts/import-ranked-practice.mjs --local`
4. Spot-check `/mock-tests` and the new subject pages, then rebuild.

Unkeyed papers remain candidates for the editorial review queue. They are deliberately
not playable because the server cannot award or deduct marks without an authoritative key.
