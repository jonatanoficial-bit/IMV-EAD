// js/auth.js — auth estável no mobile (SEM cache bugado)
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

/**
 * Em mobile, isso evita perder sessão ao recarregar.
 */
export async function initAuthPersistence() {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch {
    // se falhar em algum navegador, segue sem quebrar
  }
}

/**
 * ✅ Espera autenticação ficar disponível.
 * - Se já existe auth.currentUser, retorna imediatamente.
 * - Senão, espera o próximo onAuthStateChanged.
 * - NÃO cacheia "null" (esse era o bug).
 */
export function waitForAuthUser() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user || null);
    });
  });
}

export async function login(email, password) {
  await initAuthPersistence();
  const cred = await signInWithEmailAndPassword(auth, email, password);

  // ✅ garante que o estado foi aplicado
  if (cred.user) return cred.user;

  // fallback (quase nunca necessário)
  const user = await waitForAuthUser();
  return user;
}

export async function logout() {
  await signOut(auth);
  window.location.href = "./index.html";
}

/** Lê o perfil em /users/{uid} */
export async function getMyProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * ✅ Requer usuário logado + perfil no Firestore
 */
export async function requireUserProfile() {
  // primeiro tenta direto (mais rápido)
  const userNow = auth.currentUser;
  const user = userNow || await waitForAuthUser();

  if (!user) throw new Error("Não autenticado.");

  const profile = await getMyProfile(user.uid);
  if (!profile) throw new Error("Usuário não cadastrado no Firestore (users/{uid}).");
  if (profile.active !== true) throw new Error("Usuário inativo.");
  return { uid: user.uid, profile };
}