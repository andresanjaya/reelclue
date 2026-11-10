/**
 * ReelClue Service Worker
 *
 * Implements a safe app-shell caching strategy with strict exclusions:
 * - App-shell & static assets: cached for speed and offline navigation fallback.
 * - Private game APIs (/api/games, /api/daily, /api/movies, /api/player): NEVER CACHED.
 * - Guesses & session state: NEVER CACHED in shared or SW storage. Server is the sole authority.
 */

const CACHE_VERSION = 'reelclue-v1';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const PRECACHE_URLS = [
  '/offline',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/icons/apple-touch-icon.png',
];

/**
 * Checks whether a given request URL matches private game APIs, guesses, sessions,
 * or environment-dependent routes that must NEVER be stored in service worker caches.
 */
function isExcludedRoute(url) {
  const pathname = url.pathname;

  // 1. Private game APIs (sessions, rounds, guesses, hints, skips, results, poster blur bytes)
  if (pathname.startsWith('/api/games')) return true;

  // 2. Movie search and suggestions API
  if (pathname.startsWith('/api/movies')) return true;

  // 3. Daily challenge puzzle state and play submission
  if (pathname.startsWith('/api/daily')) return true;

  // 4. Session-cookie player state
  if (pathname.startsWith('/api/player')) return true;

  // 5. Health checks
  if (pathname.startsWith('/api/health')) return true;

  // 6. Active game session page (contains live round state)
  if (pathname.startsWith('/play/') && pathname !== '/play') return true;

  return false;
}

// Install Event: Pre-cache app shell fallback and icons
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up outdated caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== APP_SHELL_CACHE && key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch Event: Network-only for private routes; network-first with offline fallback for navigation
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Cross-origin requests: ignore (e.g., external analytics, TMDB CDNs if any)
  if (url.origin !== self.location.origin) {
    return;
  }

  // Strictly exclude private game APIs, guesses, session state, and search
  if (isExcludedRoute(url)) {
    // Network-only: direct fetch, no caching
    return;
  }

  // Navigation requests: Network-first, fallback to /offline page if offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(APP_SHELL_CACHE);
        const cachedOffline = await cache.match('/offline');
        if (cachedOffline) {
          return cachedOffline;
        }
        return new Response('You are offline. Please reconnect to continue.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })
    );
    return;
  }

  // Static immutable Next.js chunks and icons: Cache-first with network fallback
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Other standard GET requests: Network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});

// Message Event: Allow client to trigger skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
