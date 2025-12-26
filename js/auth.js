// js/auth.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut as fbSignOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

export function $(id) {
  return document.getElementById(id);
}

export function nowISO() {
  return new Date().toISOString();
}

export function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

export function setHTML(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}

export function setStatus(msg, type = "info") {
  // type: info | ok | warn | err
  const box = $("statusBox");
  if (!box) return;
  box.className = `status status--${type}`;
  box.textContent = msg;
}

export async function getMyProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Perfil não encontrado em /users/{uid}.");
  return snap.data();
}

export function requireRole(allowedRoles = []) {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) throw new Error("Não autenticado.");
        const profile = await getMyProfile(user.uid);

        if (profile?.active === false) {
          throw new Error("Usuário desativado (active=false).");
        }
        const role = profile?.role;
        if (!role) throw new Error("Perfil sem role em /users/{uid}.");

        if (allowedRoles.length && !allowedRoles.includes(role)) {
          throw new Error(`Acesso negado. Role atual: ${role}`);
        }

        resolve({ user, profile });
      } catch (e) {
        reject(e);
      }
    });
  });
}

export async function signOut() {
  await fbSignOut(auth);
}