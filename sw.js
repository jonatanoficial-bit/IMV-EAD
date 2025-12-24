// sw.js — cache simples e estável (sem quebrar login)
// ✅ IMPORTANTE: versão nova para forçar update e não ficar preso no cache antigo
const CACHE_NAME = "imv-ea-v3";

const ASSETS = [
  "./",
  "./index.html",
  "./admin.html",
  "./teacher.html",
  "./student.html",
  "./css/styles.css",
  "./js/firebase.js",
  "./js/auth.js",
  "./js/router.js",
  "./js/admin.js",
  "./js/teacher.js",
  "./js/student.js",
  "./manifest.webmanifest",
  "./assets/logo-imv.png"
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