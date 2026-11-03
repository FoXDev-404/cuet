import json
import os
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

BASE = Path(__file__).resolve().parent / "OCR DATA"
CACHE = BASE / "_images"
CACHE.mkdir(exist_ok=True)

jobs = []
for jp in sorted(BASE.glob("*.json")):
    stem = jp.stem.replace(".pdf_by_PaddleOCR-VL-1.6", "")
    data = json.loads(jp.read_text(encoding="utf-8"))
    for page_index, page in enumerate(data, start=1):
        images = page.get("markdown", {}).get("images", {}) or {}
        for rel, url in images.items():
            name = os.path.basename(rel.split("?")[0])
            out = CACHE / stem / f"p{page_index:02d}_{name}"
            jobs.append((out, url, page.get("inputImage", "")))

print(f"jobs={len(jobs)}", flush=True)
manifest_path = CACHE / "manifest.json"
existing = {}
if manifest_path.exists():
    try:
        existing = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        existing = {}


def fetch(job):
    out, url, page_url = job
    if out.exists() and out.stat().st_size > 200:
        return str(out), "cached", out.stat().st_size
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                data = resp.read()
            if len(data) < 100:
                raise ValueError(f"small image {len(data)}")
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(data)
            return str(out), "ok", len(data)
        except Exception as exc:
            if attempt == 3:
                return str(out), f"fail: {exc}", 0
            time.sleep(1.5 * (attempt + 1))
    return str(out), "fail", 0


results = {}
with ThreadPoolExecutor(max_workers=16) as pool:
    futures = {pool.submit(fetch, job): job for job in jobs}
    done = 0
    for fut in as_completed(futures):
        path, status, size = fut.result()
        results[str(path)] = {"status": status, "size": size}
        done += 1
        if done % 100 == 0:
            print(f"{done}/{len(jobs)}", flush=True)

manifest_path.write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
ok = sum(1 for v in results.values() if v["status"] in ("ok", "cached"))
print(f"done ok={ok} fail={len(results)-ok}", flush=True)
