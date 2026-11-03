import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Mock Cloudflare db for unit test
vi.mock('../../src/lib/db', () => ({
  first: vi.fn(async (query: string) => {
    if (query.includes("COUNT(*) AS count FROM admins WHERE role = 'super'")) {
      return { count: 1 };
    }
    return null;
  }),
}));

import { bootstrapSuperAdmin } from '../../src/lib/auth/admin';

describe('Production Guards (Fix 2)', () => {
  it('robots.txt disallows /dev and /dev/', () => {
    const robotsFile = readFileSync(resolve(process.cwd(), 'src/pages/robots.txt.ts'), 'utf8');
    expect(robotsFile).toContain('Disallow: /dev');
    expect(robotsFile).toContain('Disallow: /dev/');
  });

  it('bootstrapSuperAdmin returns null when an active super admin already exists', async () => {
    // With existing super admin, bootstrap promotion is strictly disabled
    const result = await bootstrapSuperAdmin('new-intruder@example.com');
    expect(result).toBeNull();
  });

  it('admin:create script refuses to add super admin in production if one already exists', () => {
    const script = readFileSync(resolve(process.cwd(), 'scripts/admin-create.mjs'), 'utf8');
    expect(script).toContain('REMOTE (production) already has');
    expect(script).toContain('Bootstrap super-admin creation is disabled in production once any super admin exists.');
  });

  it('middleware enforces production guards for /dev/* and admin session mode', () => {
    const middleware = readFileSync(resolve(process.cwd(), 'src/middleware.ts'), 'utf8');
    expect(middleware).toContain('pathname === "/dev" || pathname.startsWith("/dev/")');
    expect(middleware).toContain('currentEnv === "production"');
    expect(middleware).toContain('status: 404');
    expect(middleware).toContain('adminAuthMode === "session" && !allowSessionInProd');
    expect(middleware).toContain('status: 503');
  });
});
