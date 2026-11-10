#!/usr/bin/env node
/**
 * scripts/check-perf-budget.mjs
 *
 * Verifies that production build assets (JS, CSS) in dist/client/_astro/
 * stay strictly within the performance budget defined in performance-budget.json.
 *
 * Enforced here: the bundle-size limits (totalJsKb, totalCssKb). The
 * lab-metric budgets (LCP/TBT/CLS, route scores) need a running Lighthouse
 * audit — see scripts/lighthouse-audit.mjs — so they are printed for
 * reference only.
 */

import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { gzipSync } from 'node:zlib';

const distDir = resolve(process.cwd(), 'dist/client/_astro');
const budgetFile = resolve(process.cwd(), 'performance-budget.json');

if (!existsSync(budgetFile)) {
  console.error('❌ performance-budget.json not found!');
  process.exit(1);
}

const budget = JSON.parse(readFileSync(budgetFile, 'utf-8'));

if (!existsSync(distDir)) {
  console.error('❌ dist/client/_astro directory not found. Please run `npm run build` first.');
  process.exit(1);
}

const files = readdirSync(distDir);
let totalJsRawBytes = 0;
let totalCssRawBytes = 0;
let totalJsBytes = 0;
let totalCssBytes = 0;

console.log('================================================================');
console.log('Production Asset Performance Budget Audit');
console.log('================================================================\n');

// Budgets are transfer sizes: Workers serves these assets gzip/brotli
// compressed, so comparing raw disk bytes overstates the payload that users
// actually download. Total JS includes lazy-loaded route chunks as well; the
// per-route transfer limits are checked by the Lighthouse audit.
for (const file of files) {
  const filePath = join(distDir, file);
  const body = readFileSync(filePath);
  const rawSize = statSync(filePath).size;
  const transferSize = gzipSync(body, { level: 9 }).length;
  if (file.endsWith('.js')) {
    totalJsRawBytes += rawSize;
    totalJsBytes += transferSize;
  } else if (file.endsWith('.css')) {
    totalCssRawBytes += rawSize;
    totalCssBytes += transferSize;
  }
}

const totalJsKb = totalJsBytes / 1024;
const totalCssKb = totalCssBytes / 1024;

function reportSize(label, rawBytes, transferBytes) {
  console.log(
    `${label}: raw ${(rawBytes / 1024).toFixed(1)} KB -> transfer ${(transferBytes / 1024).toFixed(1)} KB`,
  );
}

reportSize('JavaScript total', totalJsRawBytes, totalJsBytes);
reportSize('CSS total', totalCssRawBytes, totalCssBytes);

let failed = false;

function checkBudget(label, actualKb, limitKb) {
  const actual = actualKb.toFixed(1);
  if (typeof limitKb === 'number' && actualKb > limitKb) {
    failed = true;
    console.log(`❌ ${label}: ${actual} KB exceeds the ${limitKb} KB budget (over by ${(actualKb - limitKb).toFixed(1)} KB)`);
  } else {
    console.log(`✅ ${label}: ${actual} KB (budget limit: ${limitKb} KB)`);
  }
}

checkBudget('Total JavaScript (gzip transfer)', totalJsKb, budget.limits.totalJsKb);
checkBudget('Total CSS (gzip transfer)', totalCssKb, budget.limits.totalCssKb);

console.log('\nLab-metric budgets (measured by npm run audit:lighthouse, not here):');
console.log(`- Mobile LCP Budget: <= ${budget.metrics.mobileSimulated4G.lcpMs} ms`);
console.log(`- Mobile TBT Budget: <= ${budget.metrics.mobileSimulated4G.tbtMs} ms`);

if (failed) {
  console.log('\n- Performance Budget Status: FAIL — trim the bundles above or, if the\n  budget is stale, revise performance-budget.json deliberately.');
  process.exit(1);
}

console.log('\n- Performance Budget Status: PASS\n');
process.exit(0);
