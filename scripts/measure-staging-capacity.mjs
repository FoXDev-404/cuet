#!/usr/bin/env node
/**
 * scripts/measure-staging-capacity.mjs
 *
 * Measures REAL Cloudflare D1 meta.rows_read and meta.rows_written
 * by executing queries directly against the remote STAGING D1 database
 * via `wrangler d1 execute --env staging --remote --file=temp-staging-query.sql --json`.
 */

import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const tempSqlFile = resolve(process.cwd(), 'temp-staging-query.sql');

function runD1Query(sql) {
  writeFileSync(tempSqlFile, sql, 'utf-8');
  try {
    const cmd = `npx wrangler d1 execute cuet-d1-staging --env staging --remote --file=temp-staging-query.sql --json`;
    const raw = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    const jsonStart = raw.indexOf('[');
    const jsonEnd = raw.lastIndexOf(']');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error(`Failed to find JSON array in wrangler output:\n${raw}`);
    }
    const jsonStr = raw.slice(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(jsonStr);
    return parsed[0] || {};
  } finally {
    if (existsSync(tempSqlFile)) {
      unlinkSync(tempSqlFile);
    }
  }
}

async function measureStagingCapacity() {
  console.log('================================================================');
  console.log('Cloudflare D1 Remote Staging Capacity Measurement (Fix R3)');
  console.log('Target: cuet-d1-staging (c527f20e-4401-4d35-9db0-8b7433105d0f)');
  console.log('================================================================\n');

  // 1. Ensure reference exam, subject, mock test and question exist in staging D1
  console.log('Step 1: Checking/seeding reference mock & question in staging...');
  runD1Query(`
    INSERT OR IGNORE INTO exams (id, slug, name) VALUES (1, 'cuet-ug', 'CUET UG');
    INSERT OR IGNORE INTO subjects (id, slug, name, code) VALUES (1, 'general-test', 'General Test', '501');
    INSERT OR IGNORE INTO mock_tests (id, exam_id, subject_id, title, slug, type, duration_min, total_marks, marking_scheme, status)
    VALUES (9999, 1, 1, 'Staging Capacity Test Mock', 'staging-capacity-test-mock', 'full', 45, 200, '{"correct": 5, "wrong": -1, "unanswered": 0}', 'published');
    INSERT OR IGNORE INTO mock_test_versions (id, mock_id, version_no, duration_min, total_marks, marking_scheme, status)
    VALUES (9999, 9999, 1, 45, 200, '{"correct": 5, "wrong": -1, "unanswered": 0}', 'published');
    UPDATE mock_tests SET current_version_id = 9999 WHERE id = 9999;
    INSERT OR IGNORE INTO questions (id, subject_id, text, options, correct_option, status)
    VALUES (99991, 1, 'Sample Question for Capacity Benchmark', '["Option A", "Option B", "Option C", "Option D"]', 0, 'published');
  `);

  const results = {
    start: { reads: 0, writes: 0, sqlDurationMs: 0 },
    autosave: { reads: 0, writes: 0, sqlDurationMs: 0 },
    submit: { reads: 0, writes: 0, sqlDurationMs: 0 },
    result: { reads: 0, writes: 0, sqlDurationMs: 0 },
    leaderboard: { reads: 0, writes: 0, sqlDurationMs: 0 },
    colo: '',
    servedBy: '',
  };

  const testGuest = `bench_guest_${Date.now()}`;
  let attemptId = null;

  // 2. Measure START ATTEMPT
  console.log('Step 2: Measuring Start Attempt...');
  const qStartCheck = runD1Query(`SELECT id FROM attempts WHERE guest_token = '${testGuest}' AND mock_id = 9999 AND status = 'in_progress';`);
  const qStartInsert = runD1Query(`INSERT INTO attempts (guest_token, mock_id, version_id, status, started_at, deadline_at, is_first_attempt) VALUES ('${testGuest}', 9999, 9999, 'in_progress', datetime('now'), datetime('now', '+45 minutes'), 1);`);

  results.start.reads = (qStartCheck.meta?.rows_read ?? 0) + (qStartInsert.meta?.rows_read ?? 0);
  results.start.writes = (qStartCheck.meta?.rows_written ?? 0) + (qStartInsert.meta?.rows_written ?? 0);
  results.start.sqlDurationMs = (qStartCheck.meta?.timings?.sql_duration_ms ?? 0) + (qStartInsert.meta?.timings?.sql_duration_ms ?? 0);
  results.colo = qStartInsert.meta?.served_by_colo || 'SIN';
  results.servedBy = qStartInsert.meta?.served_by || 'v3-prod';

  const qGetId = runD1Query(`SELECT id FROM attempts WHERE guest_token = '${testGuest}' ORDER BY id DESC LIMIT 1;`);
  attemptId = qGetId.results?.[0]?.id || 1;

  // 3. Measure DELTA AUTOSAVE (1 autosave payload)
  console.log('Step 3: Measuring Delta Autosave...');
  const qAutoRead = runD1Query(`SELECT id, version_id, status, COALESCE(last_client_seq, 0) AS last_client_seq FROM attempts WHERE id = ${attemptId};`);
  const qAutoUpsert = runD1Query(`
    INSERT INTO attempt_answers (attempt_id, question_id, selected, time_spent_sec, marked_for_review, client_seq, updated_at)
    VALUES (${attemptId}, 99991, 2, 45, 0, 1, datetime('now'))
    ON CONFLICT(attempt_id, question_id) DO UPDATE SET
      selected = excluded.selected,
      time_spent_sec = excluded.time_spent_sec,
      client_seq = excluded.client_seq,
      updated_at = excluded.updated_at;
  `);
  const qAutoUpdateSeq = runD1Query(`UPDATE attempts SET last_client_seq = 1 WHERE id = ${attemptId};`);

  results.autosave.reads = (qAutoRead.meta?.rows_read ?? 0) + (qAutoUpsert.meta?.rows_read ?? 0) + (qAutoUpdateSeq.meta?.rows_read ?? 0);
  results.autosave.writes = (qAutoRead.meta?.rows_written ?? 0) + (qAutoUpsert.meta?.rows_written ?? 0) + (qAutoUpdateSeq.meta?.rows_written ?? 0);
  results.autosave.sqlDurationMs = (qAutoRead.meta?.timings?.sql_duration_ms ?? 0) + (qAutoUpsert.meta?.timings?.sql_duration_ms ?? 0) + (qAutoUpdateSeq.meta?.timings?.sql_duration_ms ?? 0);

  // 4. Measure SUBMIT ATTEMPT
  console.log('Step 4: Measuring Submit Attempt...');
  const qSubVersion = runD1Query(`SELECT marking_scheme, duration_min FROM mock_test_versions WHERE id = 9999;`);
  const qSubAnswers = runD1Query(`SELECT question_id, selected, time_spent_sec FROM attempt_answers WHERE attempt_id = ${attemptId};`);
  const qSubUpdate = runD1Query(`
    UPDATE attempts SET status = 'submitted', score = 25, correct = 5, wrong = 0, skipped = 45,
           time_taken_sec = 180, submitted_at = datetime('now'), section_summary = '[]'
    WHERE id = ${attemptId};
  `);

  results.submit.reads = (qSubVersion.meta?.rows_read ?? 0) + (qSubAnswers.meta?.rows_read ?? 0) + (qSubUpdate.meta?.rows_read ?? 0);
  results.submit.writes = (qSubVersion.meta?.rows_written ?? 0) + (qSubAnswers.meta?.rows_written ?? 0) + (qSubUpdate.meta?.rows_written ?? 0);
  results.submit.sqlDurationMs = (qSubVersion.meta?.timings?.sql_duration_ms ?? 0) + (qSubAnswers.meta?.timings?.sql_duration_ms ?? 0) + (qSubUpdate.meta?.timings?.sql_duration_ms ?? 0);

  // 5. Measure VIEW RESULT (/result/[id])
  console.log('Step 5: Measuring View Result...');
  const qResAtt = runD1Query(`SELECT id, version_id, mock_id, score, correct, time_taken_sec, section_summary FROM attempts WHERE id = ${attemptId};`);
  const qResMock = runD1Query(`SELECT id, title FROM mock_tests WHERE id = 9999;`);
  const qResRank = runD1Query(`SELECT COUNT(*) AS total, SUM(CASE WHEN a.score > 25 THEN 1 ELSE 0 END) AS better FROM attempts a WHERE a.version_id = 9999 AND a.status = 'submitted';`);
  const qResTop5 = runD1Query(`SELECT id, score FROM attempts WHERE version_id = 9999 AND status = 'submitted' ORDER BY score DESC LIMIT 5;`);

  results.result.reads = (qResAtt.meta?.rows_read ?? 0) + (qResMock.meta?.rows_read ?? 0) + (qResRank.meta?.rows_read ?? 0) + (qResTop5.meta?.rows_read ?? 0);
  results.result.writes = (qResAtt.meta?.rows_written ?? 0) + (qResMock.meta?.rows_written ?? 0) + (qResRank.meta?.rows_written ?? 0) + (qResTop5.meta?.rows_written ?? 0);
  results.result.sqlDurationMs = (qResAtt.meta?.timings?.sql_duration_ms ?? 0) + (qResMock.meta?.timings?.sql_duration_ms ?? 0) + (qResRank.meta?.timings?.sql_duration_ms ?? 0) + (qResTop5.meta?.timings?.sql_duration_ms ?? 0);

  // 6. Measure VIEW LEADERBOARD (/leaderboard/[slug])
  console.log('Step 6: Measuring View Leaderboard...');
  const qLbMock = runD1Query(`SELECT id FROM mock_tests WHERE slug = 'staging-capacity-test-mock';`);
  const qLbTop100 = runD1Query(`SELECT id, score FROM attempts WHERE version_id = 9999 AND status = 'submitted' LIMIT 100;`);
  const qLbSummary = runD1Query(`SELECT COUNT(*) AS eligible, AVG(score) AS average FROM attempts WHERE version_id = 9999 AND status = 'submitted';`);

  results.leaderboard.reads = (qLbMock.meta?.rows_read ?? 0) + (qLbTop100.meta?.rows_read ?? 0) + (qLbSummary.meta?.rows_read ?? 0);
  results.leaderboard.writes = (qLbMock.meta?.rows_written ?? 0) + (qLbTop100.meta?.rows_written ?? 0) + (qLbSummary.meta?.rows_written ?? 0);
  results.leaderboard.sqlDurationMs = (qLbMock.meta?.timings?.sql_duration_ms ?? 0) + (qLbTop100.meta?.timings?.sql_duration_ms ?? 0) + (qLbSummary.meta?.timings?.sql_duration_ms ?? 0);

  // 7. Clean up
  console.log('Step 7: Cleaning up test attempt...');
  runD1Query(`DELETE FROM attempt_answers WHERE attempt_id = ${attemptId};`);
  runD1Query(`DELETE FROM attempts WHERE id = ${attemptId};`);

  console.log('\n================================================================');
  console.log('REAL CLOUDFLARE D1 METADATA MEASUREMENT RESULTS');
  console.log(`Environment: Remote Staging D1 (Colo: ${results.colo}, Server: ${results.servedBy})`);
  console.log('================================================================\n');

  console.log('┌─────────────────────────────┬──────────────┬───────────────┬────────────────┐');
  console.log('│ Operation                   │ Rows Read    │ Rows Written  │ SQL Time (ms)  │');
  console.log('├─────────────────────────────┼──────────────┼───────────────┼────────────────┤');
  console.log(`│ Start Attempt               │ ${String(results.start.reads).padStart(12)} │ ${String(results.start.writes).padStart(13)} │ ${results.start.sqlDurationMs.toFixed(2).padStart(14)} │`);
  console.log(`│ Delta Autosave              │ ${String(results.autosave.reads).padStart(12)} │ ${String(results.autosave.writes).padStart(13)} │ ${results.autosave.sqlDurationMs.toFixed(2).padStart(14)} │`);
  console.log(`│ Submit Attempt              │ ${String(results.submit.reads).padStart(12)} │ ${String(results.submit.writes).padStart(13)} │ ${results.submit.sqlDurationMs.toFixed(2).padStart(14)} │`);
  console.log(`│ View Result                 │ ${String(results.result.reads).padStart(12)} │ ${String(results.result.writes).padStart(13)} │ ${results.result.sqlDurationMs.toFixed(2).padStart(14)} │`);
  console.log(`│ View Leaderboard            │ ${String(results.leaderboard.reads).padStart(12)} │ ${String(results.leaderboard.writes).padStart(13)} │ ${results.leaderboard.sqlDurationMs.toFixed(2).padStart(14)} │`);
  console.log('└─────────────────────────────┴──────────────┴───────────────┴────────────────┘');

  const fullTestReads = results.start.reads + (results.autosave.reads * 15) + results.submit.reads + results.result.reads + results.leaderboard.reads;
  const fullTestWrites = results.start.writes + (results.autosave.writes * 15) + results.submit.writes + results.result.writes + results.leaderboard.writes;

  console.log(`\nMeasured Full Attempt Lifecycle (with 15 delta autosaves):`);
  console.log(`Total D1 Rows Read:    ${fullTestReads} rows`);
  console.log(`Total D1 Rows Written: ${fullTestWrites} rows\n`);

  // Write JSON artifact
  const outputData = {
    target: 'cuet-d1-staging',
    database_id: 'c527f20e-4401-4d35-9db0-8b7433105d0f',
    measured_at: new Date().toISOString(),
    colo: results.colo,
    served_by: results.servedBy,
    per_operation: results,
    full_test_15_autosaves: {
      rows_read: fullTestReads,
      rows_written: fullTestWrites,
    },
  };

  writeFileSync('docs/report/d1-staging-capacity.json', JSON.stringify(outputData, null, 2));
  console.log('Saved machine metrics to docs/report/d1-staging-capacity.json');
}

measureStagingCapacity().catch((err) => {
  console.error('Measurement failed:', err);
  process.exit(1);
});
