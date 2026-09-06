// Ram Naam Counter Service Worker (v3)
const CACHE_NAME = 'ram-naam-v3';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './ram.mp3',
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

// Helper for HTTP Range requests (crucial for iOS Safari cached audio playback)
async function handleAudioRange(request, cachedResponse) {
  const rangeHeader = request.headers.get('range');
  if (!rangeHeader) return cachedResponse;

  try {
    const arrayBuffer = await cachedResponse.arrayBuffer();
    const bytes = /^bytes=(\d+)-(\d+)?$/i.exec(rangeHeader);
    if (!bytes) return cachedResponse;

    const total = arrayBuffer.byteLength;
    const start = parseInt(bytes[1], 10);
    const end = bytes[2] ? parseInt(bytes[2], 10) : total - 1;

    if (start >= total || end >= total) {
      return new Response(null, {
        status: 416,
        statusText: 'Range Not Satisfiable',
        headers: { 'Content-Range': `bytes */${total}` }
      });
    }

    const sliced = arrayBuffer.slice(start, end + 1);
    const headers = new Headers(cachedResponse.headers);
    headers.set('Content-Range', `bytes ${start}-${end}/${total}`);
    headers.set('Content-Length', `${sliced.byteLength}`);
    headers.set('Accept-Ranges', 'bytes');

    return new Response(sliced, {
      status: 206,
      statusText: 'Partial Content',
      headers
    });
  } catch (err) {
    return cachedResponse;
  }
}

// Fetch: Cache-first with network fallback and offline navigation support
self.addEventListener('fetch', event => {
  const request = event.request;

  // Only handle GET requests with http/https schemes
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
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

  // Handle static assets (audio, icons, manifest, html)
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(async cached => {
      if (cached) {
        // If range header requested (common for Safari audio)
        if (request.headers.has('range')) {
          return handleAudioRange(request, cached);
        }
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
        // If network failed and it's an audio or image, see if we have alternate match
        if (request.url.endsWith('.mp3')) {
          const fallbackAudio = await caches.match('./ram.mp3');
          if (fallbackAudio) {
            if (request.headers.has('range')) return handleAudioRange(request, fallbackAudio);
            return fallbackAudio;
          }
        }
        throw err;
      }
    })
  );
});
