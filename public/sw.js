const CACHE_NAME = 'scoutfn-offline-v1';
const PRECACHE_URLS = ['/manifest.json', '/app_logo.jpg', '/logo.jpg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Jangan pernah cache endpoint API agar auth dan data server selalu segar
  if (url.pathname.startsWith('/api/')) return;

  // 1. Aset statis Next.js (_next/static) & gambar lokal: Cache-First / Stale-While-Revalidate
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/manifest.json' ||
    /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok && response.type === 'basic') {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
    return;
  }

  // 2. Halaman navigasi /scan (dan RSC payload-nya): Network-First dengan fallback Cache saat offline
  if (
    request.mode === 'navigate' &&
    (url.pathname === '/scan' || url.pathname.startsWith('/scan/'))
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/scan', copy)).catch(() => {});
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/scan'))
        )
    );
  }
});

// Background Sync (Android Chrome/Edge): beri tahu client terbuka untuk menjalankan sync antrean
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-attendance') {
    event.waitUntil(
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => {
          for (const client of clients) {
            client.postMessage({ type: 'TRIGGER_ATTENDANCE_SYNC' });
          }
        })
    );
  }
});
