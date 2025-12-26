// js/admin.js
import { auth, db } from "./firebase.js";

import {
  doc,
  getDoc,
  setDoc,
  collection,
  serverTimestamp,
  getCountFromServer,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

/* =========================
   Utils
========================= */
const $ = (id) => document.getElementById(id);

const logBox = $("adminLog");
function log(...args) {
  const line = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  console.log("[ADMIN]", line);
  if (logBox) {
    logBox.textContent += (logBox.textContent ? "\n" : "") + `[${new Date().toLocaleTimeString()}] ${line}`;
    logBox.scrollTop = logBox.scrollHeight;
  }
}

function showAlert(msg) {
  const el = $("authAlert");
  if (!el) return;
  el.style.display = msg ? "block" : "none";
  el.textContent = msg || "";
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// gera um ID “estável” por email (sem expor caractere proibido no docId)
function emailToDocId(email) {
  // Base64 URL-safe
  const b64 = btoa(unescape(encodeURIComponent(email)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/* =========================
   Tabs
========================= */
function setupTabs() {
  const tabs = document.querySelectorAll(".tab");
  const sections = {
    admin: $("tab-admin"),
    library: $("tab-library"),
    reports: $("tab-reports"),
  };

  tabs.forEach((t) => {
    t.addEventListener("click", () => {
      tabs.forEach((x) => x.classList.remove("active"));
      t.classList.add("active");

      const key = t.getAttribute("data-tab");
      Object.keys(sections).forEach((k) => {
        if (sections[k]) sections[k].style.display = k === key ? "block" : "none";
      });
    });
  });
}

/* =========================
   Auth + Profile
========================= */
async function getMyProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("Perfil não encontrado em /users/{uid}. O admin precisa existir no Firestore.");
  }
  return snap.data();
}

function goToIndex() {
  // mantém Vercel / GitHub pages ok
  window.location.href = "./index.html?v=1";
}

function goToRolePage(role) {
  if (role === "admin") window.location.href = "./admin.html?v=1";
  else if (role === "teacher") window.location.href = "./teacher.html?v=1";
  else window.location.href = "./student.html?v=1";
}

/* =========================
   Counts
========================= */
async function loadCounts() {
  log("Carregando contagens (users/courses/classes/enrollments)...");
  try {
    const usersCount = await getCountFromServer(collection(db, "users"));
    $("statUsers").textContent = usersCount.data().count ?? 0;

    const coursesCount = await getCountFromServer(collection(db, "courses"));
    $("statCourses").textContent = coursesCount.data().count ?? 0;

    const classesCount = await getCountFromServer(collection(db, "classes"));
    $("statClasses").textContent = classesCount.data().count ?? 0;

    const enrollCount = await getCountFromServer(collection(db, "enrollments"));
    $("statEnroll").textContent = enrollCount.data().count ?? 0;

    log("OK: contagens atualizadas.");
  } catch (e) {
    log("ERRO ao carregar contagens:", e?.message || e);
    // Isso aqui é onde aparecia “Missing or insufficient permissions”
    showAlert(`Erro ao ler dados: ${e?.message || e}`);
  }
}

/* =========================
   Create user profile (Firestore)
   OBS: NÃO cria Auth user (não dá no client)
========================= */
async function createUserProfile({ name, email, role }) {
  const emailN = normalizeEmail(email);
  if (!emailN) throw new Error("Email obrigatório.");
  const docId = emailToDocId(emailN);

  const ref = doc(db, "users", docId);

  // Perfil “pré-cadastrado” por email (não é o UID do Auth)
  // Serve para: listagem/controle interno + “pré-aprovação”
  // Quando o usuário criar conta no Auth, você pode copiar esse perfil para /users/{uid}.
  const payload = {
    name: String(name || "").trim() || "(sem nome)",
    email: emailN,
    role,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    // marca que ainda não está vinculado ao UID do Auth
    authLinked: false,
  };

  await setDoc(ref, payload, { merge: true });
  return { docId };
}

/* =========================
   Wire UI
========================= */
function setupActions() {
  const btnLogout = $("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      try {
        await signOut(auth);
      } catch (e) {
        // ignore
      }
      goToIndex();
    });
  }

  const btnCreateStudent = $("btnCreateStudent");
  const btnCreateTeacher = $("btnCreateTeacher");

  if (btnCreateStudent) {
    btnCreateStudent.addEventListener("click", async () => {
      const msg = $("createStudentMsg");
      try {
        msg.textContent = "Salvando...";
        const name = $("studentName").value;
        const email = $("studentEmail").value;

        const r = await createUserProfile({ name, email, role: "student" });
        msg.textContent = `Aluno cadastrado no Firestore (id: ${r.docId}). Agora crie a conta no Auth (email/senha) ou implemente tela de “Criar conta”.`;

        // limpa campos
        $("studentName").value = "";
        $("studentEmail").value = "";

        await loadCounts();
      } catch (e) {
        msg.textContent = `Erro: ${e?.message || e}`;
      }
    });
  }

  if (btnCreateTeacher) {
    btnCreateTeacher.addEventListener("click", async () => {
      const msg = $("createTeacherMsg");
      try {
        msg.textContent = "Salvando...";
        const name = $("teacherName").value;
        const email = $("teacherEmail").value;

        const r = await createUserProfile({ name, email, role: "teacher" });
        msg.textContent = `Professor cadastrado no Firestore (id: ${r.docId}). Agora crie a conta no Auth (email/senha) ou implemente tela de “Criar conta”.`;

        $("teacherName").value = "";
        $("teacherEmail").value = "";

        await loadCounts();
      } catch (e) {
        msg.textContent = `Erro: ${e?.message || e}`;
      }
    });
  }
}

/* =========================
   Boot
========================= */
(async function boot() {
  log("Admin.js carregou.");
  setupTabs();
  setupActions();

  log("Aguardando autenticação (onAuthStateChanged)...");
  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        showAlert("Não autenticado. Faça login novamente.");
        log("Sem sessão ativa. Redirecionando para index...");
        setTimeout(goToIndex, 600);
        return;
      }

      log("Auth OK. uid =", user.uid, "email =", user.email);

      // 1) tenta perfil por UID (padrão esperado do app)
      let profile;
      try {
        profile = await getMyProfile(user.uid);
        log("Perfil encontrado em /users/{uid}.");
      } catch (e) {
        // se não existir no UID, mostra erro (para você corrigir no Firestore)
        showAlert(e?.message || String(e));
        log("ERRO perfil:", e?.message || e);
        return;
      }

      const role = profile.role;
      const active = profile.active === true;

      $("adminName").textContent = profile.name || user.email || "...";
      $("adminRole").textContent = role || "—";

      if (!active) {
        showAlert("Usuário inativo (active=false).");
        log("Bloqueado: active=false.");
        return;
      }

      if (role !== "admin") {
        showAlert(`Você não é admin (role=${role}). Redirecionando...`);
        log("Role diferente de admin, indo para página correta:", role);
        setTimeout(() => goToRolePage(role), 700);
        return;
      }

      showAlert(""); // limpa alerta
      log("Admin validado (role=admin, active=true).");

      await loadCounts();
    } catch (e) {
      showAlert(e?.message || String(e));
      log("FATAL:", e?.message || e);
    }
  });
})();