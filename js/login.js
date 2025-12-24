// js/login.js
import { signIn, getMyProfileOrThrow } from "./auth.js";
import { roleHome } from "./router.js";

const $ = (id) => document.getElementById(id);

function show(msg, type = "error") {
  const box = $("msg");
  box.style.display = "block";
  box.className = "msg " + type;
  box.textContent = msg;
}
function hide() {
  const box = $("msg");
  box.style.display = "none";
  box.textContent = "";
}
function setLoading(isLoading) {
  const btn = $("btnLogin");
  const email = $("email");
  const pass = $("password");
  btn.disabled = isLoading;
  email.disabled = isLoading;
  pass.disabled = isLoading;
  btn.textContent = isLoading ? "Entrando..." : "Entrar";
}

async function doLogin() {
  hide();

  const email = $("email").value.trim();
  const password = $("password").value;

  if (!email || !password) {
    show("Preencha email e senha.", "warn");
    return;
  }

  setLoading(true);

  try {
    await signIn(email, password);

    // Busca o perfil no Firestore pra decidir destino
    const { role } = await getMyProfileOrThrow();
    const dest = roleHome(role);

    // trava anti-loop
    sessionStorage.setItem("IMV_REDIRECT_LOCK", String(Date.now()));
    window.location.replace(dest);

  } catch (e) {
    const msg = String(e?.message || e);

    // mensagens amigáveis
    if (msg.includes("auth/invalid-credential") || msg.includes("auth/wrong-password")) {
      show("Email ou senha incorretos.", "error");
    } else if (msg.includes("auth/user-not-found")) {
      show("Usuário não encontrado.", "error");
    } else if (msg.includes("auth/too-many-requests")) {
      show("Muitas tentativas. Aguarde um pouco e tente novamente.", "warn");
    } else if (msg.includes("PROFILE_NOT_FOUND")) {
      show("Seu usuário existe no Auth, mas não existe em Firestore/users. Peça ao admin para cadastrar seu perfil.", "error");
    } else if (msg.includes("USER_INACTIVE")) {
      show("Sua conta está desativada. Fale com a administração.", "error");
    } else if (msg.includes("ROLE_INVALID")) {
      show("Seu perfil está com 'role' inválida. Use admin/teacher/student.", "error");
    } else {
      show("Erro no login: " + msg, "error");
    }

    setLoading(false);
  }
}

function bind() {
  $("btnLogin").addEventListener("click", doLogin);

  // Enter funciona
  ["email", "password"].forEach((id) => {
    $(id).addEventListener("keydown", (e) => {
      if (e.key === "Enter") doLogin();
    });
  });
}

bind();