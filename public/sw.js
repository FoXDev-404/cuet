/*
 * CUET Free Mock Test service worker.
 *
 * Privacy rules:
 * - Never cache /api responses, admin pages, attempt pages, dashboards, results,
 *   authentication screens or any other authenticated surface.
 * - HTML is only cached when the server explicitly marks the anonymous response
 *   with `x-pwa-cacheable: 1` (see src/middleware.ts). This keeps a logged-in
 *   user's personalized HTML out of Cache Storage.
 *
 * Bump VERSION whenever precached static files change.
 */
const VERSION = "v1";

const STATIC_CACHE = `cuet-static-${VERSION}`;
const PAGES_CACHE = `cuet-pages-${VERSION}`;
const CACHE_PREFIX = "cuet-";

const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.svg",
  "/logo.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-192.png",
  "/icons/maskable-512.png",
];

const PRIVATE_PREFIXES = [
  "/api",
  "/admin",
  "/attempt",
  "/dashboard",
  "/result",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/dev",
  "/search",
];

function isPrivatePath(pathname) {
  return PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isCacheableAsset(pathname) {
  return (
    pathname.startsWith("/_astro/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/local-papers/") ||
    pathname.startsWith("/og/") ||
    pathname === "/favicon.svg" ||
    pathname === "/logo.svg" ||
    pathname === "/logo.png" ||
    pathname === "/apple-touch-icon.png" ||
    pathname === "/manifest.webmanifest" ||
    /\.(?:css|js|mjs|woff2?|ttf|otf|png|jpe?g|webp|avif|gif|svg|ico)$/i.test(pathname)
  );
}

async function precache() {
  const cache = await caches.open(STATIC_CACHE);
  await Promise.allSettled(
    PRECACHE_URLS.map(async (url) => {
      const response = await fetch(new Request(url, { cache: "reload" }));
      if (response.ok) await cache.put(url, response);
    }),
  );
}

async function offlineFallback() {
  const offline = await caches.match(OFFLINE_URL);
  if (offline) return offline;

  return new Response("You appear to be offline. Reconnect and try again.", {
    status: 503,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.headers.get("x-pwa-cacheable") === "1") {
      const cache = await caches.open(PAGES_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(PAGES_CACHE);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;

    return offlineFallback();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await precache();
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== STATIC_CACHE && key !== PAGES_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.headers.has("range")) return;

  // Private and API routes are never cached. Navigations still receive the
  // offline fallback when the network is unavailable.
  if (isPrivatePath(url.pathname)) {
    if (request.mode === "navigate") {
      event.respondWith(fetch(request).catch(() => offlineFallback()));
    }
    return;
  }

  if (url.pathname === OFFLINE_URL || url.pathname === "/manifest.webmanifest") {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isCacheableAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});
