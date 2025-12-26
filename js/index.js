// js/index.js — Login com diagnóstico na tela (ENTER + clique)
import { login, requireUserProfile } from "./auth.js";

function qs(sel){ return document.querySelector(sel); }

function show(el, ok, text){
  el.className = ok ? "msg ok" : "msg err";
  el.textContent = text;
  el.style.display = "block";
}
function hide(el){
  el.style.display = "none";
  el.textContent = "";
}

function logLine(text){
  const box = qs("#logBox");
  const now = new Date();
  const t = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;
  box.textContent += `[${t}] ${text}\n`;
}

async function redirectByRole(){
  logLine("Lendo perfil do usuário (Firestore /users/{uid})...");
  const { profile } = await requireUserProfile();

  logLine(`Perfil OK: role=${profile.role} active=${profile.active}`);

  if (profile.role === "admin") {
    logLine("Redirecionando para admin.html");
    window.location.replace("./admin.html");
    return;
  }
  if (profile.role === "teacher") {
    logLine("Redirecionando para teacher.html");
    window.location.replace("./teacher.html");
    return;
  }
  if (profile.role === "student") {
    logLine("Redirecionando para student.html");
    window.location.replace("./student.html");
    return;
  }

  throw new Error("Role inválida no Firestore. Use admin/teacher/student.");
}

async function main(){
  const form = qs("#loginForm");
  const btn = qs("#btnLogin");
  const ok = qs("#msgOk");
  const err = qs("#msgErr");

  hide(ok); hide(err);
  qs("#logBox").textContent = "";
  logLine("JS do login carregou (index.js).");

  // ✅ Se já estiver logado, tenta mandar direto
  try{
    logLine("Verificando sessão existente...");
    await redirectByRole();
    return;
  }catch(e){
    logLine(`Sem sessão válida agora: ${e?.message || e}`);
  }

  form.addEventListener("submit", async (ev)=>{
    ev.preventDefault();
    hide(ok); hide(err);

    const email = (qs("#email").value || "").trim();
    const password = (qs("#password").value || "").trim();

    logLine("Submit disparado (Enter ou botão).");

    if(!email || !password){
      show(err, false, "Preencha email e senha.");
      logLine("Falha: campos vazios.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Entrando...";
    logLine("Tentando login no Firebase Auth...");

    try{
      await login(email, password);
      logLine("Firebase Auth OK (email/senha).");
      show(ok, true, "Login OK. Conferindo perfil...");

      await redirectByRole();
    }catch(e){
      const code = (e?.code || "").toString();
      let text = e?.message || "Falha no login.";

      if (code.includes("auth/invalid-credential")) text = "Email ou senha inválidos.";
      if (code.includes("auth/user-not-found")) text = "Usuário não encontrado.";
      if (code.includes("auth/wrong-password")) text = "Senha incorreta.";
      if (code.includes("auth/too-many-requests")) text = "Muitas tentativas. Aguarde um pouco.";

      // Se o erro for do Firestore (perfil não existe), aparece aqui:
      if ((text || "").includes("Usuário não cadastrado")) {
        text = "Login ok no Auth, mas falta criar /users/{uid} no Firestore (ou rules bloqueando leitura).";
      }

      show(err, false, text);
      logLine(`ERRO: ${code ? code + " — " : ""}${text}`);

      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  });
}

main();