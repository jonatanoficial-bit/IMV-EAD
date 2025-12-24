// js/admin.js
import { auth, db, firebaseConfig } from "./firebase.js";
import { logout } from "./auth.js";

import {
  collection,
  doc,
  setDoc,
  getDoc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut as signOutAuth
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

function qs(sel) { return document.querySelector(sel); }
function escapeHtml(s){ return (s??"").toString().replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])); }

function randomPass(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function ensureRole(roleNeeded = "admin") {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Não autenticado.");
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) throw new Error("Perfil não encontrado em users/{uid}.");
  const role = snap.data()?.role;
  if (role !== roleNeeded) throw new Error("Sem permissão (role).");
  return snap.data();
}

async function createUserAccount(email, password) {
  // ✅ Cria usuário no Auth sem derrubar a sessão do admin:
  // usa um app secundário com auth separado
  const secondaryApp = initializeApp(firebaseConfig, "secondary-" + Date.now());
  const secondaryAuth = getAuth(secondaryApp);
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password);
  await signOutAuth(secondaryAuth);
  return cred.user;
}

async function createProfile({ uid, email, name, role }) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, {
    email: email.trim(),
    name: name?.trim() || "",
    role,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function listCounts() {
  const usersSnap = await getDocs(collection(db, "users"));
  const coursesSnap = await getDocs(collection(db, "courses"));
  const classesSnap = await getDocs(collection(db, "classes"));
  const enrollSnap = await getDocs(collection(db, "enrollments"));

  qs("#countUsers").textContent = usersSnap.size.toString();
  qs("#countCourses").textContent = coursesSnap.size.toString();
  qs("#countClasses").textContent = classesSnap.size.toString();
  qs("#countEnroll").textContent = enrollSnap.size.toString();
}

async function renderCourses() {
  const wrap = qs("#coursesList");
  wrap.innerHTML = "Carregando...";
  const qy = query(collection(db, "courses"), orderBy("createdAt", "desc"));
  const snap = await getDocs(qy);
  if (snap.empty) { wrap.innerHTML = "<div class='muted'>Nenhum curso ainda.</div>"; return; }

  wrap.innerHTML = snap.docs.map(d => {
    const c = d.data();
    return `
      <div class="item">
        <div class="row">
          <div>
            <div class="title">${escapeHtml(c.title || "Sem título")}</div>
            <div class="muted">${escapeHtml(c.description || "")}</div>
          </div>
          <div class="pill">${escapeHtml(c.active ? "ativo" : "inativo")}</div>
        </div>
      </div>
    `;
  }).join("");
}

async function renderClasses() {
  const wrap = qs("#classesList");
  wrap.innerHTML = "Carregando...";
  const qy = query(collection(db, "classes"), orderBy("createdAt", "desc"));
  const snap = await getDocs(qy);
  if (snap.empty) { wrap.innerHTML = "<div class='muted'>Nenhuma turma ainda.</div>"; return; }

  wrap.innerHTML = snap.docs.map(d => {
    const c = d.data();
    return `
      <div class="item">
        <div class="row">
          <div>
            <div class="title">${escapeHtml(c.name || "Turma")}</div>
            <div class="muted">teacherId: ${escapeHtml(c.teacherId || "-")} • courseId: ${escapeHtml(c.courseId || "-")}</div>
          </div>
          <div class="pill">${escapeHtml(c.active ? "ativa" : "inativa")}</div>
        </div>
      </div>
    `;
  }).join("");
}

async function renderEnrollments() {
  const wrap = qs("#enrollList");
  wrap.innerHTML = "Carregando...";
  const qy = query(collection(db, "enrollments"), orderBy("createdAt", "desc"));
  const snap = await getDocs(qy);
  if (snap.empty) { wrap.innerHTML = "<div class='muted'>Nenhuma matrícula ainda.</div>"; return; }

  wrap.innerHTML = snap.docs.map(d => {
    const e = d.data();
    return `
      <div class="item">
        <div class="row">
          <div>
            <div class="title">Aluno: ${escapeHtml(e.studentId || "-")}</div>
            <div class="muted">Turma: ${escapeHtml(e.classId || "-")} • status: ${escapeHtml(e.status || "active")}</div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

async function fillTeachersSelect() {
  const sel = qs("#classTeacher");
  sel.innerHTML = "<option value=''>Selecione...</option>";

  const qy = query(collection(db, "users"), where("role", "==", "teacher"));
  const snap = await getDocs(qy);

  snap.forEach(docu => {
    const u = docu.data();
    const opt = document.createElement("option");
    opt.value = docu.id;
    opt.textContent = (u.name || u.email || docu.id);
    sel.appendChild(opt);
  });
}

async function fillCoursesSelect() {
  const sel = qs("#classCourse");
  sel.innerHTML = "<option value=''>Selecione...</option>";

  const qy = query(collection(db, "courses"), orderBy("createdAt", "desc"));
  const snap = await getDocs(qy);

  snap.forEach(docu => {
    const c = docu.data();
    const opt = document.createElement("option");
    opt.value = docu.id;
    opt.textContent = (c.title || docu.id);
    sel.appendChild(opt);
  });
}

function showMsg(el, ok, text) {
  el.className = ok ? "msg ok" : "msg err";
  el.textContent = text;
  el.style.display = "block";
}

async function main() {
  try {
    const me = await ensureRole("admin");
    qs("#meName").textContent = me.name || me.email || "Admin";

    qs("#btnLogout").addEventListener("click", async () => {
      await logout();
    });

    // Criar aluno
    qs("#formStudent").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const name = qs("#studentName").value.trim();
      const email = qs("#studentEmail").value.trim();
      const msg = qs("#msgStudent");

      msg.style.display = "none";

      try {
        if (!email) throw new Error("E-mail do aluno é obrigatório.");
        const password = randomPass(10);
        const user = await createUserAccount(email, password);
        await createProfile({ uid: user.uid, email, name, role: "student" });
        showMsg(msg, true, `Aluno criado! Email: ${email} | Senha: ${password} | UID: ${user.uid}`);
        qs("#studentName").value = "";
        qs("#studentEmail").value = "";
        await listCounts();
      } catch (e) {
        showMsg(msg, false, e?.message || "Erro ao criar aluno.");
      }
    });

    // Criar professor
    qs("#formTeacher").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const name = qs("#teacherName").value.trim();
      const email = qs("#teacherEmail").value.trim();
      const msg = qs("#msgTeacher");

      msg.style.display = "none";

      try {
        if (!email) throw new Error("E-mail do professor é obrigatório.");
        const password = randomPass(10);
        const user = await createUserAccount(email, password);
        await createProfile({ uid: user.uid, email, name, role: "teacher" });
        showMsg(msg, true, `Professor criado! Email: ${email} | Senha: ${password} | UID: ${user.uid}`);
        qs("#teacherName").value = "";
        qs("#teacherEmail").value = "";
        await listCounts();
        await fillTeachersSelect();
      } catch (e) {
        showMsg(msg, false, e?.message || "Erro ao criar professor.");
      }
    });

    // Criar curso
    qs("#formCourse").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const title = qs("#courseTitle").value.trim();
      const description = qs("#courseDesc").value.trim();
      const msg = qs("#msgCourse");

      msg.style.display = "none";

      try {
        if (!title) throw new Error("Título do curso é obrigatório.");
        await addDoc(collection(db, "courses"), {
          title,
          description,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        showMsg(msg, true, "Curso criado!");
        qs("#courseTitle").value = "";
        qs("#courseDesc").value = "";
        await listCounts();
        await renderCourses();
        await fillCoursesSelect();
      } catch (e) {
        showMsg(msg, false, e?.message || "Erro ao criar curso.");
      }
    });

    // Criar turma
    qs("#formClass").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const name = qs("#className").value.trim();
      const teacherId = qs("#classTeacher").value;
      const courseId = qs("#classCourse").value;
      const msg = qs("#msgClass");

      msg.style.display = "none";

      try {
        if (!name) throw new Error("Nome da turma é obrigatório.");
        if (!teacherId) throw new Error("Selecione um professor.");
        if (!courseId) throw new Error("Selecione um curso.");

        await addDoc(collection(db, "classes"), {
          name,
          teacherId,
          courseId,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        showMsg(msg, true, "Turma criada!");
        qs("#className").value = "";
        await listCounts();
        await renderClasses();
      } catch (e) {
        showMsg(msg, false, e?.message || "Erro ao criar turma.");
      }
    });

    // Matricular
    qs("#formEnroll").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const studentUid = qs("#enrollStudentUid").value.trim();
      const classId = qs("#enrollClassId").value.trim();
      const msg = qs("#msgEnroll");
      msg.style.display = "none";

      try {
        if (!studentUid) throw new Error("UID do aluno é obrigatório.");
        if (!classId) throw new Error("ID da turma é obrigatório.");

        await addDoc(collection(db, "enrollments"), {
          studentId: studentUid,
          classId,
          status: "active",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        showMsg(msg, true, "Matrícula criada!");
        qs("#enrollStudentUid").value = "";
        qs("#enrollClassId").value = "";
        await listCounts();
        await renderEnrollments();
      } catch (e) {
        showMsg(msg, false, e?.message || "Erro ao matricular.");
      }
    });

    // Inicial
    await listCounts();
    await renderCourses();
    await fillTeachersSelect();
    await fillCoursesSelect();
    await renderClasses();
    await renderEnrollments();
  } catch (e) {
    qs("#fatal").style.display = "block";
    qs("#fatal").textContent = e?.message || "Erro no painel admin.";
  }
}

main();