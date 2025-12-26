// js/auth.js
import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

let _sessionPromise = null;
let _cached = { user: null, profile: null };

export function resetAuthCache() {
  _sessionPromise = null;
  _cached = { user: null, profile: null };
}

export function requireEl(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento #${id} não encontrado no DOM`);
  return el;
}

export function logTo(preEl, ...args) {
  const t = new Date().toLocaleTimeString();
  const line = `[${t}] ${args.join(" ")}`;
  console.log(line);
  if (preEl) preEl.textContent += line + "\n";
}

export function setMsg(msgEl, text, mode = "info") {
  if (!msgEl) return;
  msgEl.textContent = text || "";
  msgEl.dataset.mode = mode;
  msgEl.style.display = text ? "block" : "none";
}

async function readProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Perfil não encontrado no Firestore (users/uid).");
  return snap.data();
}

/**
 * ✅ CHAVE DO “NÃO AUTENTICADO”:
 * a gente só lê o Firestore depois que o Firebase Auth confirmou o user no onAuthStateChanged
 */
export function getSession(preLog = null) {
  if (_sessionPromise) return _sessionPromise;

  _sessionPromise = new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();

      if (!user) {
        _cached = { user: null, profile: null };
        resolve(_cached);
        return;
      }

      try {
        const profile = await readProfile(user.uid);
        _cached = { user, profile };
        resolve(_cached);
      } catch (e) {
        logTo(preLog, "ERRO lendo perfil:", e?.message || e);
        _cached = { user, profile: null, error: e };
        resolve(_cached);
      }
    });
  });

  return _sessionPromise;
}

export async function guardPage({ allowRoles = [], redirectTo = "./index.html" } = {}, preLog = null) {
  const s = await getSession(preLog);
  if (!s.user) {
    logTo(preLog, "Guard: sem sessão. Redirecionando.");
    location.replace(redirectTo);
    return null;
  }
  if (!s.profile) {
    logTo(preLog, "Guard: sem perfil em /users. Fazendo logout.");
    await safeLogout();
    location.replace("./index.html?e=perfil");
    return null;
  }

  const role = s.profile.role || "student";
  if (allowRoles.length && !allowRoles.includes(role)) {
    logTo(preLog, `Guard: role ${role} não permitido aqui.`);
    location.replace("./index.html?e=permissao");
    return null;
  }

  return s;
}

export async function safeLogout() {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn("Logout falhou:", e);
  } finally {
    resetAuthCache();