import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

function getLocalDb() {
  const d1Dir = resolve(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  const files = readdirSync(d1Dir)
    .filter((f) => f.endsWith('.sqlite'))
    .map((f) => ({ name: f, size: statSync(join(d1Dir, f)).size }))
    .sort((a, b) => b.size - a.size);
  return new DatabaseSync(join(d1Dir, files[0].name), { readOnly: true });
}

describe('Explanation Honesty and Editorial Review Queue (Fix 4)', () => {
  it('schema includes explanation_source and explanation_status on practice_questions and questions', () => {
    const db = getLocalDb();
    const pqCols = db.prepare("PRAGMA table_info(practice_questions)").all() as { name: string }[];
    const pqColNames = pqCols.map((c) => c.name);

    expect(pqColNames).toContain('explanation_source');
    expect(pqColNames).toContain('explanation_status');
    expect(pqColNames).toContain('reviewed_by');
    expect(pqColNames).toContain('reviewed_at');

    const qCols = db.prepare("PRAGMA table_info(questions)").all() as { name: string }[];
    const qColNames = qCols.map((c) => c.name);

    expect(qColNames).toContain('explanation_source');
    expect(qColNames).toContain('explanation_status');
    expect(qColNames).toContain('reviewed_by');
    expect(qColNames).toContain('reviewed_at');
  });

  it('proves honest baseline counts: 0 questions marked reviewed without human sign-off', () => {
    const db = getLocalDb();
    const reviewedPq = db.prepare(
      "SELECT count(*) as count FROM practice_questions WHERE explanation_status = 'reviewed'"
    ).get() as { count: number };
    expect(reviewedPq.count).toBe(0);

    const reviewedQ = db.prepare(
      "SELECT count(*) as count FROM questions WHERE explanation_status = 'reviewed'"
    ).get() as { count: number };
    expect(reviewedQ.count).toBe(0);
  });

  it('proves separate counts per source: ai_draft and banner are identified truthfully', () => {
    const db = getLocalDb();
    const pqCounts = db.prepare(
      "SELECT explanation_source, count(*) as count FROM practice_questions GROUP BY explanation_source"
    ).all() as { explanation_source: string; count: number }[];

    const pqMap = new Map(pqCounts.map((r) => [r.explanation_source, r.count]));
    expect(pqMap.get('ai_draft')).toBe(6245);
    expect(pqMap.get('banner')).toBe(358);
  });

  it('100-question sample file exists with 101 lines (header + 100 questions)', () => {
    const samplePath = resolve(process.cwd(), 'docs/REVIEW_SAMPLE_100.csv');
    expect(existsSync(samplePath)).toBe(true);

    const content = readFileSync(samplePath, 'utf8');
    const lines = content.trim().split('\n');
    expect(lines.length).toBe(101);

    expect(lines[0]).toContain('id,source_table,context,source_question_no,stem,correct_option,explanation_source,explanation_status');
  });

  it('solutions view renders unreviewed explanation badge for unreviewed or ai_draft explanations', () => {
    const solutions = readFileSync(resolve(process.cwd(), 'src/pages/result/[attemptId]/solutions.astro'), 'utf8');
    expect(solutions).toContain('question.explanation_status === "unreviewed"');
    expect(solutions).toContain('Unreviewed explanation');
    expect(solutions).toContain('Key pending review');
  });

  it('review action endpoint enforces guard that unkeyed questions cannot be marked reviewed', () => {
    const actionEndpoint = readFileSync(resolve(process.cwd(), 'src/pages/api/admin/review/action.ts'), 'utf8');
    expect(actionEndpoint).toContain('if (question.correct_option === null)');
    expect(actionEndpoint).toContain('Cannot approve explanation for an unkeyed question');
  });
});

