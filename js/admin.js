// js/admin.js
import { db, secondaryAuth } from "./firebase.js";
import { requireRole, setStatus, setText, signOut, $ } from "./auth.js";

import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  query
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

import {
  createUserWithEmailAndPassword,
  signOut as fbSignOut
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

function randomPassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function normalizeName(name) {
  return (name || "").trim();
}

async function createUserProfile({ uid, email, name, role }) {
  // users/{uid}
  const ref = doc(db, "users", uid);
  await setDoc(
    ref,
    {
      email,
      name: name || "",
      role,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

async function createAuthUserWithoutKickingAdmin(email, pass) {
  // Cria usando secondaryAuth, mantendo o admin logado no auth principal
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
  const uid = cred.user.uid;
  // importantíssimo: desloga o secondaryAuth pra não "grudar" sessão
  await fbSignOut(secondaryAuth);
  return uid;
}

function wireRealtimeCounters() {
  // Contadores em tempo real
  const usersQ = query(collection(db, "users"));
  const coursesQ = query(collection(db, "courses"));
  const classesQ = query(collection(db, "classes"));
  const enrollQ = query(collection(db, "enrollments"));

  onSnapshot(
    usersQ,
    (snap) => {
      setText("countUsers", String(snap.size));
      // opcional: contagem por role (se existir no html)
      let students = 0, teachers = 0, admins = 0;
      snap.forEach((d) => {
        const r = d.data()?.role;
        if (r === "student") students++;
        else if (r === "teacher") teachers++;
        else if (r === "admin") admins++;
      });
      if ($("countStudents")) setText("countStudents", String(students));
      if ($("countTeachers")) setText("countTeachers", String(teachers));
      if ($("countAdmins")) setText("countAdmins", String(admins));
    },
    (err) => setStatus(`Erro users: ${err.message}`, "err")
  );

  onSnapshot(
    coursesQ,
    (snap) => setText("countCourses", String(snap.size)),
    (err) => setStatus(`Erro courses: ${err.message}`, "err")
  );

  onSnapshot(
    classesQ,
    (snap) => setText("countClasses", String(snap.size)),
    (err) => setStatus(`Erro classes: ${err.message}`, "err")
  );

  onSnapshot(
    enrollQ,
    (snap) => setText("countEnrollments", String(snap.size)),
    (err) => setStatus(`Erro enrollments: ${err.message}`, "err")
  );
}

async function handleCreate(role) {
  const nameId = role === "student" ? "studentName" : "teacherName";
  const emailId = role === "student" ? "studentEmail" : "teacherEmail";
  const outId = role === "student" ? "studentOut" : "teacherOut";

  const name = normalizeName($(nameId)?.value);
  const email = normalizeEmail($(emailId)?.value);

  if (!email) {
    setStatus("Email é obrigatório.", "warn");
    return;
  }

  const pass = randomPassword(12);

  try {
    setStatus(`Criando ${role === "student" ? "aluno" : "professor"}...`, "info");

    // 1) cria no Auth sem derrubar admin
    const uid = await createAuthUserWithoutKickingAdmin(email, pass);

    // 2) cria/atualiza perfil no Firestore (users/{uid})
    await createUserProfile({ uid, email, name, role });

    // 3) UI feedback
    if ($(outId)) {
      $(outId).textContent =
        `✅ Criado!\nEmail: ${email}\nSenha: ${pass}\nUID: ${uid}\nRole: ${role}`;
    }

    setStatus("Usuário criado com sucesso.", "ok");

    // limpa campos
    if ($(nameId)) $(nameId).value = "";
    if ($(emailId)) $(emailId).value = "";
  } catch (e) {
    setStatus(`Erro ao criar: ${e.message}`, "err");
  }
}

async function boot() {
  try {
    const { profile } = await requireRole(["admin"]);

    // topo
    if ($("adminName")) $("adminName").textContent = profile?.name || profile?.email || "Admin";
    if ($("adminRole")) $("adminRole").textContent = profile?.role || "admin";

    setStatus("Autenticado.", "ok");

    // botão sair
    const btnOut = $("btnSignOut");
    if (btnOut) {
      btnOut.addEventListener("click", async () => {
        await signOut();
        window.location.href = "./index.html?v=" + Date.now();
      });
    }

    // botões criar
    const btnStudent = $("btnCreateStudent");
    if (btnStudent) btnStudent.addEventListener("click", () => handleCreate("student"));

    const btnTeacher = $("btnCreateTeacher");
    if (btnTeacher) btnTeacher.addEventListener("click", () => handleCreate("teacher"));

    // contadores realtime
    wireRealtimeCounters();
  } catch (e) {
    setStatus(e.message || "Não autenticado.", "err");
    // volta pro login
    setTimeout(() => {
      window.location.href = "./index.html?v=" + Date.now();
    }, 800);
  }
}

boot();