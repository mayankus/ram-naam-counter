// Ram Naam Counter Service Worker (v7)
const CACHE_NAME = 'ram-naam-v7';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './firebase-config.js',
  './icon-192.png',
  './icon-512.png',
  './favicon.svg'
];

// Install: Cache all core assets safely
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Use Promise.allSettled so a temporary failure in one asset doesn't abort the entire install
      const results = await Promise.allSettled(
        CORE_ASSETS.map(url =>
          cache.add(new Request(url, { cache: 'reload' })).catch(err => {
            console.warn('[SW] Pre-cache failed for:', url, err);
          })
        )
      );
      console.log('[SW] Installed and cached core assets:', results);
    })
  );
  self.skipWaiting();
});

// Activate: Clean up old caches immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// Fetch: Cache-first with network fallback and offline navigation support
self.addEventListener('fetch', event => {
  const request = event.request;

  // Only handle GET requests with http/https schemes
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  // Bypass Firebase Auth, Firestore streams, and Google Identity APIs so network handles them directly
  if (
    request.url.includes('identitytoolkit.googleapis.com') ||
    request.url.includes('firestore.googleapis.com') ||
    request.url.includes('securetoken.googleapis.com') ||
    request.url.includes('accounts.google.com') ||
    request.url.includes('firebaseio.com')
  ) {
    return;
  }

  // Handle navigation requests (page visits / refreshes)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          // Offline navigation fallback: try exact match or fall back to index.html
          const cached = (await caches.match(request)) || (await caches.match('./index.html')) || (await caches.match('./'));
          if (cached) return cached;
          return new Response('Offline: Ram Naam Counter is ready in cache. Please reopen the app.', {
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
    return;
  }

  // Handle static assets (icons, manifest, html, scripts)
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(async cached => {
      if (cached) {
        return cached;
      }

      // If not cached, fetch from network and dynamically cache
      try {
        const response = await fetch(request);
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      } catch (err) {
        throw err;
      }
    })
  );
});
