// sw.js — MODO SAFE (SEM CACHE)
// Objetivo: parar tela piscando / branco causado por cache antigo/corrompido.
// Quando tudo estabilizar, a gente reativa cache com cuidado.

self.addEventListener("install", (event) => {
  // ativa imediatamente
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // apaga TODOS os caches antigos pra não “puxar JS velho”
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Não intercepta fetch => sempre pega da rede (GitHub Pages)
// Isso elimina “JS antigo” e loop do SW.
self.addEventListener("fetch", (event) => {
  return;
});