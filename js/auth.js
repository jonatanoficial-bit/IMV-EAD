// /js/auth.js
import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

export function listenAuth(cb) {
  return onAuthStateChanged(auth, (user) => cb(user));
}

export async function loadMyProfileOrThrow() {
  const user = auth.currentUser;
  if (!user) throw new Error("Não autenticado.");

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Perfil não encontrado em Firestore: users/{uid}.");
  }

  const data = snap.data() || {};
  if (data.active !== true) {
    throw new Error("Usuário inativo (active != true) no Firestore.");
  }

  const role = data.role;
  if (!role || !["admin", "teacher", "student"].includes(role)) {
    throw new Error('Role inválida no Firestore. Use: "admin", "teacher" ou "student".');
  }

  return { user, profile: data, role };
}

export async function logout() {
  await signOut(auth);
}