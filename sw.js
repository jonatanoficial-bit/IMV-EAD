// sw.js — cache simples para PWA (leve e estável)
// IMPORTANTE: troque o CACHE_NAME sempre que atualizar arquivos JS/HTML
// para forçar atualização no celular e evitar "JS antigo" quebrar login/turmas.

const CACHE_NAME = "imv-ead-v10"; // <<< MUDE O NÚMERO SE PRECISAR NO FUTURO

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

// Instalando: baixa tudo e ativa novo cache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        await cache.addAll(ASSETS);
      } catch (e) {
        // Se algum arquivo falhar, ainda instala. Evita quebrar PWA por 1 arquivo
        // (ex.: caminho errado momentâneo).
        console.warn("Cache addAll falhou em algum asset:", e);
      }
    })
  );
  self.skipWaiting();
});

// Ativando: remove caches antigos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first (rápido) com fallback para rede
self.addEventListener("fetch", (event) => {
  // Só GET
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((resp) => {
          // Atualiza cache em background para requisições do mesmo domínio
          const url = new URL(event.request.url);
          const isSameOrigin = url.origin === self.location.origin;

          if (isSameOrigin) {
            const respClone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respClone));
          }
          return resp;
        })
        .catch(() => cached); // fallback
    })
  );
});