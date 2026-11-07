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
let totalJsBytes = 0;
let totalCssBytes = 0;

console.log('================================================================');
console.log('Production Asset Performance Budget Audit');
console.log('================================================================\n');

for (const file of files) {
  const filePath = join(distDir, file);
  const size = statSync(filePath).size;
  if (file.endsWith('.js')) {
    totalJsBytes += size;
  } else if (file.endsWith('.css')) {
    totalCssBytes += size;
  }
}

const totalJsKb = totalJsBytes / 1024;
const totalCssKb = totalCssBytes / 1024;

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

checkBudget('Total Bundled JavaScript', totalJsKb, budget.limits.totalJsKb);
checkBudget('Total Bundled CSS', totalCssKb, budget.limits.totalCssKb);

console.log('\nLab-metric budgets (measured by npm run audit:lighthouse, not here):');
console.log(`- Mobile LCP Budget: <= ${budget.metrics.mobileSimulated4G.lcpMs} ms`);
console.log(`- Mobile TBT Budget: <= ${budget.metrics.mobileSimulated4G.tbtMs} ms`);

if (failed) {
  console.log('\n- Performance Budget Status: FAIL — trim the bundles above or, if the\n  budget is stale, revise performance-budget.json deliberately.');
  process.exit(1);
}

console.log('\n- Performance Budget Status: PASS\n');
process.exit(0);
