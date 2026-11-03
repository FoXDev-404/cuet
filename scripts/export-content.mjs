#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const d1Dir = resolve(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
let sqliteFile;
try {
  const files = readdirSync(d1Dir)
    .filter((f) => f.endsWith('.sqlite'))
    .map((f) => ({ name: f, size: statSync(join(d1Dir, f)).size }))
    .sort((a, b) => b.size - a.size);

  if (files.length === 0 || files[0].size === 0) {
    throw new Error('No populated .sqlite file found in miniflare D1 directory');
  }
  sqliteFile = join(d1Dir, files[0].name);
} catch (err) {
  console.error('❌ Could not locate local Miniflare SQLite database:', err.message);
  process.exit(1);
}

const db = new DatabaseSync(sqliteFile, { readOnly: true });

// Strict foreign-key ordered content tables (NO user, session, or attempt tables)
const CONTENT_TABLES = [
  'subjects',
  'topics',
  'exams',
  'passages',
  'questions',
  'practice_papers',
  'practice_passages',
  'practice_questions',
  'mock_tests',
  'mock_test_versions',
  'mock_questions',
  'media_assets',
  'blog_posts',
  'exam_info',
  'page_seo',
  'question_public_ids',
  'site_settings',
  'slug_redirects',
];

const FORBIDDEN_USER_TABLES = [
  'users',
  'sessions',
  'attempts',
  'attempt_answers',
  'discussions',
  'discussion_votes',
  'discussion_reports',
  'bookmarks',
  'user_stats',
  'user_badges',
  'share_events',
  'audit_log',
  'email_verifications',
  'password_resets',
  'question_reports',
  'rescore_jobs',
];

const args = process.argv.slice(2);
const outputArgIdx = args.indexOf('--output');
const outputPath = outputArgIdx !== -1 && args[outputArgIdx + 1]
  ? resolve(process.cwd(), args[outputArgIdx + 1])
  : resolve(process.cwd(), 'content-export.sql');

console.log(`📦 Exporting content-only tables from ${sqliteFile}...`);
console.log(`   Destination: ${outputPath}`);

function escapeSqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'bigint') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (val instanceof Uint8Array || Buffer.isBuffer(val)) {
    return `X'${Buffer.from(val).toString('hex')}'`;
  }
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

let sqlLines = [
  '-- CUET Mock Platform Content-Only Export',
  `-- Generated: ${new Date().toISOString()}`,
  '-- Foreign-key safe, zero user/session/attempt data included',
  'PRAGMA foreign_keys = OFF;',
  'BEGIN TRANSACTION;',
];

let totalExportedRows = 0;
const counts = {};

for (const table of CONTENT_TABLES) {
  const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
  if (!exists) {
    console.log(`   [SKIP] Table ${table} does not exist in source schema`);
    continue;
  }

  const rows = db.prepare(`SELECT * FROM ${table}`).all();
  counts[table] = rows.length;
  totalExportedRows += rows.length;

  if (rows.length === 0) {
    console.log(`   [0 rows] ${table}`);
    continue;
  }

  const cols = Object.keys(rows[0]);
  sqlLines.push(`\n-- Table: ${table} (${rows.length} rows)`);

  for (const row of rows) {
    const colList = cols.map((c) => `"${c}"`).join(', ');
    const valList = cols.map((c) => escapeSqlValue(row[c])).join(', ');
    sqlLines.push(`INSERT OR REPLACE INTO ${table} (${colList}) VALUES (${valList});`);
  }

  console.log(`   [EXPORTED] ${table.padEnd(22)}: ${rows.length.toLocaleString()} rows`);
}

sqlLines.push('\nCOMMIT;');
sqlLines.push('PRAGMA foreign_keys = ON;\n');

writeFileSync(outputPath, sqlLines.join('\n'), 'utf8');

console.log(`\n✅ Successfully exported ${totalExportedRows.toLocaleString()} content rows to ${outputPath}`);

// Strict verification: ensure zero forbidden user rows in export
console.log('\n🔒 Verifying zero user/session/attempt leaks in export...');
const exportedSql = sqlLines.join('\n');
for (const forbidden of FORBIDDEN_USER_TABLES) {
  if (exportedSql.includes(`INSERT OR REPLACE INTO ${forbidden} `)) {
    console.error(`❌ CRITICAL SECURITY ERROR: Export contains rows from forbidden table: ${forbidden}`);
    process.exit(1);
  }
}
console.log('✅ Leak check passed: Zero user rows, zero session rows, zero attempt rows found in content export.');
process.exit(0);
