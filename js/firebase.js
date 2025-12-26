// js/firebase.js
import { initializeApp, getApps, getApp, deleteApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// >>> COLE AQUI O SEU CONFIG REAL (o que já funcionava antes) <<<
const firebaseConfig = {
  apiKey: "COLE_SUA_API_KEY_REAL",
  authDomain: "COLE_SEU_AUTH_DOMAIN_REAL",
  projectId: "COLE_SEU_PROJECT_ID_REAL",
  storageBucket: "COLE_SEU_STORAGE_BUCKET_REAL",
  messagingSenderId: "COLE_SEU_SENDER_ID_REAL",
  appId: "COLE_SEU_APP_ID_REAL",
  measurementId: "COLE_SEU_MEASUREMENT_ID_SE_TIVER"
};

// App principal
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * Cria um "app secundário" só para cadastrar usuários sem derrubar a sessão do admin.
 * Retorna { sApp, sAuth, cleanup() }.
 */
export async function createSecondaryAuth() {
  // nome fixo pra evitar conflito
  const name = "secondary";
  // se já existir, apaga e recria (evita bug de estado em mobile)
  const existing = getApps().find(a => a.name === name);
  if (existing) {
    try { await deleteApp(existing); } catch {}
  }

  const sApp = initializeApp(firebaseConfig, name);
  const sAuth = getAuth(sApp);

  return {
    sApp,
    sAuth,
    cleanup: async () => {
      try { await deleteApp(sApp); } catch {}
    }
  };
}