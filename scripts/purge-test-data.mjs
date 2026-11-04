#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import readline from 'node:readline';

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--')) {
    return args[idx + 1];
  }
  return null;
}

const target = getArg('target') || 'local';
const hasConfirmProd = args.includes('--confirm-production');
const purgeAllUsers = args.includes('--purge-all-users');

console.log(`🧹 Test Data Purge Tool`);
console.log(`   Target environment: ${target}`);

// PRODUCTION GUARD
if (target === 'production') {
  if (!hasConfirmProd) {
    console.error(`❌ CRITICAL SECURITY GUARD: Refusing to purge production database.`);
    console.error(`   To proceed, you must provide --confirm-production and answer the interactive confirmation prompt.`);
    process.exit(1);
  }

  // Interactive prompt check
  if (!process.stdin.isTTY) {
    console.error(`❌ Interactive terminal required for production purge confirmation. Aborting.`);
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((res) => {
    rl.question('⚠️  ARE YOU ABSOLUTELY SURE? Type "CONFIRM_PRODUCTION_PURGE" to proceed: ', res);
  });
  rl.close();

  if (answer.trim() !== 'CONFIRM_PRODUCTION_PURGE') {
    console.error('❌ Confirmation text mismatched. Purge cancelled.');
    process.exit(1);
  }
}

if (target !== 'local' && target !== 'staging' && target !== 'production') {
  console.error(`❌ Unknown target: ${target}. Allowed targets: local, staging, production.`);
  process.exit(1);
}

// Local Execution
if (target === 'local') {
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

  const db = new DatabaseSync(sqliteFile);

  console.log(`\n🧹 Purging test data from local SQLite: ${sqliteFile}`);

  const purgeStatements = [
    'DELETE FROM attempt_answers',
    'DELETE FROM attempts',
    'DELETE FROM discussion_reports',
    'DELETE FROM discussion_votes',
    'DELETE FROM discussions',
    'DELETE FROM bookmarks',
    'DELETE FROM user_badges',
    'DELETE FROM user_stats',
    'DELETE FROM share_events',
    'DELETE FROM question_reports',
    'DELETE FROM rescore_jobs',
    'DELETE FROM sessions',
    'DELETE FROM email_verifications',
    'DELETE FROM password_resets',
    'DELETE FROM audit_log WHERE action LIKE "%test%" OR action LIKE "%attempt%" OR action LIKE "%login%"',
  ];

  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec('BEGIN TRANSACTION;');

  for (const stmt of purgeStatements) {
    const tableName = stmt.replace('DELETE FROM ', '').split(' ')[0];
    const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(tableName);
    if (!exists) continue;

    const countBefore = db.prepare(`SELECT count(*) as count FROM ${tableName}`).get().count;
    db.exec(stmt);
    const countAfter = db.prepare(`SELECT count(*) as count FROM ${tableName}`).get().count;
    console.log(`   Purged ${tableName.padEnd(20)}: ${countBefore - countAfter} rows deleted (Remaining: ${countAfter})`);
  }

  // Users handling
  const usersExist = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = 'users'").get();
  if (usersExist) {
    const totalUsersBefore = db.prepare('SELECT count(*) as count FROM users').get().count;
    if (purgeAllUsers) {
      db.exec('DELETE FROM users');
      console.log(`   Purged users: all ${totalUsersBefore} rows deleted.`);
    } else {
      db.exec("DELETE FROM users WHERE role != 'super_admin' AND email != 'admin@cuetfreemocktest.com'");
      const remainingUsers = db.prepare('SELECT count(*) as count FROM users').get().count;
      console.log(`   Purged non-admin users: ${totalUsersBefore - remainingUsers} rows deleted (Super admins preserved: ${remainingUsers})`);
    }
  }

  db.exec('COMMIT;');
  db.exec('PRAGMA foreign_keys = ON;');

  console.log('\n✅ Local test data purge completed successfully.');
  process.exit(0);
}

// For remote staging/prod, instructions or wrangler d1 execute
console.log(`\nTo run purge on remote ${target}, ensure you run through approved staging pipeline.`);

