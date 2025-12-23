// js/admin.js
import { requireAuth } from "./router.js";
import { watchAuth, logout, getUserProfile, generateRandomPassword, ensureSecondaryAuth, upsertUserProfile } from "./auth.js";

import {
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

// Protege esta página: somente admin
requireAuth(["admin"]);

const $ = (id) => document.getElementById(id);

function showBox(el, text, isError=false){
  el.style.display = "block";
  el.textContent = text;
  el.style.borderColor = isError ? "rgba(255,92,122,.45)" : "rgba(72,213,151,.35)";
  el.style.background = isError ? "rgba(255,92,122,.10)" : "rgba(72,213,151,.08)";
}

watchAuth(async (user) => {
  if (!user) return;
  const profile = await getUserProfile(user.uid);
  $("who").textContent = profile?.name ? `${profile.name} • (${profile.role})` : `${user.email} • (admin)`;
});

$("btnLogout").addEventListener("click", async () => {
  await logout();
});

async function createUser(role, name, email) {
  if (!name || !email) throw new Error("Preencha nome e email.");

  const pass = generateRandomPassword(10);
  const secAuth = ensureSecondaryAuth();

  const cred = await createUserWithEmailAndPassword(secAuth, email, pass);

  await upsertUserProfile({
    uid: cred.user.uid,
    name,
    role,
    email
  });

  return { uid: cred.user.uid, email, password: pass };
}

$("btnCreateStudent").addEventListener("click", async () => {
  const out = $("outStudent");
  out.style.display = "none";

  try {
    const name = $("sName").value.trim();
    const email = $("sEmail").value.trim();

    const created = await createUser("student", name, email);
    showBox(out, `✅ Aluno criado!\nEmail: ${created.email}\nSenha: ${created.password}\nUID: ${created.uid}`);
    $("sName").value = "";
    $("sEmail").value = "";
  } catch (e) {
    console.error(e);
    showBox(out, "❌ Erro: " + (e?.message || e), true);
  }
});

$("btnCreateTeacher").addEventListener("click", async () => {
  const out = $("outTeacher");
  out.style.display = "none";

  try {
    const name = $("tName").value.trim();
    const email = $("tEmail").value.trim();

    const created = await createUser("teacher", name, email);
    showBox(out, `✅ Professor criado!\nEmail: ${created.email}\nSenha: ${created.password}\nUID: ${created.uid}`);
    $("tName").value = "";
    $("tEmail").value = "";
  } catch (e) {
    console.error(e);
    showBox(out, "❌ Erro: " + (e?.message || e), true);
  }
});