// js/login.js
import { signInEmailPassword, getMyProfile, logDiag, signOutNow } from "./auth.js";
import { goToRole } from "./router.js";

function first(...selectors) {
  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el) return el;
  }
  return null;
}

window.addEventListener("DOMContentLoaded", () => {
  const form =
    first("#loginForm", "form[data-login]", "form") ||
    null;

  const emailEl = first("#email", "input[name='email']", "input[type='email']");
  const passEl  = first("#password", "input[name='password']", "input[type='password']");
  const btnEl   = first("#btnLogin", "button[type='submit']", "button");
  const errBox  = first("#loginError", ".login-error", "#errorBox");
  const diagEl  = first("#diagLog", "pre#diag", "pre[data-diag]");

  function setError(msg) {
    if (errBox) {
      errBox.textContent = msg || "";
      errBox.style.display = msg ? "block" : "none";
    } else if (msg) {
      alert(msg);
    }
  }

  async function trySession() {
    logDiag(diagEl, "Verificando sessão existente...");
    try {
      // se tiver session, tenta ler profile
      const profile = await getMyProfile();
      logDiag(diagEl, `Sessão OK. Role: ${profile.role}`);
      goToRole(profile.role);
    } catch (e) {
      logDiag(diagEl, `Sem sessão válida agora: ${e?.message || e}`);
    }
  }

  trySession();

  if (!form) return;

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();

    setError("");
    const email = (emailEl?.value || "").trim();
    const password = (passEl?.value || "").trim();

    logDiag(diagEl, "Submit disparado (Enter ou botão).");

    if (!email || !password) {
      setError("Informe email e senha.");
      return;
    }

    if (btnEl) btnEl.disabled = true;

    try {
      logDiag(diagEl, "Tentando login no Firebase Auth...");
      await signInEmailPassword(email, password);
      logDiag(diagEl, "Firebase Auth OK (email/senha).");

      logDiag(diagEl, "Lendo perfil do usuário (Firestore /users/{uid})...");
      const profile = await getMyProfile();
      logDiag(diagEl, `Perfil OK. Role: ${profile.role}`);

      goToRole(profile.role);
    } catch (e) {
      const msg = e?.message || String(e);

      // evita loop/piscando se logou no auth mas falhou no firestore
      try { await signOutNow(); } catch (err) {}

      logDiag(diagEl, `ERRO: ${msg}`);
      setError(msg.includes("Perfil não encontrado")
        ? "Perfil não encontrado. O admin precisa criar seu usuário em Firestore/users."
        : msg
      );
      if (btnEl) btnEl.disabled = false;
    }
  });
});