#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function stripJsoncComments(content) {
  // Only strip single-line comments that start after whitespace, not inside strings like https://
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[ \t]+)\/\/.*$/gm, '$1');
}

class CheckFailed extends Error {}

function fail(message) {
  console.error(`❌ ${message}`);
  throw new CheckFailed(message);
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const isLoopbackHost = (hostname) => LOOPBACK_HOSTS.has(String(hostname).toLowerCase());

async function main() {
  const args = process.argv.slice(2);
  const liveIndex = args.indexOf('--live');
  const liveUrl = liveIndex !== -1 ? args[liveIndex + 1] : null;
  if (liveIndex !== -1 && !liveUrl) {
    fail('--live requires a URL, for example --live https://cuetfreemocktest.com');
  }

  console.log('🔍 Checking environment separation in wrangler.jsonc...');

  const configPath = resolve(process.cwd(), 'wrangler.jsonc');
  let rawConfig;
  try {
    rawConfig = readFileSync(configPath, 'utf8');
  } catch (err) {
    fail(`Failed to read wrangler.jsonc at ${configPath}: ${err.message}`);
  }

  let config;
  try {
    config = JSON.parse(stripJsoncComments(rawConfig));
  } catch (err) {
    fail(`Failed to parse wrangler.jsonc as JSON: ${err.message}`);
  }

  const staging = config.env?.staging;
  const production = config.env?.production;

  if (!staging) {
    fail('Missing "env.staging" configuration in wrangler.jsonc');
  }

  if (!production) {
    fail('Missing "env.production" configuration in wrangler.jsonc');
  }

  const stagingD1 = staging.d1_databases?.[0]?.database_id;
  const prodD1 = production.d1_databases?.[0]?.database_id;

  if (!stagingD1 || !prodD1) {
    fail('D1 database_id missing from staging or production environment.');
  }

  if (stagingD1 === prodD1) {
    fail(
      `CRITICAL SECURITY VIOLATION: Staging and Production share the same D1 Database ID: ${stagingD1}`,
    );
  }

  console.log(`✅ D1 Database Separation Verified:`);
  console.log(`   - Staging D1:    ${stagingD1}`);
  console.log(`   - Production D1: ${prodD1}`);

  // Check KV separation
  const stagingKv = (staging.kv_namespaces || []).map((kv) => kv.id).filter(Boolean);
  const prodKv = (production.kv_namespaces || []).map((kv) => kv.id).filter(Boolean);

  const commonKv = stagingKv.filter((id) => prodKv.includes(id));
  if (commonKv.length > 0) {
    fail(
      `CRITICAL: Staging and Production share KV namespace IDs: ${commonKv.join(', ')}`,
    );
  }

  console.log(
    `✅ KV Namespace Separation Verified (${stagingKv.length} staging, ${prodKv.length} production namespaces).`,
  );

  // The effective engine is decided at runtime from the TURSO_* secrets plus the
  // top-level/staging/production config. Committed vars must never force a local
  // engine or carry credentials; only `.dev.vars` (gitignored) and
  // `wrangler secret put` may hold them.
  const ENV_BLOCKS = [
    ['top-level', config],
    ['env.deploy2026', config.env?.deploy2026],
    ['env.staging', staging],
    ['env.production', production],
  ];
  const FORBIDDEN_VARS = [
    'USE_LOCAL_D1',
    'USE_TURSO_LOCAL',
    'PREVIEW_CANONICAL_ORIGIN',
    'TURSO_DATABASE_URL',
    'TURSO_AUTH_TOKEN',
  ];

  for (const [label, block] of ENV_BLOCKS) {
    const vars = block?.vars;
    if (!vars) continue;
    const found = FORBIDDEN_VARS.filter((name) =>
      Object.prototype.hasOwnProperty.call(vars, name),
    );
    if (found.length) {
      fail(
        `${label} commits ${found.join(', ')} in vars. ` +
          'Local-only flags belong in .dev.vars; Turso credentials belong in wrangler secrets.',
      );
    }
  }

  for (const label of ['staging', 'production']) {
    const siteUrl = config.env?.[label]?.vars?.SITE_URL;
    let parsed;
    try {
      parsed = new URL(siteUrl);
    } catch {
      fail(`${label}.vars.SITE_URL is not a valid URL: ${siteUrl}`);
    }
    if (parsed.protocol !== 'https:') {
      fail(`${label}.vars.SITE_URL must be an https origin, got ${siteUrl}`);
    }
    if (isLoopbackHost(parsed.hostname)) {
      fail(`${label}.vars.SITE_URL must not point at loopback, got ${siteUrl}`);
    }
  }

  console.log(
    '✅ Engine-selection policy verified (no committed flags or secrets; origins are non-loopback https).',
  );

  // Live proof for a deployed origin. Deliberately opt-in so CI never depends on
  // the network; run `npm run check:env:live` after a production deploy.
  if (liveUrl) {
    const base = liveUrl.replace(/\/+$/, '');
    console.log(`🔍 Live engine check: ${base}/api/health`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${base}/api/health`, {
        signal: controller.signal,
        headers: { 'user-agent': 'cuet-check-env' },
      });
      if (!response.ok) {
        fail(`Live health check returned HTTP ${response.status}`);
      }
      const body = await response.json();
      if (body?.ok !== true || body?.db !== 'ok') {
        fail('Live health check reports db not ok.');
      }
      if (body?.engine !== 'turso') {
        fail(
          `Live engine is ${body?.engine ?? 'unknown'}; production should report turso.`,
        );
      }
      console.log(`✅ Live origin reports engine=${body.engine}, db=${body.db}.`);
    } catch (error) {
      if (error instanceof CheckFailed) throw error;
      if (error?.code === 'ABORT_ERR' || error?.name === 'AbortError') {
        fail('Live health check timed out after 15s.');
      }
      fail(`Live health check failed: ${error?.message ?? error}`);
    } finally {
      clearTimeout(timer);
    }
  }

  console.log('🎉 Environment separation check PASSED.');
}

try {
  // Let Node drain the event loop on its own. Calling process.exit() right
  // after a TLS request can crash libuv on Windows (UV_HANDLE_CLOSING).
  await main();
} catch (error) {
  if (!(error instanceof CheckFailed)) {
    console.error(error);
  }
  process.exitCode = 1;
}
