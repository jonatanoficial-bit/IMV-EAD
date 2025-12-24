// js/auth.js
import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

export function qs(sel, root = document) {
  return root.querySelector(sel);
}

export function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

export function safeText(el, txt) {
  if (!el) return;
  el.textContent = txt ?? "";
}

export function setBusy(btn, busy, label = "Entrar") {
  if (!btn) return;
  btn.disabled = !!busy;
  btn.dataset._label = btn.dataset._label || btn.textContent;
  btn.textContent = busy ? "Carregando..." : (label || btn.dataset._label);
}

export async function login(email, password) {
  if (!email || !password) throw new Error("Preencha e-mail e senha.");
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}

export function onAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

export async function getMyProfile(uid) {
  if (!uid) return null;
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export function friendlyFirebaseError(err) {
  const msg = (err?.message || "").toLowerCase();

  if (msg.includes("auth/invalid-credential")) return "Credenciais inválidas. Confira e-mail e senha.";
  if (msg.includes("auth/wrong-password")) return "Senha incorreta.";
  if (msg.includes("auth/user-not-found")) return "Usuário não encontrado.";
  if (msg.includes("auth/too-many-requests")) return "Muitas tentativas. Aguarde e tente novamente.";
  if (msg.includes("api-key-not-valid")) return "Configuração do Firebase inválida (API KEY). Verifique js/firebase.js.";
  if (msg.includes("missing or insufficient permissions")) return "Permissão insuficiente no Firestore (Rules).";

  return err?.message || "Erro ao entrar.";
}