// js/admin.js
import { db, auth, createSecondaryAuth } from "./firebase.js";
import { requireUserProfile, logout } from "./auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

import {
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

function $(id) { return document.getElementById(id); }

const els = {
  topName: $("topName"),
  topRole: $("topRole"),
  btnLogout: $("btnLogout"),
  errBox: $("errBox"),

  // contadores (se existirem no seu HTML)
  countUsers: $("countUsers"),
  countCourses: $("countCourses"),
  countClasses: $("countClasses"),
  countEnrollments: $("countEnrollments"),

  // formulário aluno
  studentName: $("studentName"),
  studentEmail: $("studentEmail"),
  btnCreateStudent: $("btnCreateStudent"),
  studentMsg: $("studentMsg"),

  // formulário professor
  teacherName: $("teacherName"),
  teacherEmail: $("teacherEmail"),
  btnCreateTeacher: $("btnCreateTeacher"),
  teacherMsg: $("teacherMsg"),
};

function showError(msg) {
  if (els.errBox) {
    els.errBox.textContent = msg;
    els.errBox.style.display = "block";
  } else {
    alert(msg);
  }
}
function clearError() {
  if (els.errBox) {
    els.errBox.textContent = "";
    els.errBox.style.display = "none";
  }
}
function setMsg(el, msg, ok = true) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
  el.style.borderColor = ok ? "rgba(0,255,160,.35)" : "rgba(255,80,80,.35)";
}

function randomPassword() {
  // senha forte simples (12+)
  const base = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < 14; i++) out += base[Math.floor(Math.random() * base.length)];
  return out;
}

async function countCollection(path) {
  const snap = await getDocs(collection(db, path));
  return snap.size;
}

async function refreshCounts() {
  // Se você já tem collections diferentes, adapte aqui.
  // Mantive genérico e estável.
  const users = await countCollection("users").catch(() => 0);
  const courses = await countCollection("courses").catch(() => 0);
  const classes = await countCollection("classes").catch(() => 0);
  const enrollments = await countCollection("enrollments").catch(() => 0);

  if (els.countUsers) els.countUsers.textContent = String(users);
  if (els.countCourses) els.countCourses.textContent = String(courses);
  if (els.countClasses) els.countClasses.textContent = String(classes);
  if (els.countEnrollments) els.countEnrollments.textContent = String(enrollments);
}

async function ensureAdmin() {
  clearError();
  const { profile } = await requireUserProfile();
  if (profile.role !== "admin") throw new Error("Acesso negado: este usuário não é admin.");

  if (els.topName) els.topName.textContent = profile.name || "Admin";
  if (els.topRole) els.topRole.textContent = profile.role || "admin";
}

async function createUserWithRole({ name, email, role }) {
  // validações
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail.includes("@")) throw new Error("Email inválido.");
  const cleanName = (name || "").trim();
  if (!cleanName) throw new Error("Informe o nome.");

  // gera senha
  const pass = randomPassword();

  // ✅ cria com auth secundário (não derruba login do admin)
  const sec = await createSecondaryAuth();
  try {
    const cred = await createUserWithEmailAndPassword(sec.sAuth, cleanEmail, pass);
    const uid = cred.user.uid;

    // cria perfil no Firestore em /users/{uid}
    await setDoc(doc(db, "users", uid), {
      active: true,
      email: cleanEmail,
      name: cleanName,
      role: role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    // desloga secundário (só higiene)
    try { await signOut(sec.sAuth); } catch {}

    return { uid, pass };
  } finally {
    await sec.cleanup();
  }
}

async function handleCreateStudent() {
  try {
    setMsg(els.studentMsg, "Cadastrando aluno...", true);

    const name = els.studentName?.value || "";
    const email = els.studentEmail?.value || "";

    const { uid, pass } = await createUserWithRole({ name, email, role: "student" });

    setMsg(
      els.studentMsg,
      `✅ Aluno criado!\nEmail: ${email.trim()}\nSenha: ${pass}\nUID: ${uid}`,
      true
    );

    // limpa campos
    if (els.studentName) els.studentName.value = "";
    if (els.studentEmail) els.studentEmail.value = "";

    await refreshCounts();
  } catch (e) {
    setMsg(els.studentMsg, `❌ ${e.message || String(e)}`, false);
  }
}

async function handleCreateTeacher() {
  try {
    setMsg(els.teacherMsg, "Cadastrando professor...", true);

    const name = els.teacherName?.value || "";
    const email = els.teacherEmail?.value || "";

    const { uid, pass } = await createUserWithRole({ name, email, role: "teacher" });

    setMsg(
      els.teacherMsg,
      `✅ Professor criado!\nEmail: ${email.trim()}\nSenha: ${pass}\nUID: ${uid}`,
      true
    );

    // limpa campos
    if (els.teacherName) els.teacherName.value = "";
    if (els.teacherEmail) els.teacherEmail.value = "";

    await refreshCounts();
  } catch (e) {
    setMsg(els.teacherMsg, `❌ ${e.message || String(e)}`, false);
  }
}

function bindUI() {
  if (els.btnLogout) els.btnLogout.addEventListener("click", logout);

  if (els.btnCreateStudent) {
    els.btnCreateStudent.addEventListener("click", (ev) => {
      ev.preventDefault();
      handleCreateStudent();
    });
  }

  if (els.btnCreateTeacher) {
    els.btnCreateTeacher.addEventListener("click", (ev) => {
      ev.preventDefault();
      handleCreateTeacher();
    });
  }
}

(async function boot() {
  try {
    bindUI();
    await ensureAdmin();
    await refreshCounts();
  } catch (e) {
    showError(e.message || String(e));
  }
})();