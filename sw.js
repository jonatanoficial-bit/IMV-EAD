// sw.js — cache simples para PWA (leve e estável)
const CACHE_NAME = "imv-ea-v3"; // ✅ troquei v1 -> v3 para forçar limpar cache

const ASSETS = [
  "./",
  "./index.html",
  "./admin.html",
  "./teacher.html",
  "./student.html",
  "./css/styles.css",

  // JS
  "./js/firebase.js",
  "./js/auth.js",
  "./js/router.js",
  "./js/admin.js",
  "./js/teacher.js",
  "./js/student.js",

  // PWA
  "./manifest.webmanifest",

  // Assets
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

// ✅ Estratégia: network-first para arquivos críticos (evita ficar preso no cache)
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // só trata arquivos do próprio site
  if (url.origin !== self.location.origin) return;

  const isCritical =
    url.pathname.endsWith("/js/firebase.js") ||
    url.pathname.endsWith("/js/auth.js") ||
    url.pathname.endsWith("/js/router.js") ||
    url.pathname.endsWith("/index.html");

  if (isCritical) {
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // resto: cache-first
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});