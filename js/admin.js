// js/admin.js
// Admin: Cadastros + Cursos + Turmas + Matrículas + Avisos

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  getAuth
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  getDocs,
  serverTimestamp,
  addDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

// ========= Secondary Auth (criar usuários sem deslogar o admin) =========
const firebaseConfig = {
  apiKey: "AIzaSyCSOuLs1PVG4eGn0NSNZxksJP8IqIdURrE",
  authDomain: "imvapp-aef54.firebaseapp.com",
  projectId: "imvapp-aef54",
  storageBucket: "imvapp-aef54.firebasestorage.app",
  messagingSenderId: "439661516200",
  appId: "1:439661516200:web:2d3ede20edbb9aa6d6f99d",
  measurementId: "G-2LEK7QDZ48"
};

let secondaryApp = null;
let secondaryAuth = null;

function ensureSecondaryAuth() {
  if (!secondaryApp) {
    secondaryApp = initializeApp(firebaseConfig, "secondary");
    secondaryAuth = getAuth(secondaryApp);
  }
  return secondaryAuth;
}

// ========= Util =========
function showBox(el, text, isError = false) {
  el.style.display = "block";
  el.textContent = text;
  el.style.borderColor = isError ? "rgba(255,92,122,.45)" : "rgba(72,213,151,.35)";
  el.style.background = isError ? "rgba(255,92,122,.10)" : "rgba(72,213,151,.08)";
}

function hideBox(el) {
  el.style.display = "none";
  el.textContent = "";
}

function generateRandomPassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#!?";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function logout() {
  await signOut(auth);
  window.location.href = "./index.html";
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(str) {
  return escapeHtml(str).replaceAll("`", "&#096;");
}
function formatMoney(n) {
  try { return Number(n || 0).toFixed(2).replace(".", ","); }
  catch { return "0,00"; }
}

function fmtDateInputToISO(dateStr) {
  // date input vem "YYYY-MM-DD" (sem timezone). Guardamos assim mesmo.
  return dateStr || "";
}

// ========= Tabs =========
function setupTabs() {
  const btns = Array.from(document.querySelectorAll(".tabBtn"));
  const panels = Array.from(document.querySelectorAll(".tabPanel"));

  function openTab(tabId) {
    btns.forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));
    panels.forEach(p => p.classList.toggle("active", p.id === tabId));
  }

  btns.forEach(b => b.addEventListener("click", () => openTab(b.dataset.tab)));
}

// ========= Auth + Role =========
async function getUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

async function requireAdmin(user) {
  const profile = await getUserProfile(user.uid);
  if (!profile || String(profile.role || "").toLowerCase() !== "admin") {
    alert("Acesso negado: apenas admin.");
    await logout();
    return null;
  }
  return profile;
}

// ========= USERS LIST =========
async function loadUsers() {
  const tbody = $("usersTbody");
  tbody.innerHTML = `<tr><td colspan="5" class="muted">Carregando…</td></tr>`;

  const qy = query(collection(db, "users"), orderBy("createdAt", "desc"));
  const snap = await getDocs(qy);

  $("usersCount").textContent = String(snap.size);

  if (snap.empty) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Nenhum usuário encontrado.</td></tr>`;
    return;
  }

  const rows = [];
  snap.forEach(docSnap => {
    const d = docSnap.data() || {};
    const uid = docSnap.id;
    const name = d.name || "(sem nome)";
    const email = d.email || "(sem email)";
    const role = d.role || "(sem role)";
    const active = d.active === true;

    rows.push(`
      <tr>
        <td><b>${escapeHtml(name)}</b><br><span class="muted">${escapeHtml(uid)}</span></td>
        <td>${escapeHtml(email)}</td>
        <td>${escapeHtml(role)}</td>
        <td>${active ? "✅" : "⛔"}</td>
        <td>
          <div class="actionsRow">
            <button class="btn inline" data-action="toggleActive" data-uid="${escapeAttr(uid)}">
              ${active ? "Desativar" : "Ativar"}
            </button>
          </div>
        </td>
      </tr>
    `);
  });

  tbody.innerHTML = rows.join("");

  tbody.querySelectorAll("[data-action='toggleActive']").forEach(btn => {
    btn.addEventListener("click", async () => {
      const uid = btn.getAttribute("data-uid");
      await toggleUserActive(uid);
      await loadUsers();
      await Promise.allSettled([loadTeachersForSelect(), loadStudentsForSelect()]);
    });
  });
}

async function toggleUserActive(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const cur = snap.data();
  const next = !(cur.active === true);
  await updateDoc(ref, { active: next, updatedAt: serverTimestamp() });
}

// ========= Create Student / Teacher =========
async function createUser(role, name, email) {
  if (!name || !email) throw new Error("Preencha nome e email.");

  const pass = generateRandomPassword(10);
  const secAuth = ensureSecondaryAuth();

  const cred = await createUserWithEmailAndPassword(secAuth, email, pass);

  await setDoc(doc(db, "users", cred.user.uid), {
    name,
    email,
    role,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  return { uid: cred.user.uid, email, password: pass };
}

// ========= Courses =========
async function createCourse() {
  const out = $("outCourse");
  hideBox(out);

  const name = $("cName").value.trim();
  const category = $("cCategory").value.trim();
  const modality = $("cModality").value.trim();
  const priceRaw = $("cPrice").value.trim().replace(",", ".");
  const price = priceRaw ? Number(priceRaw) : 0;

  if (!name) { showBox(out, "❌ Informe o nome do curso.", true); return; }
  if (priceRaw && Number.isNaN(price)) { showBox(out, "❌ Preço inválido.", true); return; }

  const payload = {
    name,
    category: category || "",
    modality: modality || "",
    price: price || 0,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, "courses"), payload);

  showBox(out, `✅ Curso salvo!\nID: ${ref.id}\nNome: ${name}`);
  $("cName").value = "";
  $("cCategory").value = "";
  $("cModality").value = "";
  $("cPrice").value = "";

  await Promise.allSettled([loadCourses(), loadCoursesForSelect()]);
}

async function loadCourses() {
  const tbody = $("coursesTbody");
  tbody.innerHTML = `<tr><td colspan="5" class="muted">Carregando…</td></tr>`;

  const qy = query(collection(db, "courses"), orderBy("createdAt", "desc"));
  const snap = await getDocs(qy);

  $("coursesCount").textContent = String(snap.size);

  if (snap.empty) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Nenhum curso cadastrado.</td></tr>`;
    return;
  }

  const rows = [];
  snap.forEach(docSnap => {
    const d = docSnap.data() || {};
    const id = docSnap.id;
    const name = d.name || "(sem nome)";
    const modality = d.modality || "";
    const price = typeof d.price === "number" ? d.price : 0;
    const active = d.active === true;

    rows.push(`
      <tr>
        <td><b>${escapeHtml(name)}</b><br><span class="muted">${escapeHtml(d.category || "")}</span></td>
        <td>${escapeHtml(modality)}</td>
        <td>R$ ${formatMoney(price)}</td>
        <td>${active ? "✅" : "⛔"}</td>
        <td>
          <div class="actionsRow">
            <button class="btn inline" data-action="toggleCourse" data-id="${escapeAttr(id)}">
              ${active ? "Desativar" : "Ativar"}
            </button>
          </div>
        </td>
      </tr>
    `);
  });

  tbody.innerHTML = rows.join("");

  tbody.querySelectorAll("[data-action='toggleCourse']").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      await toggleCourseActive(id);
      await Promise.allSettled([loadCourses(), loadCoursesForSelect(), loadClassesForSelect()]);
    });
  });
}

async function toggleCourseActive(courseId) {
  const ref = doc(db, "courses", courseId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const cur = snap.data();
  const next = !(cur.active === true);
  await updateDoc(ref, { active: next, updatedAt: serverTimestamp() });
}

// ========= Select helpers =========
async function loadCoursesForSelect() {
  const sel = $("clCourse");
  if (!sel) return;

  sel.innerHTML = `<option value="">Carregando cursos…</option>`;
  const qy = query(collection(db, "courses"), orderBy("name", "asc"));
  const snap = await getDocs(qy);

  const options = [];
  snap.forEach(docSnap => {
    const d = docSnap.data() || {};
    if (d.active !== true) return;
    options.push(`<option value="${escapeAttr(docSnap.id)}">${escapeHtml(d.name || docSnap.id)}</option>`);
  });

  sel.innerHTML = options.length
    ? `<option value="">Selecione um curso</option>${options.join("")}`
    : `<option value="">Nenhum curso ativo</option>`;
}

async function loadTeachersForSelect() {
  const sel = $("clTeacher");
  if (!sel) return;

  sel.innerHTML = `<option value="">Carregando professores…</option>`;
  const qy = query(collection(db, "users"), where("role", "==", "teacher"), orderBy("name", "asc"));
  const snap = await getDocs(qy);

  const options = [];
  snap.forEach(docSnap => {
    const d = docSnap.data() || {};
    if (d.active !== true) return;
    options.push(`<option value="${escapeAttr(docSnap.id)}">${escapeHtml(d.name || d.email || docSnap.id)}</option>`);
  });

  sel.innerHTML = options.length
    ? `<option value="">Selecione um professor</option>${options.join("")}`
    : `<option value="">Nenhum professor ativo</option>`;
}

async function loadStudentsForSelect() {
  const sel = $("eStudent");
  if (!sel) return;

  sel.innerHTML = `<option value="">Carregando alunos…</option>`;
  const qy = query(collection(db, "users"), where("role", "==", "student"), orderBy("name", "asc"));
  const snap = await getDocs(qy);

  const options = [];
  snap.forEach(docSnap => {
    const d = docSnap.data() || {};
    if (d.active !== true) return;
    options.push(`<option value="${escapeAttr(docSnap.id)}">${escapeHtml(d.name || d.email || docSnap.id)}</option>`);
  });

  sel.innerHTML = options.length
    ? `<option value="">Selecione um aluno</option>${options.join("")}`
    : `<option value="">Nenhum aluno ativo</option>`;
}

async function loadClassesForSelect() {
  const sel = $("eClass");
  if (!sel) return;

  sel.innerHTML = `<option value="">Carregando turmas…</option>`;
  const qy = query(collection(db, "classes"), orderBy("createdAt", "desc"));
  const snap = await getDocs(qy);

  const options = [];
  snap.forEach(docSnap => {
    const d = docSnap.data() || {};
    if (d.active !== true) return;
    const label = `${d.title || docSnap.id} • ${d.courseName || ""} • ${d.teacherName || ""}`.trim();
    options.push(`<option value="${escapeAttr(docSnap.id)}">${escapeHtml(label)}</option>`);
  });

  sel.innerHTML = options.length
    ? `<option value="">Selecione uma turma</option>${options.join("")}`
    : `<option value="">Nenhuma turma ativa</option>`;
}

// ========= TURMAS =========
async function createClass() {
  const out = $("outClass");
  hideBox(out);

  const title = $("clTitle").value.trim();
  const courseId = $("clCourse").value;
  const teacherId = $("clTeacher").value;
  const modality = $("clModality").value.trim();
  const schedule = $("clSchedule").value.trim();

  if (!title) { showBox(out, "❌ Informe o nome da turma.", true); return; }
  if (!courseId) { showBox(out, "❌ Selecione um curso.", true); return; }
  if (!teacherId) { showBox(out, "❌ Selecione um professor.", true); return; }

  const courseSnap = await getDoc(doc(db, "courses", courseId));
  if (!courseSnap.exists()) { showBox(out, "❌ Curso não encontrado.", true); return; }
  const course = courseSnap.data() || {};
  if (course.active !== true) { showBox(out, "❌ Curso desativado.", true); return; }

  const teacherSnap = await getDoc(doc(db, "users", teacherId));
  if (!teacherSnap.exists()) { showBox(out, "❌ Professor não encontrado.", true); return; }
  const teacher = teacherSnap.data() || {};
  if (teacher.active !== true) { showBox(out, "❌ Professor desativado.", true); return; }

  const payload = {
    title,
    courseId,
    courseName: course.name || "",
    teacherId,
    teacherName: teacher.name || teacher.email || "",
    modality: modality || (course.modality || ""),
    schedule: schedule || "",
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, "classes"), payload);

  showBox(out, `✅ Turma salva!\nID: ${ref.id}\nTurma: ${title}`);
  $("clTitle").value = "";
  $("clModality").value = "";
  $("clSchedule").value = "";
  $("clCourse").value = "";
  $("clTeacher").value = "";

  await Promise.allSettled([loadClasses(), loadClassesForSelect()]);
}

async function loadClasses() {
  const tbody = $("classesTbody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" class="muted">Carregando…</td></tr>`;

  const qy = query(collection(db, "classes"), orderBy("createdAt", "desc"));
  const snap = await getDocs(qy);

  $("classesCount").textContent = String(snap.size);

  if (snap.empty) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Nenhuma turma cadastrada.</td></tr>`;
    return;
  }

  const rows = [];
  snap.forEach(docSnap => {
    const d = docSnap.data() || {};
    const id = docSnap.id;
    const active = d.active === true;

    rows.push(`
      <tr>
        <td><b>${escapeHtml(d.title || "(sem título)")}</b><br><span class="muted">${escapeHtml(id)}</span></td>
        <td>${escapeHtml(d.courseName || d.courseId || "")}</td>
        <td>${escapeHtml(d.teacherName || d.teacherId || "")}</td>
        <td>${escapeHtml(d.schedule || "")}<br><span class="muted">${escapeHtml(d.modality || "")}</span></td>
        <td>${active ? "✅" : "⛔"}</td>
        <td>
          <div class="actionsRow">
            <button class="btn inline" data-action="toggleClass" data-id="${escapeAttr(id)}">
              ${active ? "Desativar" : "Ativar"}
            </button>
          </div>
        </td>
      </tr>
    `);
  });

  tbody.innerHTML = rows.join("");

  tbody.querySelectorAll("[data-action='toggleClass']").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      await toggleClassActive(id);
      await Promise.allSettled([loadClasses(), loadClassesForSelect()]);
    });
  });
}

async function toggleClassActive(classId) {
  const ref = doc(db, "classes", classId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const cur = snap.data();
  const next = !(cur.active === true);
  await updateDoc(ref, { active: next, updatedAt: serverTimestamp() });
}

// ========= MATRÍCULAS =========
async function createEnrollment() {
  const out = $("outEnroll");
  hideBox(out);

  const studentId = $("eStudent").value;
  const classId = $("eClass").value;
  const status = ($("eStatus").value || "ativa").toLowerCase();
  const startDate = fmtDateInputToISO($("eStart").value);

  if (!studentId) { showBox(out, "❌ Selecione um aluno.", true); return; }
  if (!classId) { showBox(out, "❌ Selecione uma turma.", true); return; }

  const stSnap = await getDoc(doc(db, "users", studentId));
  if (!stSnap.exists()) { showBox(out, "❌ Aluno não encontrado.", true); return; }
  const st = stSnap.data() || {};
  if (st.active !== true) { showBox(out, "❌ Aluno desativado.", true); return; }

  const clSnap = await getDoc(doc(db, "classes", classId));
  if (!clSnap.exists()) { showBox(out, "❌ Turma não encontrada.", true); return; }
  const cl = clSnap.data() || {};
  if (cl.active !== true) { showBox(out, "❌ Turma desativada.", true); return; }

  // Evita matrícula duplicada (mesmo aluno na mesma turma)
  const dupQ = query(
    collection(db, "enrollments"),
    where("studentId", "==", studentId),
    where("classId", "==", classId)
  );
  const dupSnap = await getDocs(dupQ);
  if (!dupSnap.empty) {
    showBox(out, "❌ Este aluno já está matriculado nesta turma.", true);
    return;
  }

  const payload = {
    studentId,
    studentName: st.name || st.email || "",
    studentEmail: st.email || "",
    classId,
    classTitle: cl.title || "",
    courseId: cl.courseId || "",
    courseName: cl.courseName || "",
    teacherId: cl.teacherId || "",
    teacherName: cl.teacherName || "",
    status,
    startDate: startDate || "",
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, "enrollments"), payload);

  showBox(out, `✅ Matrícula salva!\nID: ${ref.id}\nAluno: ${payload.studentName}\nTurma: ${payload.classTitle}`);
  $("eStudent").value = "";
  $("eClass").value = "";
  $("eStatus").value = "ativa";
  $("eStart").value = "";

  await loadEnrollments();
}

async function loadEnrollments() {
  const tbody = $("enrollTbody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" class="muted">Carregando…</td></tr>`;

  const qy = query(collection(db, "enrollments"), orderBy("createdAt", "desc"));
  const snap = await getDocs(qy);

  $("enrollCount").textContent = String(snap.size);

  if (snap.empty) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Nenhuma matrícula cadastrada.</td></tr>`;
    return;
  }

  const rows = [];
  snap.forEach(docSnap => {
    const d = docSnap.data() || {};
    const id = docSnap.id;
    const active = d.active === true;

    rows.push(`
      <tr>
        <td><b>${escapeHtml(d.studentName || d.studentEmail || "(aluno)")}</b><br><span class="muted">${escapeHtml(d.studentEmail || "")}</span></td>
        <td><b>${escapeHtml(d.classTitle || "(turma)")}</b><br><span class="muted">${escapeHtml(d.courseName || "")}</span></td>
        <td>${escapeHtml(d.status || "")}</td>
        <td>${escapeHtml(d.startDate || "")}</td>
        <td>${active ? "✅" : "⛔"}</td>
        <td>
          <div class="actionsRow">
            <button class="btn inline" data-action="toggleEnroll" data-id="${escapeAttr(id)}">
              ${active ? "Desativar" : "Ativar"}
            </button>
          </div>
        </td>
      </tr>
    `);
  });

  tbody.innerHTML = rows.join("");

  tbody.querySelectorAll("[data-action='toggleEnroll']").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      await toggleEnrollmentActive(id);
      await loadEnrollments();
    });
  });
}

async function toggleEnrollmentActive(enrollmentId) {
  const ref = doc(db, "enrollments", enrollmentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const cur = snap.data();
  const next = !(cur.active === true);
  await updateDoc(ref, { active: next, updatedAt: serverTimestamp() });
}

// ========= Notices =========
async function createNotice() {
  const out = $("outNotice");
  hideBox(out);

  const title = $("nTitle").value.trim();
  const audience = $("nAudience").value.trim() || "all";
  const body = $("nBody").value.trim();

  if (!title) { showBox(out, "❌ Informe o título.", true); return; }
  if (!body) { showBox(out, "❌ Informe a mensagem.", true); return; }

  const payload = {
    title,
    audience,
    body,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, "notices"), payload);

  showBox(out, `✅ Aviso publicado!\nID: ${ref.id}\nPara: ${audience}`);
  $("nTitle").value = "";
  $("nAudience").value = "";
  $("nBody").value = "";

  await loadNotices();
}

async function loadNotices() {
  const tbody = $("noticesTbody");
  tbody.innerHTML = `<tr><td colspan="4" class="muted">Carregando…</td></tr>`;

  const qy = query(collection(db, "notices"), orderBy("createdAt", "desc"));
  const snap = await getDocs(qy);

  $("noticesCount").textContent = String(snap.size);

  if (snap.empty) {
    tbody.innerHTML = `<tr><td colspan="4" class="muted">Nenhum aviso publicado.</td></tr>`;
    return;
  }

  const rows = [];
  snap.forEach(docSnap => {
    const d = docSnap.data() || {};
    const id = docSnap.id;
    const title = d.title || "(sem título)";
    const audience = d.audience || "all";
    const active = d.active === true;

    rows.push(`
      <tr>
        <td><b>${escapeHtml(title)}</b><br><span class="muted">${escapeHtml((d.body || "").slice(0, 90))}${(d.body || "").length > 90 ? "…" : ""}</span></td>
        <td>${escapeHtml(audience)}</td>
        <td>${active ? "✅" : "⛔"}</td>
        <td>
          <div class="actionsRow">
            <button class="btn inline" data-action="toggleNotice" data-id="${escapeAttr(id)}">
              ${active ? "Desativar" : "Ativar"}
            </button>
          </div>
        </td>
      </tr>
    `);
  });

  tbody.innerHTML = rows.join("");

  tbody.querySelectorAll("[data-action='toggleNotice']").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      await toggleNoticeActive(id);
      await loadNotices();
    });
  });
}

async function toggleNoticeActive(noticeId) {
  const ref = doc(db, "notices", noticeId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const cur = snap.data();
  const next = !(cur.active === true);
  await updateDoc(ref, { active: next, updatedAt: serverTimestamp() });
}

// ========= Boot =========
setupTabs();

$("btnLogout").addEventListener("click", logout);

// Cadastros
$("btnCreateStudent").addEventListener("click", async () => {
  const out = $("outStudent");
  hideBox(out);
  try {
    const name = $("sName").value.trim();
    const email = $("sEmail").value.trim();
    const created = await createUser("student", name, email);
    showBox(out, `✅ Aluno criado!\nEmail: ${created.email}\nSenha: ${created.password}\nUID: ${created.uid}`);
    $("sName").value = "";
    $("sEmail").value = "";
    await Promise.allSettled([loadUsers(), loadStudentsForSelect()]);
  } catch (e) {
    showBox(out, "❌ Erro: " + (e?.message || e), true);
  }
});

$("btnCreateTeacher").addEventListener("click", async () => {
  const out = $("outTeacher");
  hideBox(out);
  try {
    const name = $("tName").value.trim();
    const email = $("tEmail").value.trim();
    const created = await createUser("teacher", name, email);
    showBox(out, `✅ Professor criado!\nEmail: ${created.email}\nSenha: ${created.password}\nUID: ${created.uid}`);
    $("tName").value = "";
    $("tEmail").value = "";
    await Promise.allSettled([loadUsers(), loadTeachersForSelect()]);
  } catch (e) {
    showBox(out, "❌ Erro: " + (e?.message || e), true);
  }
});

// Listas
$("btnReloadUsers").addEventListener("click", async () => {
  await loadUsers();
  await Promise.allSettled([loadTeachersForSelect(), loadStudentsForSelect()]);
});
$("btnReloadCourses").addEventListener("click", async () => {
  await Promise.allSettled([loadCourses(), loadCoursesForSelect(), loadClassesForSelect()]);
});
$("btnReloadClasses").addEventListener("click", async () => {
  await Promise.allSettled([loadClasses(), loadClassesForSelect()]);
});
$("btnReloadEnroll").addEventListener("click", loadEnrollments);
$("btnReloadNotices").addEventListener("click", loadNotices);

// Ações
$("btnCreateCourse").addEventListener("click", createCourse);
$("btnCreateClass").addEventListener("click", createClass);
$("btnCreateEnroll").addEventListener("click", createEnrollment);
$("btnCreateNotice").addEventListener("click", createNotice);

// Guard + Load
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }

  const profile = await requireAdmin(user);
  if (!profile) return;

  $("who").textContent = `${profile.name || user.email} • (${profile.role || "admin"})`;

  await Promise.allSettled([
    loadUsers(),
    loadCourses(),
    loadClasses(),
    loadNotices(),
    loadCoursesForSelect(),
    loadTeachersForSelect(),
    loadStudentsForSelect(),
    loadClassesForSelect(),
    loadEnrollments()
  ]);
});