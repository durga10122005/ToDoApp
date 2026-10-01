/**
 * Service Worker: Offline Caching & Cold Load Optimization
 */

const CACHE_NAME = 'todo-v2-cache-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/variables.css',
  '/css/base.css',
  '/css/layout.css',
  '/css/task-list.css',
  '/css/board.css',
  '/css/calendar.css',
  '/css/drawer.css',
  '/css/modals.css',
  '/js/app.js',
  '/js/state.js',
  '/js/storage.js',
  '/js/parser.js',
  '/js/auth/authClient.js',
  '/js/offline/indexedDb.js',
  '/js/offline/syncEngine.js',
  '/js/security/sanitizer.js',
  '/js/components/quickAdd.js',
  '/js/components/commandPalette.js',
  '/js/components/taskDrawer.js',
  '/js/components/shortcuts.js',
  '/js/components/toast.js',
  '/js/views/listView.js',
  '/js/views/boardView.js',
  '/js/views/calendarView.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Bypass Service Worker for API calls (handled by syncEngine)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. Stale-While-Revalidate for Static Assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // If offline and not in cache, fallback
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
