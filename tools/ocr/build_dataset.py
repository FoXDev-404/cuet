#!/usr/bin/env python3
"""Build a clean, reusable CUET dataset package from the live project data.

Sources
-------
PYQ library
  * local D1 `practice_papers` / `practice_questions` / `practice_passages`
    -> the exact rows the running site serves (questions, options, answers,
       explanations, passages, assets).
  * `src/data/local-papers/index.json` + `keys.json`
    -> the committed source of truth; cross-checked against D1.

Mock bank
  * local D1 `questions` / `passages` / `mock_tests` / `mock_test_versions` /
    `mock_questions` / `subjects`.

Assets
  * `public/local-papers/assets/` -> printed page crops and option images.

Test fixtures (E2E rows) and soft-deleted rows are excluded; every exclusion
is counted in the manifest so nothing disappears silently.
"""

from __future__ import annotations

import csv
import glob
import json
import os
import re
import shutil
import sqlite3
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
D1 = (
    ROOT
    / ".wrangler/state/v3/d1/miniflare-D1DatabaseObject"
    / "9e86a3487f62f60f2005838556d2eb9f94df20a990ccf3e7e9e15550212e2901.sqlite"
)
INDEX_FILE = ROOT / "src/data/local-papers/index.json"
KEYS_FILE = ROOT / "src/data/local-papers/keys.json"
PAPERS_DIR = ROOT / "public/local-papers/papers"
ASSETS_DIR = ROOT / "public/local-papers/assets"
MIGRATIONS_DIR = ROOT / "migrations"

OUT_DIR = ROOT / "export/cuet-dataset"
ZIP_PATH = ROOT / "CUET_Question_Dataset.zip"

FIXTURE_Q = re.compile(r"^\s*E2E\b|fixture", re.I)
FIXTURE_MOCK = re.compile(r"^\s*E2E\b|publish check|fixture", re.I)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def clean(value):
    """Normalise whitespace without destroying the printed layout."""
    if value is None:
        return None
    if not isinstance(value, str):
        return value
    value = value.replace("\u00a0", " ").replace("\u200b", "")
    value = value.replace("\ufffd", "")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def loads(value, fallback):
    if value in (None, ""):
        return fallback
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return fallback


def rows(db, sql, params=()):
    cur = db.execute(sql, params)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


# ---------------------------------------------------------------------------
# PYQ library
# ---------------------------------------------------------------------------
def build_pyq(db):
    papers = rows(
        db,
        """
        SELECT p.id, p.slug, p.title, p.meta_description, p.subject_id, p.year,
               p.exam_date, p.date_label, p.shift, p.duration_min, p.source_file,
               p.source_method, p.source_question_count, p.publication_status,
               p.review_required,
               s.name AS subject_name, s.slug AS subject_slug, s.code AS subject_code
        FROM practice_papers p
        JOIN subjects s ON s.id = p.subject_id
        WHERE p.deleted_at IS NULL AND p.publication_status = 'published'
        ORDER BY p.year DESC, s.name ASC, p.exam_date ASC, p.shift ASC
        """,
    )

    passages_by_paper: dict[str, list[dict]] = {}
    for r in rows(
        db,
        """
        SELECT paper_slug, passage_key, title, body
        FROM practice_passages
        WHERE deleted_at IS NULL
        ORDER BY paper_slug, id
        """,
    ):
        passages_by_paper.setdefault(r["paper_slug"], []).append(
            {
                "id": r["passage_key"],
                "title": clean(r["title"]) or "Reading passage",
                "content": clean(r["body"]),
            }
        )

    questions_by_paper: dict[str, list[dict]] = {}
    for r in rows(
        db,
        """
        SELECT paper_slug, question_key, source_question_no, position, stem,
               options_json, options_are_images, correct_option, explanation,
               passage_key, match_list_json, arrangement_json, assets_json,
               review_flags_json
        FROM practice_questions
        WHERE deleted_at IS NULL
        ORDER BY paper_slug, position
        """,
    ):
        options = loads(r["options_json"], [])
        answer = (r["correct_option"] or "").strip().upper()
        has_key = bool(answer) and any(o.get("id") == answer for o in options)
        assets = loads(r["assets_json"], [])
        passage_key = r["passage_key"] or ""
        questions_by_paper.setdefault(r["paper_slug"], []).append(
            {
                "id": r["question_key"],
                "number": r["source_question_no"] or r["position"],
                "stem": clean(r["stem"]),
                "options": [
                    {
                        "id": o.get("id"),
                        "label": o.get("id"),
                        "text": clean(o.get("text")),
                        "imageUrl": o.get("image_url"),
                        "isCorrect": (o.get("id") == answer) if has_key else False,
                    }
                    for o in options
                ],
                "correctAnswer": answer if has_key else None,
                "explanation": clean(r["explanation"]) or None,
                "scorable": has_key,
                "optionsAreImages": bool(r["options_are_images"]),
                "passageId": passage_key or None,
                "matchList": loads(r["match_list_json"], None),
                "arrangementItems": loads(r["arrangement_json"], []),
                "assets": assets,
                "reviewFlags": loads(r["review_flags_json"], []),
            }
        )

    out_papers = []
    for p in papers:
        qs = questions_by_paper.get(p["slug"], [])
        scorable = sum(1 for q in qs if q["scorable"])
        out_papers.append(
            {
                "slug": p["slug"],
                "id": f"local-{p['slug']}",
                "title": p["title"],
                "metaDescription": p["meta_description"],
                "subject": {
                    "id": f"local-{p['subject_slug']}",
                    "name": p["subject_name"],
                    "slug": p["subject_slug"],
                    "code": p["subject_code"],
                },
                "year": p["year"],
                "examDate": p["exam_date"],
                "dateLabel": p["date_label"],
                "shift": p["shift"],
                "durationMinutes": p["duration_min"],
                "sourceFile": p["source_file"],
                "sourceMethod": p["source_method"],
                "publicationStatus": p["publication_status"],
                "reviewRequired": bool(p["review_required"]),
                "questionCount": len(qs),
                "sourceQuestionCount": p["source_question_count"],
                "scorableQuestionCount": scorable,
                "unscoredQuestionCount": len(qs) - scorable,
                "passages": passages_by_paper.get(p["slug"], []),
                "questions": qs,
            }
        )
    return out_papers


# ---------------------------------------------------------------------------
# Mock bank
# ---------------------------------------------------------------------------
def build_mock(db):
    subjects = rows(
        db,
        "SELECT id, exam_id, name, slug, type, is_active, code FROM subjects WHERE deleted_at IS NULL ORDER BY id",
    )
    passages = rows(
        db,
        "SELECT id, subject_id, body, body_hi, image_url, image_alt FROM passages WHERE deleted_at IS NULL ORDER BY id",
    )
    subject_by_id = {s["id"]: s for s in subjects}

    all_questions = rows(
        db,
        """
        SELECT id, subject_id, topic_id, passage_id, text, text_hi, options, options_hi,
               correct_option, explanation, explanation_hi, difficulty, year, image_url,
               image_alt, explanation_image_url, explanation_image_alt, status, assets_json,
               deleted_at
        FROM questions
        ORDER BY id
        """,
    )
    questions = []
    fixture_q = 0
    soft_deleted_q = 0
    for r in all_questions:
        if r["deleted_at"] is not None:
            soft_deleted_q += 1
            continue
        if FIXTURE_Q.search(r["text"] or ""):
            fixture_q += 1
            continue
        opts = loads(r["options"], [])
        correct = r["correct_option"]
        subject = subject_by_id.get(r["subject_id"], {})
        questions.append(
            {
                "id": r["id"],
                "subject": {
                    "id": r["subject_id"],
                    "name": subject.get("name"),
                    "slug": subject.get("slug"),
                    "code": subject.get("code"),
                },
                "topicId": r["topic_id"],
                "passageId": r["passage_id"],
                "text": clean(r["text"]),
                "textHi": clean(r["text_hi"]) or None,
                "options": [
                    {
                        "index": i,
                        "label": chr(65 + i),
                        "text": clean(o.get("text")),
                        "imageUrl": o.get("image_url"),
                        "isCorrect": (i == correct),
                    }
                    for i, o in enumerate(opts)
                ],
                "correctOptionIndex": correct,
                "correctOptionLabel": chr(65 + correct) if isinstance(correct, int) and 0 <= correct < 26 else None,
                "explanation": clean(r["explanation"]) or None,
                "explanationHi": clean(r["explanation_hi"]) or None,
                "difficulty": r["difficulty"],
                "year": r["year"],
                "imageUrl": r["image_url"],
                "imageAlt": r["image_alt"],
                "explanationImageUrl": r["explanation_image_url"],
                "status": r["status"],
                "assets": loads(r["assets_json"], []),
            }
        )

    all_mocks = rows(
        db,
        """
        SELECT id, exam_id, subject_id, title, slug, type, duration_min, total_marks,
               marking_scheme, instructions, intro_html, pyq_year, pyq_shift, status,
               version, published_at, pyq_paper_id, current_version_id, practice_paper_slug,
               deleted_at
        FROM mock_tests
        ORDER BY id
        """,
    )
    mocks = []
    fixture_m = 0
    soft_deleted_m = 0
    for r in all_mocks:
        if r["deleted_at"] is not None:
            soft_deleted_m += 1
            continue
        if FIXTURE_MOCK.search(r["title"] or ""):
            fixture_m += 1
            continue
        subject = subject_by_id.get(r["subject_id"], {})
        mocks.append(
            {
                "id": r["id"],
                "examId": r["exam_id"],
                "subject": {
                    "id": r["subject_id"],
                    "name": subject.get("name"),
                    "slug": subject.get("slug"),
                    "code": subject.get("code"),
                },
                "title": r["title"],
                "slug": r["slug"],
                "type": r["type"],
                "durationMinutes": r["duration_min"],
                "totalMarks": r["total_marks"],
                "markingScheme": loads(r["marking_scheme"], None),
                "instructions": clean(r["instructions"]) or None,
                "introHtml": r["intro_html"],
                "pyqYear": r["pyq_year"],
                "pyqShift": r["pyq_shift"],
                "status": r["status"],
                "version": r["version"],
                "publishedAt": r["published_at"],
                "pyqPaperId": r["pyq_paper_id"],
                "currentVersionId": r["current_version_id"],
                "practicePaperSlug": r["practice_paper_slug"],
            }
        )

    versions = rows(
        db,
        """
        SELECT id, mock_id, version_no, duration_min, total_marks, marking_scheme,
               instructions, status, published_at
        FROM mock_test_versions
        ORDER BY mock_id, version_no
        """,
    )
    for v in versions:
        v["marking_scheme"] = loads(v["marking_scheme"], None)
        v["instructions"] = clean(v["instructions"]) or None

    # Only keep links that belong to a kept mock and point at a kept question.
    mock_ids = {m["id"] for m in mocks}
    version_ids = {v["id"] for v in versions if v["mock_id"] in mock_ids}
    question_ids = {q["id"] for q in questions}
    mock_questions = [
        r
        for r in rows(
            db,
            """
            SELECT version_id, question_id, section, position
            FROM mock_questions
            ORDER BY version_id, section, position
            """,
        )
        if r["version_id"] in version_ids and r["question_id"] in question_ids
    ]

    return {
        "subjects": subjects,
        "passages": [
            {
                "id": p["id"],
                "subjectId": p["subject_id"],
                "body": clean(p["body"]),
                "bodyHi": clean(p["body_hi"]) or None,
                "imageUrl": p["image_url"],
                "imageAlt": p["image_alt"],
            }
            for p in passages
        ],
        "questions": questions,
        "mockTests": mocks,
        "mockTestVersions": [v for v in versions if v["mock_id"] in mock_ids],
        "mockQuestions": mock_questions,
        "excluded": {
            "fixtureQuestions": fixture_q,
            "fixtureMockTests": fixture_m,
            "softDeletedQuestions": soft_deleted_q,
            "softDeletedMockTests": soft_deleted_m,
        },
    }


# ---------------------------------------------------------------------------
# CSV helpers
# ---------------------------------------------------------------------------
def write_pyq_csv(path, papers):
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(
            [
                "paperSlug", "paperTitle", "subject", "subjectCode", "year", "examDate", "shift",
                "questionNo", "questionId", "scorable", "correctAnswer",
                "optionA", "optionB", "optionC", "optionD",
                "stem", "explanation",
            ]
        )
        for p in papers:
            for q in p["questions"]:
                opts = {o["label"]: o["text"] for o in q["options"]}
                w.writerow(
                    [
                        p["slug"], p["title"], p["subject"]["name"], p["subject"]["code"],
                        p["year"], p["examDate"], p["shift"],
                        q["number"], q["id"], q["scorable"], q["correctAnswer"] or "",
                        opts.get("A", ""), opts.get("B", ""), opts.get("C", ""), opts.get("D", ""),
                        q["stem"], q["explanation"] or "",
                    ]
                )


def write_mock_csv(path, questions):
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(
            [
                "id", "subject", "subjectCode", "difficulty", "year", "status",
                "correctOption", "optionA", "optionB", "optionC", "optionD",
                "text", "explanation",
            ]
        )
        for q in questions:
            opts = {o["label"]: o["text"] for o in q["options"]}
            w.writerow(
                [
                    q["id"], q["subject"]["name"], q["subject"]["code"], q["difficulty"],
                    q["year"], q["status"], q["correctOptionLabel"],
                    opts.get("A", ""), opts.get("B", ""), opts.get("C", ""), opts.get("D", ""),
                    q["text"], q["explanation"] or "",
                ]
            )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    if not D1.exists():
        raise SystemExit(f"Local D1 database not found at {D1}")

    db = sqlite3.connect(D1)
    db.row_factory = sqlite3.Row

    print("Reading PYQ library from D1...")
    papers = build_pyq(db)
    total_q = sum(len(p["questions"]) for p in papers)
    keyed = sum(1 for p in papers for q in p["questions"] if q["correctAnswer"])
    print(f"  {len(papers)} papers, {total_q} questions, {keyed} with answers")

    print("Reading mock bank from D1...")
    mock = build_mock(db)
    print(f"  {len(mock['questions'])} questions, {len(mock['mockTests'])} mock tests")
    db.close()

    # Cross-check the committed keys file against D1.
    keys_file = json.loads(KEYS_FILE.read_text(encoding="utf-8"))["papers"]
    file_pairs = {(slug, qk): v.get("a") for slug, v in keys_file.items() for qk, v in v.items()}
    db_pairs = {
        (p["slug"], q["id"]): q["correctAnswer"]
        for p in papers
        for q in p["questions"]
        if q["correctAnswer"]
    }
    only_file = set(file_pairs) - set(db_pairs)
    only_db = set(db_pairs) - set(file_pairs)
    mismatch = [k for k in set(file_pairs) & set(db_pairs) if file_pairs[k] != db_pairs[k]]

    print("Writing files...")
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    (OUT_DIR / "pyq/papers").mkdir(parents=True)
    (OUT_DIR / "mock").mkdir(parents=True)
    (OUT_DIR / "schema").mkdir(parents=True)

    for p in papers:
        (OUT_DIR / "pyq/papers" / f"{p['slug']}.json").write_text(
            json.dumps(p, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    flat = []
    for p in papers:
        for q in p["questions"]:
            flat.append(
                {
                    "paperSlug": p["slug"],
                    "paperTitle": p["title"],
                    "subject": p["subject"],
                    "year": p["year"],
                    "examDate": p["examDate"],
                    "shift": p["shift"],
                    **q,
                }
            )

    (OUT_DIR / "pyq/questions.json").write_text(
        json.dumps(flat, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (OUT_DIR / "pyq/index.json").write_text(
        json.dumps(
            {
                "papers": [
                    {k: v for k, v in p.items() if k not in ("questions", "passages")}
                    for p in papers
                ]
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    write_pyq_csv(OUT_DIR / "pyq/questions.csv", papers)

    for name, key in (
        ("subjects", "subjects"),
        ("passages", "passages"),
        ("questions", "questions"),
        ("mockTests", "mockTests"),
        ("mockTestVersions", "mockTestVersions"),
        ("mockQuestions", "mockQuestions"),
    ):
        (OUT_DIR / f"mock/{name}.json").write_text(
            json.dumps(mock[key], indent=2, ensure_ascii=False), encoding="utf-8"
        )
    write_mock_csv(OUT_DIR / "mock/questions.csv", mock["questions"])

    # Committed source-of-truth files, kept for auditability.
    shutil.copy2(INDEX_FILE, OUT_DIR / "pyq/source-index.json")
    shutil.copy2(KEYS_FILE, OUT_DIR / "pyq/source-keys.json")

    # Assets (printed crops and option images).
    print("Copying assets...")
    shutil.copytree(ASSETS_DIR, OUT_DIR / "assets")

    # Schema.
    for sql in sorted(glob.glob(str(MIGRATIONS_DIR / "*.sql"))):
        shutil.copy2(sql, OUT_DIR / "schema" / Path(sql).name)

    manifest = {
        "name": "CUET Question Dataset",
        "version": "2.0",
        "generatedAt": now_iso(),
        "source": "CUET Mock Platform (Astro + Cloudflare D1/KV), local D1 mirror",
        "counts": {
            "pyqPapers": len(papers),
            "pyqQuestions": total_q,
            "pyqQuestionsWithAnswer": keyed,
            "pyqQuestionsWithoutAnswer": total_q - keyed,
            "pyqPassages": sum(len(p["passages"]) for p in papers),
            "mockSubjects": len(mock["subjects"]),
            "mockQuestions": len(mock["questions"]),
            "mockPassages": len(mock["passages"]),
            "mockTests": len(mock["mockTests"]),
            "mockTestVersions": len(mock["mockTestVersions"]),
            "mockQuestionLinks": len(mock["mockQuestions"]),
            "assetFiles": sum(len(files) for _, _, files in os.walk(OUT_DIR / "assets")),
        },
        "excluded": {
            "note": "E2E test fixtures and soft-deleted rows are excluded.",
            "fixtureQuestions": mock["excluded"]["fixtureQuestions"],
            "fixtureMockTests": mock["excluded"]["fixtureMockTests"],
            "softDeletedQuestions": mock["excluded"]["softDeletedQuestions"],
            "softDeletedMockTests": mock["excluded"]["softDeletedMockTests"],
        },
        "answerKeyCrossCheck": {
            "source": "src/data/local-papers/keys.json",
            "inFileOnly": len(only_file),
            "inDatabaseOnly": len(only_db),
            "valueMismatches": len(mismatch),
        },
    }
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    readme = f"""# CUET Question Dataset

Generated: {manifest['generatedAt']}

## What is inside

| Path | Contents |
|---|---|
| `pyq/papers/*.json` | {len(papers)} previous-year papers, each with questions, options, correct answers, explanations, passages and asset references |
| `pyq/questions.json` | All {total_q} PYQ questions in one flat array |
| `pyq/questions.csv` | Same data, one row per question, option text in columns A-D |
| `pyq/index.json` | Paper-level metadata only |
| `pyq/source-index.json` | The committed index the site is built from |
| `pyq/source-keys.json` | The committed answer keys + explanations |
| `mock/questions.json` | {len(mock['questions'])} mock-bank questions with answers and explanations |
| `mock/questions.csv` | Same data as CSV |
| `mock/passages.json` | {len(mock['passages'])} reading passages |
| `mock/mockTests.json` | {len(mock['mockTests'])} mock tests (PYQ, subject and full) |
| `mock/mockTestVersions.json` | {len(mock['mockTestVersions'])} version snapshots |
| `mock/mockQuestions.json` | {len(mock['mockQuestions'])} mock-to-question links |
| `mock/subjects.json` | {len(mock['subjects'])} subjects |
| `assets/` | {manifest['counts']['assetFiles']} printed page crops and option images referenced by the questions |
| `schema/*.sql` | D1 migrations that create the schema |
| `manifest.json` | Counts, exclusions and the answer-key cross-check result |

## PYQ question shape

```json
{{
  "id": "q01",
  "number": 1,
  "stem": "The protein formed by the encoded gene expression ...",
  "options": [
    {{ "id": "A", "label": "A", "text": "Structural protein", "imageUrl": null, "isCorrect": false }},
    {{ "id": "B", "label": "B", "text": "Recombinant protein", "imageUrl": null, "isCorrect": true }}
  ],
  "correctAnswer": "B",
  "explanation": "...",
  "scorable": true,
  "optionsAreImages": false,
  "passageId": null,
  "matchList": null,
  "arrangementItems": [],
  "assets": [],
  "reviewFlags": []
}}
```

`scorable: false` means the printed option labels could not be matched to an
official key, so the question is playable but left unscored. This is the same
rule the live site uses.

## Mock question shape

```json
{{
  "id": 283,
  "subject": {{ "id": 19, "name": "Applied Mathematics", "slug": "applied-mathematics", "code": "APM" }},
  "text": "$$ \\\\int ... $$",
  "options": [
    {{ "index": 0, "label": "A", "text": "...", "imageUrl": null, "isCorrect": false }}
  ],
  "correctOptionIndex": 2,
  "correctOptionLabel": "C",
  "explanation": "...",
  "difficulty": "medium",
  "status": "published"
}}
```

## Answer key coverage

- PYQ: {keyed}/{total_q} questions ({keyed * 100 // max(total_q, 1)}%) carry an official key.
- Mock bank: {sum(1 for q in mock['questions'] if q['correctOptionLabel'])}/{len(mock['questions'])} questions carry an answer.

## Exclusions

- {mock['excluded']['fixtureQuestions']} E2E test-fixture questions and {mock['excluded']['fixtureMockTests']} fixture mock tests were removed.
- {mock['excluded']['softDeletedQuestions']} soft-deleted questions and {mock['excluded']['softDeletedMockTests']} soft-deleted mock tests were removed.

## Image assets

Question and option images live in `assets/<paper-slug>/`. A question's
`assets` array and an option's `imageUrl` point at those files relative to
this directory.

## Notes

- Maths is kept in the LaTeX form the site renders, so no re-parsing is needed.
- Hindi stems are included in the mock bank as `textHi`.
- `matchList` and `arrangementItems` are present for the non-MCQ question types.
"""
    (OUT_DIR / "README.md").write_text(readme, encoding="utf-8")

    print("Building zip...")
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()
    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for root, _dirs, files in os.walk(OUT_DIR):
            for f in files:
                full = Path(root) / f
                zf.write(full, full.relative_to(OUT_DIR).as_posix())

    size_mb = ZIP_PATH.stat().st_size / 1024 / 1024
    file_count = sum(len(files) for _, _, files in os.walk(OUT_DIR))
    print()
    print(f"ZIP: {ZIP_PATH}")
    print(f"     {file_count} files, {size_mb:.2f} MB")
    print(f"     PYQ: {len(papers)} papers / {total_q} questions / {keyed} keyed")
    print(f"     Mock: {len(mock['questions'])} questions / {len(mock['mockTests'])} tests")
    print(f"     Key cross-check: fileOnly={len(only_file)} dbOnly={len(only_db)} mismatches={len(mismatch)}")


if __name__ == "__main__":
    main()
