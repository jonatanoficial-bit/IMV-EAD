// js/login.js
import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { goToRoleHome } from "./router.js";

const $ = (id) => document.getElementById(id);

function log(msg) {
  const box = $("logBox");
  const time = new Date().toLocaleTimeString("pt-BR", { hour12: false });
  if (box) box.textContent += `[${time}] ${msg}\n`;
  console.log(msg);
}

async function readProfile(uid) {
  log("Lendo perfil do usuário (Firestore /users/{uid})...");
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Perfil não encontrado em /users/{uid}.");
  return snap.data();
}

function boot() {
  log("JS do login carregou (login.js).");

  const form = $("loginForm");
  const btnClear = $("btnClear");

  if (!form) {
    log("ERRO: #loginForm não existe no HTML.");
    return;
  }

  // limpar
  if (btnClear) {
    btnClear.addEventListener("click", () => {
      $("email").value = "";
      $("password").value = "";
      log("Campos limpos.");
      $("email").focus();
    });
  }

  // sessão existente
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      log("Sem sessão ativa.");
      return;
    }
    try {
      log("Sessão existente detectada (Auth).");
      const profile = await readProfile(user.uid);
      log(`Perfil OK: role=${profile.role || "?"}`);
      goToRoleHome(profile.role);
    } catch (e) {
      log(`Sessão existe, mas falhou perfil: ${e.message}`);
    }
  });

  // submit
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault(); // ✅ impede reload (que apaga email/senha)

    const email = ($("email").value || "").trim().toLowerCase();
    const password = $("password").value || "";

    log("Submit disparado (Enter ou botão).");
    if (!email || !password) {
      log("ERRO: Email/senha vazios.");
      return;
    }

    try {
      log("Tentando login no Firebase Auth...");
      const cred = await signInWithEmailAndPassword(auth, email, password);
      log("Firebase Auth OK (email/senha).");

      const profile = await readProfile(cred.user.uid);
      log(`Perfil OK: role=${profile.role || "?"}`);

      goToRoleHome(profile.role);
    } catch (e) {
      log(`ERRO: ${e.code || ""} — ${e.message}`);
      alert(`Erro ao entrar: ${e.message}`);
    }
  });
}

boot();