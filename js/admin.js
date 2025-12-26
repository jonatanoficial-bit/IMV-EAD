// js/admin.js (COMPLETO)
import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

import {
  getCountFromServer,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

/* ------------------------ UI Helpers ------------------------ */
const $ = (id) => document.getElementById(id);

function log(line) {
  const el = $("diag");
  if (!el) return;
  const ts = new Date().toLocaleTimeString("pt-BR", { hour12: false });
  el.textContent += `[${ts}] ${line}\n`;
  el.scrollTop = el.scrollHeight;
}

function logLib(line) {
  const el = $("diagLib");
  if (!el) return;
  const ts = new Date().toLocaleTimeString("pt-BR", { hour12: false });
  el.textContent += `[${ts}] ${line}\n`;
  el.scrollTop = el.scrollHeight;
}

function logRep(line) {
  const el = $("diagRep");
  if (!el) return;
  const ts = new Date().toLocaleTimeString("pt-BR", { hour12: false });
  el.textContent += `[${ts}] ${line}\n`;
  el.scrollTop = el.scrollHeight;
}

function showAlert(msg, type = "danger") {
  const box = $("alertBox");
  const text = $("alertText");
  if (!box || !text) return;
  text.textContent = msg;
  box.classList.remove("hide");
  box.classList.remove("danger", "success");
  box.classList.add(type);
  setTimeout(() => {
    box.classList.add("hide");
  }, 6000);
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function setActiveTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tabId);
  });
  ["tab-admin", "tab-library", "tab-reports"].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.classList.toggle("hide", id !== tabId);
  });
}

/* ------------------------ Data Helpers ------------------------ */
async function getMyProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

async function safeCount(colName) {
  const coll = collection(db, colName);
  const snap = await getCountFromServer(coll);
  return snap.data().count || 0;
}

function userPill(u) {
  const role = u.role || "unknown";
  const active = u.active === true ? "active" : "inactive";
  return `<span class="pill">${escapeHtml(role)}</span> <span class="pill">${escapeHtml(active)}</span>`;
}

/* ------------------------ Admin Features ------------------------ */
async function loadKpis() {
  log("Carregando contagens (users/courses/classes/enrollments)...");
  const [u, c, cl, e] = await Promise.all([
    safeCount("users"),
    safeCount("courses"),
    safeCount("classes"),
    safeCount("enrollments"),
  ]);

  $("kpiUsers").textContent = u;
  $("kpiCourses").textContent = c;
  $("kpiClasses").textContent = cl;
  $("kpiEnrollments").textContent = e;

  // Reports tab mirrors
  const repUsers = $("repUsers"); if (repUsers) repUsers.textContent = u;
  const repCourses = $("repCourses"); if (repCourses) repCourses.textContent = c;
  const repClasses = $("repClasses"); if (repClasses) repClasses.textContent = cl;
  const repEnrollments = $("repEnrollments"); if (repEnrollments) repEnrollments.textContent = e;

  log("OK: contagens atualizadas.");
}

async function loadUsers() {
  log("Carregando lista de usuários...");
  const qy = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(50));
  const snap = await getDocs(qy);

  const list = $("usersList");
  list.innerHTML = "";

  const teachersSel = $("classTeacher");
  const enrStudentSel = $("enrStudent");
  teachersSel.innerHTML = "";
  enrStudentSel.innerHTML = "";

  const teachers = [];
  const students = [];

  snap.forEach((d) => {
    const u = { id: d.id, ...d.data() };
    const name = u.name || "(sem nome)";
    const email = u.email || "(sem email)";
    const role = u.role || "unknown";

    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="item-title">${escapeHtml(name)}</div>
      <div class="muted">${escapeHtml(email)}</div>
      <div style="margin-top:6px;">${userPill(u)}</div>
      <div class="muted" style="margin-top:6px;">uid: ${escapeHtml(u.id)}</div>
    `;
    list.appendChild(item);

    if (role === "teacher") teachers.push({ ...u, uid: u.id });
    if (role === "student") students.push({ ...u, uid: u.id });
  });

  // Preencher selects
  teachersSel.appendChild(new Option("Selecione um professor", ""));
  teachers.forEach((t) => teachersSel.appendChild(new Option(`${t.name || t.email} • ${t.email}`, t.uid)));

  enrStudentSel.appendChild(new Option("Selecione um aluno", ""));
  students.forEach((s) => enrStudentSel.appendChild(new Option(`${s.name || s.email} • ${s.email}`, s.uid)));

  log(`OK: usuários carregados (${snap.size}).`);
}

async function loadCourses() {
  log("Carregando cursos...");
  const qy = query(collection(db, "courses"), orderBy("createdAt", "desc"), limit(50));
  const snap = await getDocs(qy);

  const list = $("coursesList");
  list.innerHTML = "";

  const sel = $("classCourse");
  sel.innerHTML = "";
  sel.appendChild(new Option("Selecione um curso", ""));

  snap.forEach((d) => {
    const c = { id: d.id, ...d.data() };
    const name = c.name || "(sem nome)";
    list.appendChild(renderSimpleItem("Curso", name, d.id));

    sel.appendChild(new Option(name, d.id));
  });

  log(`OK: cursos carregados (${snap.size}).`);
}

async function loadClasses() {
  log("Carregando turmas...");
  const qy = query(collection(db, "classes"), orderBy("createdAt", "desc"), limit(50));
  const snap = await getDocs(qy);

  const list = $("classesList");
  list.innerHTML = "";

  const enrClassSel = $("enrClass");
  enrClassSel.innerHTML = "";
  enrClassSel.appendChild(new Option("Selecione uma turma", ""));

  snap.forEach((d) => {
    const cl = { id: d.id, ...d.data() };
    const name = cl.name || "(sem nome)";
    const courseId = cl.courseId || "-";
    const teacherId = cl.teacherId || "-";

    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="item-title">${escapeHtml(name)}</div>
      <div class="muted">courseId: ${escapeHtml(courseId)}</div>
      <div class="muted">teacherId: ${escapeHtml(teacherId)}</div>
      <div class="muted" style="margin-top:6px;">id: ${escapeHtml(d.id)}</div>
    `;
    list.appendChild(item);

    enrClassSel.appendChild(new Option(name, d.id));
  });

  log(`OK: turmas carregadas (${snap.size}).`);
}

async function loadEnrollments() {
  log("Carregando matrículas...");
  const qy = query(collection(db, "enrollments"), orderBy("createdAt", "desc"), limit(80));
  const snap = await getDocs(qy);

  const list = $("enrollmentsList");
  list.innerHTML = "";

  snap.forEach((d) => {
    const e = { id: d.id, ...d.data() };
    const studentId = e.studentId || "-";
    const classId = e.classId || "-";
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="item-title">Matrícula</div>
      <div class="muted">studentId: ${escapeHtml(studentId)}</div>
      <div class="muted">classId: ${escapeHtml(classId)}</div>
      <div class="muted" style="margin-top:6px;">id: ${escapeHtml(d.id)}</div>
    `;
    list.appendChild(item);
  });

  log(`OK: matrículas carregadas (${snap.size}).`);
}

async function loadNotices() {
  log("Carregando avisos...");
  const qy = query(collection(db, "notices"), orderBy("createdAt", "desc"), limit(30));
  const snap = await getDocs(qy);

  const list = $("noticesList");
  list.innerHTML = "";

  snap.forEach((d) => {
    const n = { id: d.id, ...d.data() };
    const title = n.title || "(sem título)";
    const body = n.body || "";
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="item-title">${escapeHtml(title)}</div>
      <div class="muted" style="margin-top:6px; white-space:pre-wrap;">${escapeHtml(body)}</div>
      <div class="muted" style="margin-top:6px;">id: ${escapeHtml(d.id)}</div>
    `;
    list.appendChild(item);
  });

  log(`OK: avisos carregados (${snap.size}).`);
}

function renderSimpleItem(label, title, id) {
  const item = document.createElement("div");
  item.className = "item";
  item.innerHTML = `
    <div class="item-title">${escapeHtml(label)}: ${escapeHtml(title)}</div>
    <div class="muted">id: ${escapeHtml(id)}</div>
  `;
  return item;
}

/**
 * CRIAR PERFIL (teacher/student):
 * - Se já existir um /users/{uid} com aquele email → atualiza.
 * - Se não existir user com email → cria /invites (para rastrear).
 *
 * Obs: sem Cloud Functions, não dá pra criar o usuário no Auth via front-end com segurança.
 */
async function createOrInviteUser({ name, email, role }) {
  if (!name || !email) throw new Error("Nome e email são obrigatórios.");
  const lowerEmail = String(email).trim().toLowerCase();

  // tenta achar em users por email
  const qy = query(collection(db, "users"), where("email", "==", lowerEmail), limit(1));
  const snap = await getDocs(qy);

  if (!snap.empty) {
    const d = snap.docs[0];
    await updateDoc(doc(db, "users", d.id), {
      name: String(name).trim(),
      email: lowerEmail,
      role,
      active: true,
      updatedAt: serverTimestamp(),
    });
    return { mode: "updated", uid: d.id };
  }

  // se não achar, cria invite
  const invRef = await addDoc(collection(db, "invites"), {
    name: String(name).trim(),
    email: lowerEmail,
    role,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    note: "Crie a conta no Firebase Auth e depois crie /users/{uid} com esse email/role.",
  });
  return { mode: "invited", inviteId: invRef.id };
}

async function createCourse(name) {
  if (!name) throw new Error("Nome do curso é obrigatório.");
  await addDoc(collection(db, "courses"), {
    name: String(name).trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

async function createClass({ name, courseId, teacherId }) {
  if (!name || !courseId || !teacherId) throw new Error("Nome, curso e professor são obrigatórios.");
  await addDoc(collection(db, "classes"), {
    name: String(name).trim(),
    courseId,
    teacherId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

async function createEnrollment({ studentId, classId }) {
  if (!studentId || !classId) throw new Error("Selecione aluno e turma.");
  await addDoc(collection(db, "enrollments"), {
    studentId,
    classId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

async function createNotice({ title, body }) {
  if (!title || !body) throw new Error("Título e texto são obrigatórios.");
  await addDoc(collection(db, "notices"), {
    title: String(title).trim(),
    body: String(body).trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/* ------------------------ Library (editável) ------------------------ */
async function libCreate({ title, category, content, authorUid }) {
  if (!title || !content) throw new Error("Título e conteúdo são obrigatórios.");
  await addDoc(collection(db, "library"), {
    title: String(title).trim(),
    category: String(category || "").trim(),
    content: String(content).trim(),
    authorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

async function libLoad() {
  logLib("Carregando biblioteca...");
  const qy = query(collection(db, "library"), orderBy("createdAt", "desc"), limit(50));
  const snap = await getDocs(qy);

  const list = $("libList");
  list.innerHTML = "";
  snap.forEach((d) => {
    const it = { id: d.id, ...d.data() };
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="item-title">${escapeHtml(it.title || "(sem título)")}</div>
      <div class="muted">${escapeHtml(it.category || "")}</div>
      <div class="muted" style="margin-top:6px;">id: ${escapeHtml(d.id)}</div>
      <details style="margin-top:8px;">
        <summary class="muted">Ver conteúdo</summary>
        <pre class="item" style="white-space:pre-wrap;overflow:auto;">${escapeHtml(it.content || "")}</pre>
      </details>
    `;
    list.appendChild(item);
  });

  logLib(`OK: biblioteca carregada (${snap.size}).`);
}

/* ------------------------ Reports ------------------------ */
async function reportsLoad() {
  logRep("Carregando relatórios...");
  await loadKpis();

  const classList = $("repClassList");
  const enrList = $("repEnrList");
  classList.innerHTML = "";
  enrList.innerHTML = "";

  const cls = await getDocs(query(collection(db, "classes"), orderBy("createdAt", "desc"), limit(20)));
  cls.forEach((d) => {
    const cl = d.data();
    classList.appendChild(renderSimpleItem("Turma", cl.name || "(sem nome)", d.id));
  });

  const enrs = await getDocs(query(collection(db, "enrollments"), orderBy("createdAt", "desc"), limit(30)));
  enrs.forEach((d) => {
    const e = d.data();
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="item-title">Matrícula</div>
      <div class="muted">studentId: ${escapeHtml(e.studentId || "-")}</div>
      <div class="muted">classId: ${escapeHtml(e.classId || "-")}</div>
      <div class="muted">id: ${escapeHtml(d.id)}</div>
    `;
    enrList.appendChild(item);
  });

  logRep("OK: relatórios carregados.");
}

/* ------------------------ Boot ------------------------ */
let CURRENT_USER = null;
let PROFILE = null;

function bindTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });
}

function bindActions() {
  $("btnLogout")?.addEventListener("click", async () => {
    await signOut(auth);
    location.href = "./index.html";
  });

  $("btnRefreshAll1")?.addEventListener("click", async () => {
    await refreshAll();
  });
  $("btnRefreshAll2")?.addEventListener("click", async () => {
    await refreshAll();
  });

  $("btnCreateStudent")?.addEventListener("click", async () => {
    try {
      const res = await createOrInviteUser({
        name: $("studentName").value,
        email: $("studentEmail").value,
        role: "student",
      });
      showAlert(res.mode === "updated" ? "Aluno criado/atualizado em /users." : "Convite criado em /invites (crie no Auth depois).", "success");
      $("studentName").value = "";
      $("studentEmail").value = "";
      await refreshAll();
    } catch (e) {
      showAlert(e.message || String(e));
    }
  });

  $("btnCreateTeacher")?.addEventListener("click", async () => {
    try {
      const res = await createOrInviteUser({
        name: $("teacherName").value,
        email: $("teacherEmail").value,
        role: "teacher",
      });
      showAlert(res.mode === "updated" ? "Professor criado/atualizado em /users." : "Convite criado em /invites (crie no Auth depois).", "success");
      $("teacherName").value = "";
      $("teacherEmail").value = "";
      await refreshAll();
    } catch (e) {
      showAlert(e.message || String(e));
    }
  });

  $("btnCreateCourse")?.addEventListener("click", async () => {
    try {
      await createCourse($("courseName").value);
      showAlert("Curso criado.", "success");
      $("courseName").value = "";
      await refreshAll();
    } catch (e) {
      showAlert(e.message || String(e));
    }
  });
  $("btnReloadCourses")?.addEventListener("click", loadCourses);

  $("btnCreateClass")?.addEventListener("click", async () => {
    try {
      await createClass({
        name: $("className").value,
        courseId: $("classCourse").value,
        teacherId: $("classTeacher").value,
      });
      showAlert("Turma criada.", "success");
      $("className").value = "";
      await refreshAll();
    } catch (e) {
      showAlert(e.message || String(e));
    }
  });
  $("btnReloadClasses")?.addEventListener("click", loadClasses);

  $("btnCreateEnrollment")?.addEventListener("click", async () => {
    try {
      await createEnrollment({
        studentId: $("enrStudent").value,
        classId: $("enrClass").value,
      });
      showAlert("Matrícula criada.", "success");
      await refreshAll();
    } catch (e) {
      showAlert(e.message || String(e));
    }
  });
  $("btnReloadEnrollments")?.addEventListener("click", loadEnrollments);

  $("btnCreateNotice")?.addEventListener("click", async () => {
    try {
      await createNotice({
        title: $("noticeTitle").value,
        body: $("noticeBody").value,
      });
      showAlert("Aviso publicado.", "success");
      $("noticeTitle").value = "";
      $("noticeBody").value = "";
      await loadNotices();
    } catch (e) {
      showAlert(e.message || String(e));
    }
  });
  $("btnReloadNotices")?.addEventListener("click", loadNotices);

  // Library
  $("btnLibCreate")?.addEventListener("click", async () => {
    try {
      await libCreate({
        title: $("libTitle").value,
        category: $("libCategory").value,
        content: $("libContent").value,
        authorUid: CURRENT_USER?.uid || null,
      });
      showAlert("Item salvo na biblioteca.", "success");
      $("libTitle").value = "";
      $("libCategory").value = "";
      $("libContent").value = "";
      await libLoad();
    } catch (e) {
      showAlert(e.message || String(e));
    }
  });
  $("btnLibReload")?.addEventListener("click", libLoad);

  // Reports
  $("btnReportsReload")?.addEventListener("click", reportsLoad);
}

async function refreshAll() {
  await loadKpis();
  await loadUsers();
  await loadCourses();
  await loadClasses();
  await loadEnrollments();
  await loadNotices();
}

function requireAdmin(profile) {
  if (!profile) return false;
  if (profile.active !== true) return false;
  return profile.role === "admin";
}

(function main() {
  $("diag").textContent = "";
  $("diagLib").textContent = "";
  $("diagRep").textContent = "";

  log("Admin.js carregou.");
  bindTabs();
  bindActions();

  log("Aguardando autenticação (onAuthStateChanged)...");
  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        log("Sem usuário logado. Redirecionando para index...");
        location.href = "./index.html";
        return;
      }

      CURRENT_USER = user;
      log(`Auth OK. uid = ${user.uid} email = ${user.email || "-"}`);

      PROFILE = await getMyProfile(user.uid);

      if (!PROFILE) {
        showAlert("Perfil não encontrado em /users/{uid}. Peça para o admin criar seu perfil.", "danger");
        log("Perfil NÃO encontrado em /users/{uid}.");
        return;
      }

      $("whoName").textContent = PROFILE.name || (user.email || "Usuário");
      $("whoRole").textContent = PROFILE.role || "unknown";
      log("Perfil encontrado em /users/{uid}.");

      if (!requireAdmin(PROFILE)) {
        showAlert("Acesso negado: você não é admin ou está inativo.", "danger");
        log("Acesso negado: não é admin/active.");
        location.href = "./index.html";
        return;
      }

      log("Admin validado (role=admin, active=true).");
      await refreshAll();

      // Carrega biblioteca e relatórios em paralelo (sem travar)
      libLoad().catch((e) => logLib("ERRO: " + (e.message || String(e))));
      reportsLoad().catch((e) => logRep("ERRO: " + (e.message || String(e))));

    } catch (e) {
      showAlert(e.message || String(e), "danger");
      log("ERRO fatal: " + (e.message || String(e)));
    }
  });
})();