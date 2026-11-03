"""Compare the production D1 database with the local dev copy.

D1's free tier bills *rows read*, so this audit also measures what the
practice-library index query costs and how much the KV cache saves.

Usage:
    python tools/ocr/audit_remote_d1.py
    python tools/ocr/audit_remote_d1.py --skip-index   # counts only

Requires an authenticated wrangler (`npx wrangler whoami`).

Queries run one table at a time: while the daily quota is nearly spent, D1
rejects multi-table/compound queries outright with error 7500 even though a
small single-table scan still succeeds.
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB_NAME = "cuet-blueprint-db"
LOCAL_D1 = (
    ROOT
    / ".wrangler/state/v3/d1/miniflare-D1DatabaseObject"
    / "9e86a3487f62f60f2005838556d2eb9f94df20a990ccf3e7e9e15550212e2901.sqlite"
)
STORE_TS = ROOT / "src/lib/practice-store-d1.ts"
WRANGLER = ROOT / "node_modules/.bin/wrangler.cmd"

FREE_TIER_ROWS_PER_DAY = 5_000_000
# Keep in sync with FRESH_TTL_SECONDS in src/lib/practice-cache.ts.
CACHE_TTL_SECONDS = 600
QUOTA_ERROR_CODE = 7500


class QuotaExceeded(RuntimeError):
    """D1 refused the query because the daily row-read budget is spent."""


def wrangler_command(*args: str) -> list[str]:
    executable = str(WRANGLER) if WRANGLER.exists() else "npx"
    prefix = [executable] if WRANGLER.exists() else [executable, "wrangler"]
    return [*prefix, *args]


def wrangler_json(args: list[str]) -> object:
    completed = subprocess.run(
        wrangler_command(*args),
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=300,
    )
    text = completed.stdout
    start = text.find("{")
    start = len(text) if start < 0 else start
    array_start = text.find("[")
    if 0 <= array_start < start:
        start = array_start
    if start >= len(text):
        raise RuntimeError(
            f"no JSON in wrangler output (exit {completed.returncode}):\n"
            f"{text[:800]}\n{completed.stderr[:800]}"
        )
    payload = json.loads(text[start:])
    if completed.returncode != 0:
        error = payload.get("error", {}) if isinstance(payload, dict) else {}
        if error.get("code") == QUOTA_ERROR_CODE:
            raise QuotaExceeded(error.get("text", "daily row-read limit reached"))
        raise RuntimeError(f"wrangler failed ({completed.returncode}): {payload}")
    return payload


def run_remote(sql: str) -> tuple[list[dict], dict]:
    payload = wrangler_json(
        ["d1", "execute", DB_NAME, "--remote", "--json", "--command", sql]
    )
    if not isinstance(payload, list) or not payload:
        raise RuntimeError(f"unexpected wrangler payload: {payload}")
    result = payload[0]
    if not result.get("success"):
        raise RuntimeError(f"query failed: {result}")
    return result.get("results", []), result.get("meta", {})


def database_usage() -> dict:
    payload = wrangler_json(["d1", "info", DB_NAME, "--json"])
    if isinstance(payload, list):
        payload = payload[0] if payload else {}
    return payload if isinstance(payload, dict) else {}


def local_tables(conn: sqlite3.Connection) -> list[str]:
    return [
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' "
            "AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' "
            "ORDER BY name"
        )
    ]


def index_sql() -> str:
    source = STORE_TS.read_text(encoding="utf-8")
    match = re.search(r"const INDEX_SQL = `(.*?)`;", source, re.DOTALL)
    if not match:
        raise RuntimeError(f"INDEX_SQL not found in {STORE_TS}")
    return match.group(1)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--skip-index",
        action="store_true",
        help="skip the practice-index rows_read measurement",
    )
    args = parser.parse_args()

    if not LOCAL_D1.exists():
        print(f"local D1 not found: {LOCAL_D1}", file=sys.stderr)
        return 1

    usage = database_usage()
    print(
        "remote usage (rolling 24h): "
        f"{usage.get('rows_read_24h', 0):,} rows read, "
        f"{usage.get('read_queries_24h', 0):,} read queries, "
        f"limit {FREE_TIER_ROWS_PER_DAY:,}/day"
    )
    if int(usage.get("rows_read_24h") or 0) > FREE_TIER_ROWS_PER_DAY:
        print("  -> currently over the free-tier budget; large scans will be rejected\n")

    conn = sqlite3.connect(f"file:{LOCAL_D1}?mode=ro", uri=True)
    try:
        tables = local_tables(conn)
        local = {
            name: int(conn.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0])
            for name in tables
        }
    finally:
        conn.close()

    print(f"tables: {len(tables)} local, querying remote one at a time...\n")
    print(f"{'table':36} {'local':>8} {'remote':>8} {'diff':>8}")
    print("-" * 64)
    total_local = total_remote = 0
    mismatches = 0
    quota_blocked = False
    audit_rows_read = 0
    for name in tables:
        lv = local[name]
        total_local += lv
        if quota_blocked:
            print(f"{name:36} {lv:>8} {'--':>8} {'--':>8}")
            continue
        try:
            rows, meta = run_remote(f'SELECT COUNT(*) AS n FROM "{name}"')
            rv = int(rows[0]["n"]) if rows else 0
            audit_rows_read += int(meta.get("rows_read") or 0)
        except QuotaExceeded:
            quota_blocked = True
            print(f"{name:36} {lv:>8} {'quota':>8} {'--':>8}")
            continue
        total_remote += rv
        diff = rv - lv
        if diff:
            mismatches += 1
        print(f"{name:36} {lv:>8} {rv:>8} {diff:>+8}")
    print("-" * 64)
    print(
        f"{'TOTAL':36} {total_local:>8} "
        f"{total_remote:>8} {total_remote - total_local:>+8}"
    )
    print(f"\ntables with a count difference: {mismatches}/{len(tables)}")
    print(f"audit cost: {audit_rows_read:,} rows read")
    if quota_blocked:
        print(
            "D1 stopped answering partway through: the daily row-read quota is "
            "spent. Re-run after midnight UTC; local counts are still shown."
        )

    if not args.skip_index:
        try:
            # `wrangler.cmd` mangles multi-line arguments on Windows, so the
            # query is flattened before it reaches the CLI.
            results, meta = run_remote(re.sub(r"\s+", " ", index_sql()))
            rows = len(results)
            rows_read = int(meta.get("rows_read") or 0)
            duration = float(meta.get("duration") or 0)
            print("\npractice-library index query")
            print(f"  rows returned : {rows}")
            print(f"  rows read     : {rows_read:,} (the quota that was blowing up)")
            print(f"  duration      : {duration:.1f} ms")
            cached_loads = 86_400 // CACHE_TTL_SECONDS
            worst_case = rows_read * cached_loads
            print(
                f"  with a {CACHE_TTL_SECONDS // 60}-min KV cache: <= {cached_loads} D1 reads/day"
                f" = {worst_case:,} rows/day,"
                f" {worst_case / FREE_TIER_ROWS_PER_DAY:.1%} of the free tier"
            )
            if rows_read:
                print(
                    f"  without the cache: {FREE_TIER_ROWS_PER_DAY // rows_read:,}"
                    " uncached loads would exhaust 5M rows/day"
                )
        except QuotaExceeded:
            print("\npractice-library index query skipped: quota exhausted")
            print("(the KV cache exists; this measurement needs a free budget)")
        except RuntimeError as error:
            print(f"\npractice-library index query failed: {error}")

    return 0 if mismatches == 0 and not quota_blocked else 2


if __name__ == "__main__":
    raise SystemExit(main())
