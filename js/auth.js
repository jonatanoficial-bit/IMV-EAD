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
  if (r === "professor" || r === "prof") return "teacher";
  if (r === "aluno") return "student";
  if (r === "adm") return "admin";
  return r; // teacher/admin/student
}

export async function signIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signOut() {
  await fbSignOut(auth);
}

export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

export async function getProfileByUid(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { exists: false, profile: null };
  return { exists: true, profile: snap.data() || {} };
}

export async function getMyProfileOrThrow() {
  const user = auth.currentUser;
  if (!user) throw new Error("NOT_LOGGED");

  const { exists, profile } = await getProfileByUid(user.uid);
  if (!exists) throw new Error("PROFILE_NOT_FOUND");

  if (profile.active !== true) throw new Error("USER_INACTIVE");

  const role = normalizeRole(profile.role);
  if (!["admin", "teacher", "student"].includes(role)) throw new Error("ROLE_INVALID");

  return { user, profile, role };
}