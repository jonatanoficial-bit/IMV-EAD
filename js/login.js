// /js/login.js
import { auth } from "./firebase.js";
import { goToRole } from "./router.js";
import { loadMyProfileOrThrow, listenAuth } from "./auth.js";

import {
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

function $(id) {
  return document.getElementById(id);
}

function logLine(msg) {
  const el = $("diagLog");
  const line = `[${new Date().toLocaleTimeString()}] ${msg}\n`;
  if (el) el.textContent += line;
  console.log(msg);
}

function showError(message) {
  const box = $("loginError");
  if (!box) return;
  box.style.display = "block";
  box.textContent = message;
}

function clearError() {
  const box = $("loginError");
  if (!box) return;
  box.style.display = "none";
  box.textContent = "";
}

function setBusy(isBusy) {
  const btn = $("btnLogin");
  const email = $("email");
  const pass = $("password");
  if (btn) btn.disabled = isBusy;
  if (email) email.disabled = isBusy;
  if (pass) pass.disabled = isBusy;
}

async function tryResumeSession() {
  try {
    logLine("Verificando sessão existente...");
    const { role } = await loadMyProfileOrThrow();
    logLine(`Sessão OK. Role=${role}. Redirecionando...`);
    goToRole(role);
  } catch (e) {
    logLine(`Sem sessão válida agora: ${e?.message || e}`);
  }
}

async function doLogin(email, password) {
  clearError();
  setBusy(true);

  try {
    logLine("Tentando login no Firebase Auth...");
    const cred = await signInWithEmailAndPassword(auth, email, password);
    logLine("Firebase Auth OK (email/senha). UID=" + cred.user.uid);

    // Agora tenta ler o perfil (role/active) no Firestore
    logLine("Lendo perfil do usuário (Firestore /users/{uid})...");
    const { role } = await loadMyProfileOrThrow();

    logLine(`Perfil OK. Role=${role}. Redirecionando...`);
    goToRole(role);
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    logLine("ERRO: " + msg);
    showError(msg);
    setBusy(false);
  }
}

function attachLoginHandler() {
  const form = $("loginForm");
  const emailEl = $("email");
  const passEl = $("password");

  if (!form || !emailEl || !passEl) {
    logLine("ERRO: Elementos do login não encontrados (loginForm/email/password).");
    showError("Erro interno: IDs do formulário não encontrados.");
    return;
  }

  // Evita múltiplos listeners (em caso de reload parcial)
  if (form.dataset.bound === "1") return;
  form.dataset.bound = "1";

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault(); // ✅ evita limpar/recarregar
    clearError();

    const email = (emailEl.value || "").trim();
    const password = passEl.value || "";

    logLine("Submit disparado (Enter ou botão).");

    if (!email || !password) {
      showError("Preencha email e senha.");
      return;
    }

    await doLogin(email, password);
  });

  logLine("Listener do login anexado com sucesso.");
}

window.addEventListener("DOMContentLoaded", () => {
  logLine("JS do login carregou (login.js).");

  // Diagnóstico: mostra se está autenticado em tempo real
  listenAuth((user) => {
    if (user) logLine("onAuthStateChanged: autenticado UID=" + user.uid);
    else logLine("onAuthStateChanged: não autenticado");
  });

  attachLoginHandler();
  tryResumeSession();
});