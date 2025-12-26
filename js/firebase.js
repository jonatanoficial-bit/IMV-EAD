// js/firebase.js
import {
  initializeApp,
  getApps,
  getApp,
  deleteApp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

/**
 * ATENÇÃO:
 * Cole aqui o firebaseConfig REAL do seu projeto.
 * Se ficar "SUA_API_KEY" ou "COLE..." vai dar exatamente o erro do print.
 */
const firebaseConfig = {
  apiKey: "COLE_AQUI_A_API_KEY_REAL",
  authDomain: "COLE_AQUI_O_AUTH_DOMAIN_REAL",
  projectId: "COLE_AQUI_O_PROJECT_ID_REAL",
  storageBucket: "COLE_AQUI_O_STORAGE_BUCKET_REAL",
  messagingSenderId: "COLE_AQUI_O_MESSAGING_SENDER_ID_REAL",
  appId: "COLE_AQUI_O_APP_ID_REAL"
  // measurementId: "..." (opcional)
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * App secundário para cadastrar usuário sem deslogar o Admin
 */
export async function createSecondaryAuth() {
  const name = "secondary";

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