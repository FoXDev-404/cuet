#!/usr/bin/env node
/**
 * Post-build secret hygiene.
 *
 * The Astro Cloudflare adapter copies `.dev.vars` into `dist/server/.dev.vars`
 * so `wrangler dev` can be run from the build output. That file must never be
 * deployed, uploaded as an artifact, or committed. This script removes it after
 * the build and verifies that no sensitive `.dev.vars` value was inlined into
 * any other build artifact.
 *
 * Secret values are never printed; only the variable names are reported.
 */
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const DIST = join(ROOT, "dist");
const DEV_VARS = join(ROOT, ".dev.vars");
const SENSITIVE = /(SECRET|TOKEN|PASSWORD|PRIVATE_KEY|DATABASE_URL)/i;

if (!existsSync(DIST)) {
  console.error("[build-secrets] dist/ not found. Run the build first.");
  process.exit(1);
}

function walk(dir, visit) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, visit);
    else visit(full, entry.name);
  }
}

// 1. Remove the adapter-copied .dev.vars and any accidentally emitted env file.
let removed = 0;
walk(DIST, (full, name) => {
  if (name === ".dev.vars" || name === ".env" || name === ".env.local") {
    rmSync(full, { force: true });
    removed += 1;
  }
});
if (removed > 0) {
  console.log(`[build-secrets] removed ${removed} local env file(s) from dist/`);
}

// 2. Collect sensitive values from the local .dev.vars (names only are reported).
const secrets = [];
if (existsSync(DEV_VARS)) {
  for (const line of readFileSync(DEV_VARS, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || !SENSITIVE.test(match[1])) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (value.length >= 8) secrets.push({ name: match[1], value });
  }
}

// 3. Fail if a sensitive value was inlined anywhere else in the client/server.
const leaks = [];
if (secrets.length > 0) {
  walk(DIST, (full) => {
    const size = statSync(full).size;
    if (size > 20 * 1024 * 1024) return;
    const body = readFileSync(full);
    for (const secret of secrets) {
      if (body.includes(Buffer.from(secret.value))) {
        leaks.push(`${full} <- ${secret.name}`);
      }
    }
  });
}

if (leaks.length > 0) {
  console.error("[build-secrets] FAIL: sensitive .dev.vars values found in build output:");
  for (const leak of leaks) console.error(`  - ${leak}`);
  process.exit(1);
}

console.log(
  `[build-secrets] PASS: no sensitive .dev.vars values in dist/ (${secrets.length} checked)`,
);
