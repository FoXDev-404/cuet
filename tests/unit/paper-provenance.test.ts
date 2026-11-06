import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { adSlotAllowed } from '../../src/lib/integrations';

function getLocalDb() {
  const d1Dir = resolve(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  const files = readdirSync(d1Dir)
    .filter((f) => f.endsWith('.sqlite'))
    .map((f) => ({ name: f, size: statSync(join(d1Dir, f)).size }))
    .sort((a, b) => b.size - a.size);
  return new DatabaseSync(join(d1Dir, files[0].name), { readOnly: true });
}

describe('Paper Provenance & Rights Policy Gates (Fix 3)', () => {
  it('schema includes source and rights columns on practice_papers', () => {
    const db = getLocalDb();
    const cols = db.prepare("PRAGMA table_info(practice_papers)").all() as { name: string }[];
    const colNames = cols.map((c) => c.name);

    expect(colNames).toContain('source_url');
    expect(colNames).toContain('source_type');
    expect(colNames).toContain('rights_status');
    expect(colNames).toContain('rights_note');
    expect(colNames).toContain('verified_by');
    expect(colNames).toContain('verified_at');
  });

  it('measures baseline counts for rights_status across all practice papers', () => {
    const db = getLocalDb();
    const rows = db.prepare(
      "SELECT rights_status, COUNT(*) as count FROM practice_papers WHERE deleted_at IS NULL GROUP BY rights_status"
    ).all() as { rights_status: string; count: number }[];

    const map = new Map(rows.map((r) => [r.rights_status, r.count]));
    const total = rows.reduce((acc, r) => acc + r.count, 0);
    const librarySize = (
      JSON.parse(readFileSync(resolve(process.cwd(), 'src/data/local-papers/index.json'), 'utf8')) as {
        papers: unknown[];
      }
    ).papers.length;

    expect(total).toBe(librarySize);
    // Imported OCR papers enter the library as unknown rights; clearance is a
    // separate editorial action, so the whole imported set starts unknown.
    expect(map.get('unknown')).toBe(librarySize);
  });

  it('adSlotAllowed forbids ads on practice papers while allowing the hub', () => {
    expect(adSlotAllowed('/mock-tests')).toBe(true);
    expect(adSlotAllowed('/mock-tests/')).toBe(true);
    expect(adSlotAllowed('/mock-tests/applied-mathematics-2025-06-02-shift-1')).toBe(false);
    expect(adSlotAllowed('/mock-tests/physics-2025')).toBe(false);
    expect(adSlotAllowed('/mock-tests/physics-2025/take')).toBe(false);
  });

  it('takedown documentation exists and defines grievance procedures', () => {
    expect(existsSync(resolve(process.cwd(), 'docs/TAKEDOWN_PROCESS.md'))).toBe(true);
    const doc = readFileSync(resolve(process.cwd(), 'docs/TAKEDOWN_PROCESS.md'), 'utf8');
    expect(doc).toContain('grievance@cuetfreemocktest.com');
    expect(doc).toContain('Section 52(1)(i)');
    expect(doc).toContain('rights_status = \'restricted\'');
  });

  it('practice paper page template enforces noindex when rights_status != cleared', () => {
    const template = readFileSync(resolve(process.cwd(), 'src/pages/mock-tests/[slug].astro'), 'utf8');
    expect(template).toContain('const isCleared = (paper as any).rightsStatus === "cleared";');
    expect(template).toContain('const forceNoindex = !isCleared;');
    expect(template).toContain('noindex={forceNoindex}');
    expect(template).toContain('/contact#takedown');
  });

  it('sitemap generator excludes practice papers when rights_status != cleared', () => {
    const sitemap = readFileSync(resolve(process.cwd(), 'src/pages/sitemap.xml.ts'), 'utf8');
    expect(sitemap).toContain('SELECT slug, rights_status FROM practice_papers');
    expect(sitemap).toContain('if (rights === "cleared")');
  });
});

