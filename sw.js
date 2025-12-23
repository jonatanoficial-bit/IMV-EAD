// sw.js — cache simples para PWA (leve e estável) + correção forte de atualização
const CACHE_NAME = "imv-ea-v6"; // ✅ aumente sempre que mexer no app para quebrar cache

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
  const url = new URL(event.request.url);

  // Só tratar requisições do próprio site
  if (url.origin !== self.location.origin) return;

  // ✅ Arquivos críticos sempre "network-first" para nunca ficar preso em versão antiga
  const criticalPaths = [
    "/IMV-EAD/index.html",
    "/IMV-EAD/admin.html",
    "/IMV-EAD/teacher.html",
    "/IMV-EAD/student.html",
    "/IMV-EAD/js/admin.js",
    "/IMV-EAD/js/firebase.js",
    "/IMV-EAD/js/auth.js",
    "/IMV-EAD/js/router.js",
    "/IMV-EAD/js/teacher.js",
    "/IMV-EAD/js/student.js"
  ];

  const isCritical = criticalPaths.some((p) => url.pathname.endsWith(p.replace("/IMV-EAD", "")) || url.pathname === p);

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

  // Resto: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});