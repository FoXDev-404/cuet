#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const d1Dir = resolve(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
const files = readdirSync(d1Dir)
  .filter((f) => f.endsWith('.sqlite'))
  .map((f) => ({ name: f, size: statSync(join(d1Dir, f)).size }))
  .sort((a, b) => b.size - a.size);

const db = new DatabaseSync(join(d1Dir, files[0].name), { readOnly: true });

console.log('🎲 Generating 100-question randomized editorial review sample for owner...');

// 70 questions from practice_questions, 30 from questions
const practiceSample = db.prepare(`
  SELECT
    id,
    'practice_questions' AS source_table,
    paper_slug AS context,
    source_question_no,
    stem,
    correct_option,
    explanation_source,
    explanation_status,
    explanation
  FROM practice_questions
  WHERE deleted_at IS NULL
  ORDER BY RANDOM()
  LIMIT 70
`).all();

const mockSample = db.prepare(`
  SELECT
    q.id,
    'questions' AS source_table,
    s.name AS context,
    q.id AS source_question_no,
    q.text AS stem,
    q.correct_option,
    q.explanation_source,
    q.explanation_status,
    q.explanation
  FROM questions q
  JOIN subjects s ON s.id = q.subject_id
  WHERE q.deleted_at IS NULL
  ORDER BY RANDOM()
  LIMIT 30
`).all();

const combined = [...practiceSample, ...mockSample];

function csvEscape(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""').replace(/\r?\n/g, ' ');
  return `"${str}"`;
}

const headers = [
  'id',
  'source_table',
  'context',
  'source_question_no',
  'stem',
  'correct_option',
  'explanation_source',
  'explanation_status',
  'explanation',
  'owner_editorial_decision', // Blank column for owner to fill: APPROVED / FLAGGED / NEEDS_REWRITE
  'editorial_notes',
];

const csvRows = [headers.join(',')];

for (const row of combined) {
  csvRows.push([
    csvEscape(row.id),
    csvEscape(row.source_table),
    csvEscape(row.context),
    csvEscape(row.source_question_no),
    csvEscape(row.stem),
    csvEscape(row.correct_option),
    csvEscape(row.explanation_source),
    csvEscape(row.explanation_status),
    csvEscape(row.explanation),
    '""', // owner decision
    '""', // notes
  ].join(','));
}

const outputPath = resolve(process.cwd(), 'docs/REVIEW_SAMPLE_100.csv');
writeFileSync(outputPath, csvRows.join('\n'), 'utf8');

console.log(`✅ Successfully generated 100-question sample file at: ${outputPath}`);
console.log(`   Sample breakdown: 70 practice questions, 30 mock bank questions.`);
console.log(`   All questions remain strictly marked 'unreviewed' until human editorial sign-off.`);
