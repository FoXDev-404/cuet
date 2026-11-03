#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function stripJsoncComments(content) {
  // Only strip single-line comments that start after whitespace, not inside strings like https://
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[ \t]+)\/\/.*$/gm, '$1');
}

console.log('🔍 Checking environment separation in wrangler.jsonc...');

const configPath = resolve(process.cwd(), 'wrangler.jsonc');
let rawConfig;
try {
  rawConfig = readFileSync(configPath, 'utf8');
} catch (err) {
  console.error(`❌ Failed to read wrangler.jsonc at ${configPath}:`, err.message);
  process.exit(1);
}

let config;
try {
  config = JSON.parse(stripJsoncComments(rawConfig));
} catch (err) {
  console.error('❌ Failed to parse wrangler.jsonc as JSON:', err.message);
  process.exit(1);
}

const staging = config.env?.staging;
const production = config.env?.production;

if (!staging) {
  console.error('❌ Missing "env.staging" configuration in wrangler.jsonc');
  process.exit(1);
}

if (!production) {
  console.error('❌ Missing "env.production" configuration in wrangler.jsonc');
  process.exit(1);
}

const stagingD1 = staging.d1_databases?.[0]?.database_id;
const prodD1 = production.d1_databases?.[0]?.database_id;

if (!stagingD1 || !prodD1) {
  console.error('❌ D1 database_id missing from staging or production environment.');
  process.exit(1);
}

if (stagingD1 === prodD1) {
  console.error(`❌ CRITICAL SECURITY VIOLATION: Staging and Production share the same D1 Database ID: ${stagingD1}`);
  process.exit(1);
}

console.log(`✅ D1 Database Separation Verified:`);
console.log(`   - Staging D1:    ${stagingD1}`);
console.log(`   - Production D1: ${prodD1}`);

// Check KV separation
const stagingKv = (staging.kv_namespaces || []).map((kv) => kv.id).filter(Boolean);
const prodKv = (production.kv_namespaces || []).map((kv) => kv.id).filter(Boolean);

const commonKv = stagingKv.filter((id) => prodKv.includes(id));
if (commonKv.length > 0) {
  console.error(`❌ CRITICAL: Staging and Production share KV namespace IDs: ${commonKv.join(', ')}`);
  process.exit(1);
}

console.log(`✅ KV Namespace Separation Verified (${stagingKv.length} staging, ${prodKv.length} production namespaces).`);
console.log('🎉 Environment separation check PASSED.');
process.exit(0);
