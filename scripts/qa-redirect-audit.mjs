#!/usr/bin/env node
/**
 * Redirect audit: verifies that every archived practice paper and every legacy
 * mock slug redirects once (301) to a working target.
 *
 * Requires a running local server on BASE_URL (default http://localhost:4321)
 * and the local D1 fixture. Never runs against production.
 */
import { execFileSync } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WRANGLER_BIN = join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
const BASE = process.env.BASE_URL || "http://localhost:4321";
const baseUrl = new URL(BASE);
if (!["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname)) {
  console.error(`Refusing to run outside localhost: ${BASE}`);
  process.exit(2);
}

function d1All(sql) {
  const output = execFileSync(
    process.execPath,
    [WRANGLER_BIN, "d1", "execute", "cuet-blueprint-db", "--local", "--json", "--command", sql],
    { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 },
  );
  const parsed = JSON.parse(output.slice(output.indexOf("[")));
  return parsed[0]?.results ?? [];
}

async function head(path) {
  const response = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return { status: response.status, location: response.headers.get("location") };
}

const failures = [];

// --- archived practice papers
const archived = d1All(
  "SELECT slug, replaced_by FROM practice_papers WHERE is_archived = 1 AND deleted_at IS NULL",
);
console.log(`archived practice papers: ${archived.length}`);
let checked = 0;
for (const paper of archived) {
  const expected = String(paper.replaced_by ?? "").trim();
  if (!expected) {
    failures.push(`archived:${paper.slug} expected-empty replaced_by`);
    continue;
  }
  const first = await head(`/mock-tests/${paper.slug}`);
  if (first.status !== 301) {
    failures.push(`archived:${paper.slug} /mock-tests -> HTTP ${first.status} (expected 301)`);
    continue;
  }
  const location = (first.location ?? "").replace(BASE, "");
  if (location !== expected) {
    failures.push(`archived:${paper.slug} Location "${location}" != replaced_by "${expected}"`);
  }
  const target = await head(location);
  if (target.status !== 200) {
    failures.push(`archived:${paper.slug} Location "${location}" -> HTTP ${target.status}`);
  }
  checked += 1;
  if (checked % 60 === 0) console.log(`archived checked: ${checked}`);
}

// --- legacy mock redirects
const mockRedirects = d1All(
  `SELECT r.old_slug, r.target_path, m.slug AS target_mock
   FROM slug_redirects r LEFT JOIN mock_tests m ON m.id = r.entity_id AND r.entity_type = 'mock'
   WHERE r.entity_type = 'mock'`,
);
console.log(`mock redirects: ${mockRedirects.length}`);
checked = 0;
for (const row of mockRedirects) {
  const first = await head(`/mock/${row.old_slug}`);
  if (first.status !== 301) {
    failures.push(`mock:${row.old_slug} -> HTTP ${first.status} (expected 301)`);
    continue;
  }
  const location = (first.location ?? "").replace(BASE, "");
  if (row.target_path) {
    if (location !== row.target_path) {
      failures.push(`mock:${row.old_slug} Location "${location}" != target_path "${row.target_path}"`);
    }
  } else if (row.target_mock) {
    if (!location.endsWith(`/mock/${row.target_mock}`)) {
      failures.push(`mock:${row.old_slug} Location "${location}" does not end with /mock/${row.target_mock}`);
    }
  }
  const target = await head(location);
  if (target.status !== 200) {
    failures.push(`mock:${row.old_slug} Location "${location}" -> HTTP ${target.status}`);
  }
  checked += 1;
  if (checked % 60 === 0) console.log(`mock redirects checked: ${checked}`);
}

console.log(`\nfailures: ${failures.length}`);
for (const failure of failures.slice(0, 50)) console.log(`  ${failure}`);
if (failures.length) process.exitCode = 1;
