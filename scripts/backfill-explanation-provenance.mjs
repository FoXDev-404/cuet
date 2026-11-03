#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const d1Dir = resolve(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
const files = readdirSync(d1Dir)
  .filter((f) => f.endsWith('.sqlite'))
  .map((f) => ({ name: f, size: statSync(join(d1Dir, f)).size }))
  .sort((a, b) => b.size - a.size);

const db = new DatabaseSync(join(d1Dir, files[0].name));

console.log('🔄 Backfilling explanation provenance and review status...');

db.exec('BEGIN TRANSACTION;');

// 1. In practice_questions:
// Reset all
db.exec("UPDATE practice_questions SET explanation_source = 'none', explanation_status = 'unreviewed'");

// Banners: correct_option is null or explanation contains banner text
db.exec(`
  UPDATE practice_questions
  SET explanation_source = 'banner', explanation_status = 'unreviewed'
  WHERE correct_option IS NULL
     OR explanation LIKE '%pending%'
     OR explanation LIKE '%editorial review%'
     OR explanation LIKE '%under review%'
`);

// AI Draft: the 1,204 bulk-enriched questions containing automated key rationale
db.exec(`
  UPDATE practice_questions
  SET explanation_source = 'ai_draft', explanation_status = 'unreviewed'
  WHERE explanation_source != 'banner'
    AND (
      explanation LIKE '%National Testing Agency (NTA) official answer key confirms Option%'
      OR explanation LIKE '%Option % is the correct answer according to the NTA answer key%'
      OR explanation LIKE '%NTA answer key%'
    )
`);

// Remaining questions with non-empty explanations: unreviewed human / source drafts
db.exec(`
  UPDATE practice_questions
  SET explanation_source = 'ai_draft', explanation_status = 'unreviewed'
  WHERE explanation_source = 'none' AND explanation IS NOT NULL AND length(trim(explanation)) > 0
`);

// 2. In questions (mock engine questions):
db.exec("UPDATE questions SET explanation_source = 'none', explanation_status = 'unreviewed'");

db.exec(`
  UPDATE questions
  SET explanation_source = 'banner', explanation_status = 'unreviewed'
  WHERE correct_option IS NULL
     OR explanation LIKE '%pending%'
     OR explanation LIKE '%editorial review%'
`);

db.exec(`
  UPDATE questions
  SET explanation_source = 'ai_draft', explanation_status = 'unreviewed'
  WHERE explanation_source != 'banner' AND explanation IS NOT NULL AND length(trim(explanation)) > 0
`);

db.exec('COMMIT;');

console.log('\n📊 Practice Questions Explanation Provenance:');
const pqCounts = db.prepare(`
  SELECT explanation_source, explanation_status, count(*) as count
  FROM practice_questions
  GROUP BY explanation_source, explanation_status
`).all();
console.table(pqCounts);

console.log('\n📊 Mock Questions (questions table) Explanation Provenance:');
const qCounts = db.prepare(`
  SELECT explanation_source, explanation_status, count(*) as count
  FROM questions
  GROUP BY explanation_source, explanation_status
`).all();
console.table(qCounts);

console.log('✅ Backfill completed successfully.');

