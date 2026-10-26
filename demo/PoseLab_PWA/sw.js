/* PoseLab offline shell. Cache only local UI files, never uploaded pictures or API responses. */
const VERSION = 'poselab-pwa-v1-20261026';
const APP_FILES = [
  './', './index.html', './styles.css', './app.js', './pwa.js',
  './manifest.webmanifest', './assets/favicon.svg',
  './assets/icon-192.png', './assets/icon-512.png',
  './assets/icon-maskable-512.png', './assets/apple-touch-icon.png'
];
const APP_PATHS = new Set(APP_FILES.map((file) => new URL(file, self.registration.scope).pathname));
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(APP_FILES)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('poselab-pwa-') && key !== VERSION).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  if (!request.mode.includes('navigate') && !APP_PATHS.has(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const response = await fetch(request);
      if (response.ok && (request.mode === 'navigate' || APP_PATHS.has(url.pathname))) {
        // Store successful local app-shell responses for offline reloads.
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const saved = await cache.match(request, {ignoreSearch:true});
      if (saved) return saved;
      if (request.mode === 'navigate') {
        const fallback = await cache.match('./index.html');
        if (fallback) return fallback;
      }
      return Response.error();
    }
  })());
});
