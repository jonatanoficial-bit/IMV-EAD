// js/admin.js
import { requireProfileOrRedirect, adminCreateUser, logDiag, signOutNow } from "./auth.js";
import {
  collection,
  getCountFromServer,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { db } from "./firebase.js";

function first(...selectors) {
  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el) return el;
  }
  return null;
}

async function safeCount(colName) {
  try {
    const snap = await getCountFromServer(collection(db, colName));
    return snap.data().count || 0;
  } catch (e) {
    return 0;
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  const diag = first("#diagLog", "pre#diag", "pre[data-diag]");
  const authStatus = first("#authStatus", ".auth-status");
  const btnLogout = first("#btnLogout", "button[data-logout]", "#btnSair");

  const countUsers = first("#countUsers", "[data-count='users']");
  const countCourses = first("#countCourses", "[data-count='courses']");
  const countClasses = first("#countClasses", "[data-count='classes']");
  const countEnroll = first("#countEnrollments", "[data-count='enrollments']");

  const studentForm = first("#createStudentForm", "form[data-create-student]");
  const teacherForm = first("#createTeacherForm", "form[data-create-teacher]");

  const studentName = first("#studentName", "input[name='studentName']");
  const studentEmail = first("#studentEmail", "input[name='studentEmail']");
  const teacherName = first("#teacherName", "input[name='teacherName']");
  const teacherEmail = first("#teacherEmail", "input[name='teacherEmail']");

  const studentResult = first("#studentResult", ".student-result");
  const teacherResult = first("#teacherResult", ".teacher-result");

  function setStatus(msg, ok = true) {
    if (authStatus) {
      authStatus.textContent = msg;
      authStatus.style.color = ok ? "#bfffd2" : "#ffd0d0";
    }
  }

  const me = await requireProfileOrRedirect(["admin"]);
  if (!me) return;

  setStatus(`Logado como: ${me.name || me.email} • (${me.role})`, true);
  logDiag(diag, "Admin carregado.");

  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      await signOutNow();
      location.href = "index.html";
    });
  }

  async function refreshCounts() {
    logDiag(diag, "Atualizando contadores...");
    const [u, c, cl, e] = await Promise.all([
      safeCount("users"),
      safeCount("courses"),
      safeCount("classes"),
      safeCount("enrollments")
    ]);
    if (countUsers) countUsers.textContent = u;
    if (countCourses) countCourses.textContent = c;
    if (countClasses) countClasses.textContent = cl;
    if (countEnroll) countEnroll.textContent = e;
    logDiag(diag, "Contadores OK.");
  }

  await refreshCounts();

  async function createUserFlow({ name, email, role }, outEl) {
    if (outEl) outEl.textContent = "";
    if (!email) {
      alert("Email obrigatório.");
      return;
    }
    try {
      logDiag(diag, `Criando ${role}: ${email}...`);
      const created = await adminCreateUser({ name, email, role });
      const msg = `✅ Criado!\nEmail: ${created.email}\nSenha: ${created.password}\nUID: ${created.uid}\nRole: ${created.role}`;
      if (outEl) outEl.textContent = msg;
      logDiag(diag, `Usuário criado: ${created.uid}`);
      await refreshCounts();
    } catch (e) {
      const msg = e?.message || String(e);
      logDiag(diag, `ERRO criar usuário: ${msg}`);
      alert(msg);
    }
  }

  if (studentForm) {
    studentForm.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      await createUserFlow(
        { name: studentName?.value || "", email: (studentEmail?.value || "").trim(), role: "student" },
        studentResult
      );
      if (studentName) studentName.value = "";
      if (studentEmail) studentEmail.value = "";
    });
  }

  if (teacherForm) {
    teacherForm.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      await createUserFlow(
        { name: teacherName?.value || "", email: (teacherEmail?.value || "").trim(), role: "teacher" },
        teacherResult
      );
      if (teacherName) teacherName.value = "";
      if (teacherEmail) teacherEmail.value = "";
    });
  }
});