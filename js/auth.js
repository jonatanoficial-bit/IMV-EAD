// js/auth.js
import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

export function normalizeRole(role) {
  const r = String(role || "").trim().toLowerCase();
  // padroniza possíveis variações
  if (r === "professor" || r === "prof") return "teacher";
  if (r === "aluno" || r === "student") return "student";
  if (r === "admin" || r === "adm") return "admin";
  return r; // teacher/student/admin ou vazio
}

export async function signIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signOut() {
  await fbSignOut(auth);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function getMyProfile() {
  const user = auth.currentUser;
  if (!user) {
    return { user: null, profile: null, role: null };
  }

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return { user, profile: null, role: null, error: "Perfil não existe em users/{uid}." };
  }

  const profile = snap.data() || {};
  const active = profile.active === true;
  const role = normalizeRole(profile.role);

  if (!active) {
    return { user, profile, role, error: "Usuário inativo (active != true)." };
  }

  if (!role || !["admin", "teacher", "student"].includes(role)) {
    return { user, profile, role: null, error: "Role inválida ou vazia. Use admin/teacher/student." };
  }

  return { user, profile, role };
}

export function showBanner(msg, type = "error") {
  const el = document.getElementById("banner");
  if (!el) {
    alert(msg);
    return;
  }
  el.className = `banner ${type}`;
  el.textContent = msg;
  el.style.display = "block";
}

export function hideBanner() {
  const el = document.getElementById("banner");
  if (el) el.style.display = "none";
}