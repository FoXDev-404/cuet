/*
 * CUET Free Mock Test service worker.
 *
 * Strategy:
 *  - app shell and static assets: cache first, refresh in the background
 *  - navigations: network first, fall back to the cached page then /offline/
 *  - public test JSON: stale-while-revalidate
 *  - API, auth proxy and non-GET requests: never cached
 *
 * Bump CACHE_VERSION when the caching rules or the shell change so old
 * caches are removed on activate.
 */
const CACHE_VERSION = '2026-11-06-1';
const SHELL_CACHE = `cuet-shell-${CACHE_VERSION}`;
const PAGE_CACHE = `cuet-pages-${CACHE_VERSION}`;
const ASSET_CACHE = `cuet-assets-${CACHE_VERSION}`;
const DATA_CACHE = `cuet-data-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline';
const PRECACHE = [
  OFFLINE_URL,
  '/',
  '/mock-tests',
  '/cuet-ug-mock-test',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];
const PRIVATE_PREFIXES = ["/dashboard", "/admin", "/attempt", "/result", "/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })))),
      ),
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, PAGE_CACHE, ASSET_CACHE, DATA_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isCacheableResponse(response) {
  return Boolean(response && response.ok && response.type === 'basic');
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheableResponse(response)) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (isCacheableResponse(response)) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  if (cached) {
    network.catch(() => undefined);
    return cached;
  }
  const response = await network;
  return response || new Response('', { status: 504, statusText: 'Offline' });
}

async function networkFirstNavigation(request) {
  const url = new URL(request.url);
  const isPrivate = PRIVATE_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(prefix + "/"));
  const pageCache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    // Never persist private HTML (dashboard, attempts, results, admin, auth).
    if (!isPrivate && isCacheableResponse(response)) await pageCache.put(request, response.clone());
    return response;
  } catch (error) {
    if (isPrivate) {
      return new Response('You are offline. Reconnect to view this private page.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    const cached = await pageCache.match(request);
    if (cached) return cached;
    const shell = await caches.match(request);
    if (shell) return shell;
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response('You are offline. Reconnect and try again.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/__/')) return;
  if (request.headers.has('range')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.pathname.startsWith('/data/')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (
    url.pathname.startsWith('/_astro/') ||
    url.pathname.startsWith('/pagefind/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|webp|svg|ico)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
  }
});
