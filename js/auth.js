// js/auth.js
import { auth, db, firebaseConfig } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  initializeAuth,
  getAuth,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";

/**
 * Importante:
 * Para Admin criar usuários (alunos/professores) sem derrubar o login do admin,
 * usamos um "secondary app" + "secondary auth".
 */
let secondaryApp = null;
let secondaryAuth = null;

export function ensureSecondaryAuth() {
  if (!secondaryApp) {
    secondaryApp = initializeApp(firebaseConfig, "secondary");
    secondaryAuth = getAuth(secondaryApp);
  }
  return secondaryAuth;
}

export function generateRandomPassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#!?";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function getUserRole(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data()?.role || null;
}

export async function getUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

/**
 * Cria/atualiza o perfil no Firestore (users/{uid})
 */
export async function upsertUserProfile({ uid, name, role, email }) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, {
    name: name || "",
    role,
    email: email || "",
    active: true,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  }, { merge: true });
}