import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

function pngSize(relativePath: string): { width: number; height: number } {
  const file = resolve(root, relativePath);
  expect(existsSync(file)).toBe(true);
  const buffer = readFileSync(file);
  // PNG signature + IHDR width/height (big-endian at bytes 16 and 20).
  expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe('PWA support', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest'));

  it('declares an installable, scoped manifest', () => {
    expect(typeof manifest.name).toBe('string');
    expect(manifest.name.length).toBeGreaterThan(0);
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(Array.isArray(manifest.shortcuts)).toBe(true);
    for (const shortcut of manifest.shortcuts) {
      expect(shortcut.url.startsWith('/')).toBe(true);
    }
  });

  it('ships 192px and 512px icons for both any and maskable purposes', () => {
    const expected = new Map<number, string[]>([
      [192, ['any', 'maskable']],
      [512, ['any', 'maskable']],
    ]);

    for (const [size, purposes] of expected) {
      for (const purpose of purposes) {
        const icon = manifest.icons.find(
          (entry: { sizes: string; purpose: string }) =>
            entry.sizes === `${size}x${size}` && entry.purpose === purpose,
        );
        expect(icon, `missing ${size}px ${purpose} icon`).toBeDefined();
        expect(icon.type).toBe('image/png');
        expect(pngSize(icon.src.replace(/^\//, 'public/'))).toEqual({
          width: size,
          height: size,
        });
      }
    }
  });

  it('keeps private surfaces and API responses out of the service worker cache', () => {
    const sw = read('public/sw.js');
    const privatePaths = [
      '/api',
      '/admin',
      '/attempt',
      '/dashboard',
      '/result',
      '/login',
      '/signup',
      '/forgot-password',
      '/reset-password',
      '/verify-email',
      '/dev',
      '/search',
    ];

    for (const path of privatePaths) {
      expect(sw).toContain(`"${path}"`);
    }
    expect(sw).toContain('request.method !== "GET"');
    expect(sw).toContain('x-pwa-cacheable');
    expect(sw).toContain('fetch(request).catch(() => offlineFallback())');
    expect(sw).toContain('OFFLINE_URL = "/offline"');
  });

  it('only marks anonymous HTML as cacheable on the server', () => {
    const middleware = read('src/middleware.ts');
    expect(middleware).toContain('x-pwa-cacheable');
    expect(middleware).toContain('!context.locals.user');
    expect(middleware).toContain('!isPrivatePath(pathname)');
    expect(middleware).toContain('text/html');
  });

  it('ships a self-contained, noindex offline fallback', () => {
    const offline = read('public/offline.html');
    expect(offline).toContain('noindex');
    expect(offline).toContain('You are offline');
    expect(offline).toContain('location.reload()');
    expect(offline).not.toMatch(/<script[^>]+src=/i);
    expect(offline).not.toMatch(/<link[^>]+href="https?:/i);
  });

  it('registers the service worker in production builds only', () => {
    const layout = read('src/layouts/BaseLayout.astro');
    expect(layout).toContain('rel="manifest"');
    expect(layout).toContain('apple-mobile-web-app-capable');
    expect(layout).toContain('mobile-web-app-capable');
    expect(layout).toContain('import.meta.env.PROD');
    expect(layout).toContain('navigator.serviceWorker.register("/sw.js")');
  });

  it('sets service worker and manifest response headers', () => {
    const headers = read('public/_headers');
    expect(headers).toContain('Service-Worker-Allowed: /');
    expect(headers).toContain('application/manifest+json');
    expect(headers).toMatch(/^\/offline$/m);
    expect(headers).toContain('X-Robots-Tag: noindex, nofollow');
  });
});
