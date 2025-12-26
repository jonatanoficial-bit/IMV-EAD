// sw.js — cache estável (NÃO cacheia firebase.js pra não travar config)
const CACHE_VERSION = "imv-ead-v9"; // MUDE sempre que atualizar
const CACHE_NAME = CACHE_VERSION;

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./admin.html",
  "./teacher.html",
  "./student.html",
  "./css/styles.css",

  // cache OK para JS que não muda config do firebase
  "./js/auth.js",
  "./js/router.js",
  "./js/admin.js",
  "./js/teacher.js",
  "./js/student.js",

  "./manifest.webmanifest",
  "./assets/logo-imv.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

// Não cachear firebase.js (pra não ficar preso em apiKey antiga)
const NEVER_CACHE = [
  "/js/firebase.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
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
  const url = new URL(event.request.url);

  // Só controlar requests do seu próprio site
  if (url.origin !== self.location.origin) return;

  // Nunca cachear firebase.js
  if (NEVER_CACHE.some((p) => url.pathname.endsWith(p))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-first para HTML (evita tela velha)
  if (event.request.mode === "navigate" || url.pathname.endsWith(".html")) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first para assets estáticos
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});