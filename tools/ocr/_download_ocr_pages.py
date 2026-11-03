import json
import os
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

BASE = Path(__file__).resolve().parent / "OCR DATA"
CACHE = BASE / "_pages"
CACHE.mkdir(exist_ok=True)

jobs = []
for jp in sorted(BASE.glob("*.json")):
    stem = jp.stem.replace(".pdf_by_PaddleOCR-VL-1.6", "")
    data = json.loads(jp.read_text(encoding="utf-8"))
    for page_index, page in enumerate(data, start=1):
        md = (page.get("markdown") or {}).get("text") or ""
        if "<table" not in md:
            continue
        url = page.get("inputImage")
        if not url:
            continue
        out = CACHE / stem / f"p{page_index:02d}.jpg"
        jobs.append((out, url))

print(f"jobs={len(jobs)}", flush=True)
manifest_path = CACHE / "manifest.json"
results = {}


def fetch(job):
    out, url = job
    if out.exists() and out.stat().st_size > 1000:
        return str(out), "cached", out.stat().st_size
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
            if len(data) < 1000:
                raise ValueError(f"small page {len(data)}")
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(data)
            return str(out), "ok", len(data)
        except Exception as exc:
            if attempt == 3:
                return str(out), f"fail: {exc}", 0
            time.sleep(1.5 * (attempt + 1))
    return str(out), "fail", 0


with ThreadPoolExecutor(max_workers=12) as pool:
    futures = {pool.submit(fetch, job): job for job in jobs}
    done = 0
    for fut in as_completed(futures):
        path, status, size = fut.result()
        results[str(path)] = {"status": status, "size": size}
        done += 1
        if done % 50 == 0:
            print(f"{done}/{len(jobs)}", flush=True)

manifest_path.write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
ok = sum(1 for v in results.values() if v["status"] in ("ok", "cached"))
print(f"done ok={ok} fail={len(results)-ok}", flush=True)
