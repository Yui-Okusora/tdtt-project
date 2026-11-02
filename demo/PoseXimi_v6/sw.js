/* PoseXimi PWA v6: offline application shell, never intercept API calls or uploaded photos. */
const VERSION = "poseximi-v6-palette-feedback-20261031";
const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./sw.js",
  "./css/base.css",
  "./css/auth.css",
  "./css/layout.css",
  "./css/home.css",
  "./css/poses.css",
  "./css/camera.css",
  "./css/library.css",
  "./css/utilities.css",
  "./css/responsive.css",
  "./css/theme.css",
  "./css/pwa.css",
  "./css/enhancements.css",
  "./css/v31.css",
  "./css/appearance.css",
  "./css/icons.css",
  "./css/signup.css",
  "./css/update-20261030.css",
  "./css/theme-components.css",
  "./css/palette-feedback.css",
  "./js/icons.js",
  "./js/app.js",
  "./js/pwa.js",
  "./js/data.js",
  "./js/state.js",
  "./js/ui.js",
  "./js/art.js",
  "./js/views/shared.js",
  "./js/views/home.js",
  "./js/views/quick-guide.js",
  "./js/data/quick-guide.js",
  "./js/views/poses.js",
  "./js/views/capture.js",
  "./js/views/result.js",
  "./js/views/library.js",
  "./js/services/ai.js",
  "./js/services/images.js",
  "./js/services/storage.js",
  "./js/services/camera.js",
  "./js/services/auth.js",
  "./js/services/appearance.js",
  "./js/services/font-safety.js",
  "./js/services/pose-feedback.js",
  "./js/services/signup-validation.js",
  "./js/views/appearance-picker.js",
  "./assets/style-casual.png",
  "./assets/style-fashion.png",
  "./assets/style-jojo.png",
  "./assets/guide/casual-1.webp",
  "./assets/guide/casual-2.webp",
  "./assets/guide/casual-3.webp",
  "./assets/guide/casual-4.webp",
  "./assets/guide/fashion-1.webp",
  "./assets/guide/fashion-2.webp",
  "./assets/guide/fashion-3.webp",
  "./assets/guide/fashion-4.webp",
  "./assets/guide/jojo-1.webp",
  "./assets/guide/jojo-2.webp",
  "./assets/guide/jojo-3.webp",
  "./assets/guide/jojo-4.webp",
  "./assets/poseximi-logo.png",
  "./assets/favicon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/apple-touch-icon.png",
];
const paths = new Set(
  APP_FILES.map((file) => new URL(file, self.registration.scope).pathname),
);
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(APP_FILES)),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (k) =>
              (k.startsWith("poselab-") || k.startsWith("poseximi-")) &&
              k !== VERSION,
          )
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.includes("/api/")
  )
    return;
  if (request.mode !== "navigate" && !paths.has(url.pathname)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone()).catch(() => {});
        return response;
      } catch {
        const saved = await cache.match(request, { ignoreSearch: true });
        return (
          saved ||
          (request.mode === "navigate"
            ? await cache.match("./index.html")
            : Response.error())
        );
      }
    })(),
  );
});
