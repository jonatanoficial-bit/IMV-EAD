// js/login.js
import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

const logBox = $("logBox");
const form = $("loginForm");
const emailEl = $("email");
const passEl = $("password");
const btnLogin = $("btnLogin");
const btnClear = $("btnClear");

function log(msg) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  logBox.textContent += `[${hh}:${mm}:${ss}] ${msg}\n`;
  logBox.scrollTop = logBox.scrollHeight;
}

function hardRedirect(to) {
  // Bust de cache no redirecionamento
  const v = Date.now();
  const url = `${to}?v=${v}`;
  window.location.replace(url);
}

async function fetchProfile(uid) {
  log(`Lendo perfil (Firestore /users/${uid})...`);
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("Perfil não encontrado em /users/{uid}. Crie o documento com role.");
  }
  const data = snap.data() || {};
  if (!data.role) {
    throw new Error("Perfil sem role em /users/{uid}. Defina role: admin | teacher | student.");
  }
  if (data.active === false) {
    throw new Error("Usuário está desativado (active=false).");
  }
  return data;
}

function setLoading(isLoading) {
  btnLogin.disabled = isLoading;
  btnLogin.textContent = isLoading ? "Entrando..." : "Entrar";
}

async function doLogin(email, password) {
  setLoading(true);
  log("Tentando login no Firebase Auth (email/senha)...");
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  log(`Auth OK. UID=${user.uid}`);

  // força token atualizado (ajuda em alguns casos de “não autenticado” logo após login)
  log("Atualizando token...");
  await user.getIdToken(true);

  const profile = await fetchProfile(user.uid);

  const role = profile.role;
  log(`Role detectado: ${role}`);

  if (role === "admin") hardRedirect("./admin.html");
  if (role === "teacher") hardRedirect("./teacher.html");
  if (role === "student") hardRedirect("./student.html");

  throw new Error(`Role inválido: ${role} (use admin | teacher | student)`);
}

log("JS do login carregou (login.js).");

// ✅ Mostra o estado da sessão sem travar a tela
onAuthStateChanged(auth, (user) => {
  if (user) {
    log(`Sessão detectada: UID=${user.uid}`);
  } else {
    log("Sem sessão ativa.");
  }
});

// ✅ Limpar campos manualmente
btnClear.addEventListener("click", () => {
  emailEl.value = "";
  passEl.value = "";
  emailEl.focus();
  log("Campos limpos manualmente.");
});

// ✅ Login robusto (NÃO deixa recarregar a página)
form.addEventListener("submit", async (e) => {
  e.preventDefault(); // <<<<<<<<<<<<<<<<<<<<<<<< CHAVE (sem isso “some” e recarrega)
  e.stopPropagation();

  const email = (emailEl.value || "").trim();
  const password = passEl.value || "";

  log("Submit disparado.");

  if (!email || !password) {
    log("ERRO: Preencha email e senha.");
    return;
  }

  try {
    await doLogin(email, password);
  } catch (err) {
    // não limpamos campos automaticamente pra você não ficar reescrevendo
    log(`ERRO: ${err?.message || err}`);
    setLoading(false);

    // se deu algum estado estranho, garante logout
    try {
      await signOut(auth);
      log("Logout automático para limpar estado.");
    } catch (e2) {
      log("Falha ao limpar sessão (ignorado).");
    }
  }
});