// js/index.js
// Entry-point da tela de login.
// ✅ GARANTE que o login.js realmente execute.

import "./login.js";

// (Opcional) Service Worker – se tiver dando confusão, comente este bloco.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
      console.log("[SW] registrado");
    } catch (e) {
      console.log("[SW] falhou", e);
    }
  });
}