import json
from collections import Counter, defaultdict
from pathlib import Path

root = Path(__file__).resolve().parents[2]
data = root / "src" / "data" / "local-papers"
papers_dir = root / "public" / "local-papers" / "papers"
assets_dir = root / "public" / "local-papers" / "assets"

index = json.loads((data / "index.json").read_text(encoding="utf-8"))["papers"]
keys = json.loads((data / "keys.json").read_text(encoding="utf-8"))["papers"]

errors = []
warnings = []
slugs = [row["slug"] for row in index]
if len(slugs) != len(set(slugs)):
    errors.append("duplicate slugs")

totals = Counter()
flags = Counter()
partial = []
no_key = []
no_options = []
missing_stem = []
composites = []
per_subject = Counter()
per_year = Counter()

for row in index:
    slug = row["slug"]
    per_subject[row["subject"]["name"]] += 1
    per_year[row["year"]] += 1
    paper_path = papers_dir / f"{slug}.json"
    if not paper_path.exists():
        errors.append(f"{slug}: missing paper json")
        continue
    paper = json.loads(paper_path.read_text(encoding="utf-8"))["exam"]
    questions = paper["questions"]
    key_map = keys.get(slug, {})
    totals["papers"] += 1
    totals["questions"] += len(questions)
    totals["keys"] += len(key_map)
    if len(questions) != row["questionCount"]:
        errors.append(f"{slug}: index count {row['questionCount']} != {len(questions)}")
    keyed = sum(1 for q in questions if q["reviewStatus"] == "keyed")
    if keyed != row["scorableQuestionCount"]:
        errors.append(f"{slug}: index keys {row['scorableQuestionCount']} != {keyed}")
    if len(key_map) != keyed:
        errors.append(f"{slug}: keys.json {len(key_map)} != keyed questions {keyed}")
    if row["questionCount"] < row["sourceQuestionCount"]:
        warnings.append(f"{slug}: dropped {row['sourceQuestionCount'] - row['questionCount']} of {row['sourceQuestionCount']}")

    passages = {p["id"] for p in paper.get("passages", [])}
    ids = set()
    for q in questions:
        qid = q["id"]
        if qid in ids:
            errors.append(f"{slug}: duplicate qid {qid}")
        ids.add(qid)
        if q["correctAnswer"] is not None or q["explanationEn"] is not None:
            errors.append(f"{slug} {qid}: answer leaked into public paper")
        options = q["optionsEn"]
        if len(options) < 2:
            no_options.append(f"{slug} {qid}")
            errors.append(f"{slug} {qid}: fewer than 2 options")
        if not q["stemEn"].strip() and not any(a["kind"] == "question" for a in q["assets"]):
            missing_stem.append(f"{slug} {qid}")
            errors.append(f"{slug} {qid}: no stem or body crop")
        if q["passageId"] and q["passageId"] not in passages:
            errors.append(f"{slug} {qid}: missing passage {q['passageId']}")
        if len(options) < 4:
            partial.append(f"{slug} {qid} ({len(options)} options)")
            flags["partial-options"] += 1
        for flag in q["reviewFlags"]:
            flags[flag] += 1
        kinds = {a["kind"] for a in q["assets"]}
        if ("options" in kinds) != bool(q["optionsAreImages"]):
            errors.append(f"{slug} {qid}: optionsAreImages/assets mismatch")
        if "options" in kinds:
            composites.append(f"{slug} {qid}")
        for asset in q["assets"]:
            if not asset.get("path", "").startswith(f"/local-papers/assets/{slug}/"):
                errors.append(f"{slug} {qid}: bad asset path {asset.get('path')}")
                continue
            file_path = root / "public" / asset["path"].lstrip("/")
            if not file_path.exists():
                errors.append(f"{slug} {qid}: missing asset {asset['path']}")
        if q["reviewStatus"] == "keyed":
            entry = key_map.get(qid)
            if not entry:
                errors.append(f"{slug} {qid}: keyed but no key entry")
            else:
                labels = {o["id"] for o in options}
                if entry["a"] not in labels:
                    errors.append(f"{slug} {qid}: key {entry['a']} not among {sorted(labels)}")
        else:
            no_key.append(f"{slug} {qid}")
            if qid in key_map:
                errors.append(f"{slug} {qid}: pending but has key entry")

extra = set(keys) - {row["slug"] for row in index}
if extra:
    errors.append(f"keys for unknown papers: {sorted(extra)}")

print("papers", totals["papers"], "questions", totals["questions"], "keys", totals["keys"])
print("per year", dict(sorted(per_year.items())))
print("per subject", dict(sorted(per_subject.items())))
print("flags", dict(flags.most_common()))
print("partial", len(partial), "composites", len(composites), "no_key", len(no_key))
print("dropped summaries", len(warnings))
print("ERRORS", len(errors))
for item in errors[:60]:
    print("  ERR", item)
print("WARNINGS")
for item in warnings:
    print("  ", item)
print("PARTIAL")
for item in partial[:80]:
    print("  ", item)
print("COMPOSITES")
for item in composites:
    print("  ", item)
