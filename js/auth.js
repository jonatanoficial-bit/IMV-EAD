// js/auth.js — auth estável (espera onAuthStateChanged)
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

let _authReadyPromise = null;
let _lastUser = null;

export async function initAuthPersistence() {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch {
    // se falhar em algum navegador, segue sem quebrar
  }
}

/**
 * ✅ Espera a autenticação ficar pronta no mobile.
 * Retorna: user (Firebase Auth user) ou null.
 */
export function waitForAuthReady() {
  if (_authReadyPromise) return _authReadyPromise;

  _authReadyPromise = new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      _lastUser = user || null;
      unsub();
      resolve(_lastUser);
    });
  });

  return _authReadyPromise;
}

export function getAuthUserNow() {
  return auth.currentUser || _lastUser || null;
}

export async function login(email, password) {
  await initAuthPersistence();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
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

/** Espera auth e já devolve { uid, profile } ou joga erro */
export async function requireUserProfile() {
  const user = await waitForAuthReady();
  if (!user) throw new Error("Não autenticado.");
  const profile = await getMyProfile(user.uid);
  if (!profile) throw new Error("Usuário não cadastrado no Firestore (users/{uid}).");
  if (profile.active !== true) throw new Error("Usuário inativo.");
  return { uid: user.uid, profile };
}