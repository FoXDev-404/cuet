import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync, spawn } from 'node:child_process';
import http from 'node:http';

function runScript(
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  // The stub health server lives in this process, so a synchronous execSync
  // would block it from answering. Spawn asynchronously instead.
  return new Promise((resolveRun, reject) => {
    const child = spawn('node', ['scripts/check-env-separation.mjs', ...args], {
      cwd: process.cwd(),
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => resolveRun({ code: code ?? 1, stdout, stderr }));
  });
}

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

  it('ships an .env.example pointer without duplicating configuration', () => {
    const example = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');
    expect(example).toContain('.dev.vars.example');
    expect(example).toContain('cp .dev.vars.example .dev.vars');

    // Keep one source of truth: no keys duplicated into the pointer file.
    const assignments = example
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^[A-Z0-9_]+=/.test(line));
    expect(assignments).toEqual([]);

    const ignore = readFileSync(resolve(process.cwd(), '.gitignore'), 'utf8');
    expect(ignore).toContain('!.env.example');
  });

  it('keeps engine-selection flags and Turso secrets out of committed vars', () => {
    const raw = readFileSync(resolve(process.cwd(), 'wrangler.jsonc'), 'utf8');
    const config = JSON.parse(stripJsoncComments(raw));

    const blocks: Array<[string, any]> = [
      ['top-level', config],
      ['env.deploy2026', config.env?.deploy2026],
      ['env.staging', config.env?.staging],
      ['env.production', config.env?.production],
    ];
    const forbidden = [
      'USE_LOCAL_D1',
      'USE_TURSO_LOCAL',
      'PREVIEW_CANONICAL_ORIGIN',
      'TURSO_DATABASE_URL',
      'TURSO_AUTH_TOKEN',
    ];

    for (const [label, block] of blocks) {
      const vars = block?.vars ?? {};
      for (const key of forbidden) {
        expect(vars, `${label} must not commit ${key}`).not.toHaveProperty(key);
      }
    }
  });

  it('requires staging and production origins to be non-loopback https URLs', () => {
    const raw = readFileSync(resolve(process.cwd(), 'wrangler.jsonc'), 'utf8');
    const config = JSON.parse(stripJsoncComments(raw));

    for (const label of ['staging', 'production'] as const) {
      const url = config.env?.[label]?.vars?.SITE_URL;
      expect(url, `${label} must set SITE_URL`).toBeDefined();
      const parsed = new URL(url);
      expect(parsed.protocol).toBe('https:');
      expect(['localhost', '127.0.0.1', '::1', '[::1]']).not.toContain(
        parsed.hostname.toLowerCase(),
      );
    }
  });

  it('check-env-separation.mjs --live asserts the deployed engine', async () => {
    async function withHealth(body: unknown) {
      const server = http.createServer((_req, res) => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(body));
      });
      await new Promise<void>((resolveListen) =>
        server.listen(0, '127.0.0.1', resolveListen),
      );
      const address = server.address() as { port: number };
      return { server, url: `http://127.0.0.1:${address.port}` };
    }

    const healthy = await withHealth({ ok: true, db: 'ok', engine: 'turso' });
    try {
      const result = await runScript(['--live', healthy.url]);
      expect(result.stderr).toBe('');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('engine=turso');
    } finally {
      await new Promise((resolveClose) => healthy.server.close(resolveClose));
    }

    const wrongEngine = await withHealth({ ok: true, db: 'ok', engine: 'd1' });
    try {
      const result = await runScript(['--live', wrongEngine.url]);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('d1');
    } finally {
      await new Promise((resolveClose) => wrongEngine.server.close(resolveClose));
    }
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

