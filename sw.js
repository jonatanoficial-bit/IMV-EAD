// sw.js — cache simples para PWA (leve e estável)
const CACHE_NAME = "imv-ea-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./admin.html",
  "./teacher.html",
  "./student.html",
  "./library.html",
  "./css/styles.css",
  "./js/firebase.js",
  "./js/auth.js",
  "./js/router.js",
  "./js/admin.js",
  "./js/teacher.js",
  "./js/student.js",
  "./js/library.js",
  "./js/markdown.js",
  "./manifest.webmanifest",
  "./assets/logo-imv.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});