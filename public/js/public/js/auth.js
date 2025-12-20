import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import {
  doc, getDoc, setDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// LOGIN
export async function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

// LOGOUT
export function logout() {
  return signOut(auth);
}

// OBSERVAR LOGIN
export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

// CADASTRO COM CONVITE (ADMIN CRIA O CONVITE)
export async function signupWithInvite({ name, email, password, code }) {
  const inviteRef = doc(db, "invites", code);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) throw "Convite inválido.";
  const invite = inviteSnap.data();

  if (invite.used) throw "Convite já utilizado.";
  if (invite.email.toLowerCase() !== email.toLowerCase())
    throw "Convite não corresponde ao email.";

  const cred = await createUserWithEmailAndPassword(auth, email, password);

  await setDoc(doc(db, "users", cred.user.uid), {
    name,
    email,
    role: invite.role, // admin, teacher, staff, student
    active: true,
    createdAt: Date.now()
  });

  await updateDoc(inviteRef, {
    used: true,
    usedBy: cred.user.uid,
    usedAt: Date.now()
  });
}

// OBTER PAPEL DO USUÁRIO
export async function getMyRole() {
  if (!auth.currentUser) return null;
  const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
  return snap.exists() ? snap.data().role : null;
}
