import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

function stripJsoncComments(content: string) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[ \t]+)\/\/.*$/gm, '$1');
}

describe('Environment Separation & Guard Policies', () => {
  it('guarantees strictly distinct D1 database IDs between staging and production', () => {
    const raw = readFileSync(resolve(process.cwd(), 'wrangler.jsonc'), 'utf8');
    const config = JSON.parse(stripJsoncComments(raw));

    const stagingD1 = config.env?.staging?.d1_databases?.[0]?.database_id;
    const prodD1 = config.env?.production?.d1_databases?.[0]?.database_id;

    expect(stagingD1).toBeDefined();
    expect(prodD1).toBeDefined();
    expect(typeof stagingD1).toBe('string');
    expect(typeof prodD1).toBe('string');
    expect(stagingD1.length).toBeGreaterThan(10);
    expect(prodD1.length).toBeGreaterThan(10);

    // CRITICAL: They must never point to the same database
    expect(stagingD1).not.toBe(prodD1);
  });

  it('guarantees distinct KV namespaces between staging and production', () => {
    const raw = readFileSync(resolve(process.cwd(), 'wrangler.jsonc'), 'utf8');
    const config = JSON.parse(stripJsoncComments(raw));

    const stagingKvs: string[] = (config.env?.staging?.kv_namespaces || []).map((k: any) => k.id);
    const prodKvs: string[] = (config.env?.production?.kv_namespaces || []).map((k: any) => k.id);

    expect(stagingKvs.length).toBeGreaterThan(0);
    expect(prodKvs.length).toBeGreaterThan(0);

    for (const sid of stagingKvs) {
      expect(prodKvs).not.toContain(sid);
    }
  });

  it('keeps local development on the top-level config and production in env.production', () => {
    const raw = readFileSync(resolve(process.cwd(), 'wrangler.jsonc'), 'utf8');
    const config = JSON.parse(stripJsoncComments(raw));

    // Local dev and Playwright must not run with production fixture filtering.
    expect(config.vars?.ENV).toBe('development');
    expect(config.vars?.DEV_SHOW_RESET_LINK).toBe('1');

    // The live worker keeps its name so the workers.dev URL stays stable.
    expect(config.env?.production?.name).toBe('cuet-astro');
    expect(config.env?.production?.vars?.ENV).toBe('production');
    expect(config.env?.production?.vars?.DEV_SHOW_RESET_LINK).toBe('');
    // Cloudflare Access is not configured yet, so session admin access stays
    // available only because the override is intentional and explicit.
    expect(config.env?.production?.vars?.ADMIN_AUTH_MODE).toBe('session');
    expect(config.env?.production?.vars?.ADMIN_ALLOW_SESSION_IN_PROD).toBe('1');
  });

  it('routes npm run deploy through the production environment build', () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
    expect(pkg.scripts?.deploy).toContain('scripts/deploy-production.mjs');
  });

  it('check-env-separation.mjs script passes and exits with code 0', () => {
    const output = execSync('node scripts/check-env-separation.mjs', { encoding: 'utf8' });
    expect(output).toContain('Environment separation check PASSED');
  });

  it('purge-test-data.mjs rejects unconfirmed execution against production', () => {
    let failed = false;
    try {
      execSync('node scripts/purge-test-data.mjs --target production', {
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (err: any) {
      failed = true;
      expect(err.status).toBe(1);
      const stderr = err.stderr ? err.stderr.toString() : '';
      expect(stderr).toContain('Refusing to purge production database');
    }
    expect(failed).toBe(true);
  });
});

