// js/teacher.js
// Painel do Professor: ver turmas do professor, listar alunos matriculados e salvar presença/nota/comentário.

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  setDoc,
  serverTimestamp,
  limit
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

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
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function safeSortByName(a, b) {
  const an = (a?.studentName || a?.studentEmail || "").toLowerCase();
  const bn = (b?.studentName || b?.studentEmail || "").toLowerCase();
  return an.localeCompare(bn);
}

async function logout() {
  await signOut(auth);
  window.location.href = "./index.html";
}

async function getUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

async function requireTeacher(user) {
  const profile = await getUserProfile(user.uid);
  if (!profile || String(profile.role || "").toLowerCase() !== "teacher") {
    alert("Acesso negado: apenas professor.");
    await logout();
    return null;
  }
  if (profile.active !== true) {
    alert("Sua conta está desativada. Fale com a administração.");
    await logout();
    return null;
  }
  return profile;
}

// ================== Turmas do professor ==================
async function loadMyClasses(teacherId) {
  const sel = $("selClass");
  sel.innerHTML = `<option value="">Carregando turmas…</option>`;

  // ✅ sem orderBy para evitar índice. Ordenamos no JS.
  const qy = query(collection(db, "classes"), where("teacherId", "==", teacherId));
  const snap = await getDocs(qy);

  const list = [];
  snap.forEach(s => {
    const d = s.data() || {};
    if (d.active !== true) return;
    const label = `${d.title || s.id} • ${d.courseName || ""}`.trim();
    list.push({ id: s.id, label });
  });

  list.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));

  sel.innerHTML = list.length
    ? `<option value="">Selecione uma turma</option>` + list.map(x => `<option value="${x.id}">${escapeHtml(x.label)}</option>`).join("")
    : `<option value="">Nenhuma turma ativa</option>`;
}

// ================== Alunos matriculados ==================
let currentTeacher = null;
let currentClass = null;
let currentEnrollments = []; // enrollments da turma carregada

async function loadStudentsForClass(classId) {
  const tbody = $("studentsTbody");
  const out = $("outSave");
  hideBox(out);

  $("studentsCount").textContent = "0";
  tbody.innerHTML = `<tr><td colspan="4" class="muted">Carregando…</td></tr>`;

  // Carrega enrollments da turma
  const qy = query(collection(db, "enrollments"), where("classId", "==", classId));
  const snap = await getDocs(qy);

  const list = [];
  snap.forEach(s => {
    const d = s.data() || {};
    // Só ativos
    if (d.active !== true) return;
    list.push({ id: s.id, ...d });
  });

  list.sort(safeSortByName);
  currentEnrollments = list;

  $("studentsCount").textContent = String(list.length);

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="muted">Nenhum aluno matriculado nesta turma.</td></tr>`;
    return;
  }

  // Render tabela
  const rows = list.map((e) => {
    return `
      <tr data-enroll="${escapeHtml(e.id)}" data-student="${escapeHtml(e.studentId)}">
        <td>
          <b>${escapeHtml(e.studentName || e.studentEmail || "Aluno")}</b><br>
          <span class="muted">${escapeHtml(e.studentEmail || "")}</span>
        </td>
        <td>
          <select class="input presence">
            <option value="presente">presente</option>
            <option value="falta">falta</option>
            <option value="justificada">justificada</option>
          </select>
        </td>
        <td>
          <input class="input grade" placeholder="0–10 ou texto" />
        </td>
        <td>
          <input class="input note" placeholder="Comentário rápido da aula" />
        </td>
      </tr>
    `;
  }).join("");

  tbody.innerHTML = rows;

  // pré-carregar dados já salvos para a data (se existirem)
  await preloadAttendanceForDate(classId);
}

function getLessonDate() {
  const d = $("lessonDate").value;
  return d || "";
}

// attendance docId: `${classId}_${date}_${studentId}`
function attendanceDocId(classId, date, studentId) {
  return `${classId}_${date}_${studentId}`;
}

async function preloadAttendanceForDate(classId) {
  const date = getLessonDate();
  if (!date) return;

  const tbody = $("studentsTbody");
  const trs = Array.from(tbody.querySelectorAll("tr[data-student]"));
  if (!trs.length) return;

  // Para não fazer N queries pesadas: vamos fazer getDoc individual (é ok com turma pequena)
  for (const tr of trs) {
    const studentId = tr.getAttribute("data-student");
    const docId = attendanceDocId(classId, date, studentId);
    const ref = doc(db, "attendance", docId);
    const snap = await getDoc(ref);
    if (!snap.exists()) continue;

    const data = snap.data() || {};
    const presenceSel = tr.querySelector("select.presence");
    const gradeInp = tr.querySelector("input.grade");
    const noteInp = tr.querySelector("input.note");

    if (presenceSel && data.presence) presenceSel.value = data.presence;
    if (gradeInp && typeof data.grade !== "undefined") gradeInp.value = String(data.grade || "");
    if (noteInp && typeof data.note !== "undefined") noteInp.value = String(data.note || "");
  }
}

async function saveAllForDate() {
  const out = $("outSave");
  hideBox(out);

  const classId = $("selClass").value;
  const date = getLessonDate();

  if (!classId) { showBox(out, "❌ Selecione uma turma.", true); return; }
  if (!date) { showBox(out, "❌ Selecione a data da aula.", true); return; }

  const tbody = $("studentsTbody");
  const trs = Array.from(tbody.querySelectorAll("tr[data-student]"));
  if (!trs.length) { showBox(out, "❌ Não há alunos para salvar.", true); return; }

  // Puxa info da turma (para salvar nomes junto)
  const clSnap = await getDoc(doc(db, "classes", classId));
  const cl = clSnap.exists() ? (clSnap.data() || {}) : {};

  let ok = 0;
  for (const tr of trs) {
    const studentId = tr.getAttribute("data-student");
    const enrollId = tr.getAttribute("data-enroll") || "";

    const presence = tr.querySelector("select.presence")?.value || "presente";
    const grade = tr.querySelector("input.grade")?.value?.trim() || "";
    const note = tr.querySelector("input.note")?.value?.trim() || "";

    // Busca enrollment no cache
    const enr = currentEnrollments.find(x => x.studentId === studentId) || {};

    const payload = {
      classId,
      classTitle: cl.title || "",
      courseId: cl.courseId || "",
      courseName: cl.courseName || "",
      teacherId: currentTeacher?.uid || "",
      teacherName: currentTeacher?.name || "",
      studentId,
      studentName: enr.studentName || "",
      studentEmail: enr.studentEmail || "",
      enrollmentId: enrollId,
      date, // YYYY-MM-DD
      presence, // presente / falta / justificada
      grade, // texto livre (0–10 ou observação)
      note,  // comentário
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docId = attendanceDocId(classId, date, studentId);
    await setDoc(doc(db, "attendance", docId), payload, { merge: true });
    ok++;
  }

  showBox(out, `✅ Salvo!\nTurma: ${cl.title || classId}\nData: ${date}\nRegistros: ${ok}`);

  await loadHistoryForClass(classId);
}

// ================== Histórico ==================
async function loadHistoryForClass(classId) {
  const tbody = $("histTbody");
  tbody.innerHTML = `<tr><td colspan="4" class="muted">Carregando…</td></tr>`;
  $("histCount").textContent = "0";

  // ✅ Pode pedir índice se usar where+orderBy. Vamos evitar:
  // - buscamos por where(classId) e ordenamos no JS por date desc.
  const qy = query(collection(db, "attendance"), where("classId", "==", classId));
  const snap = await getDocs(qy);

  const list = [];
  snap.forEach(s => {
    const d = s.data() || {};
    list.push(d);
  });

  // Ordena por date desc (string YYYY-MM-DD funciona)
  list.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

  // Mostra só os últimos 30 registros (pra não ficar pesado)
  const sliced = list.slice(0, 30);
  $("histCount").textContent = String(sliced.length);

  if (!sliced.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="muted">Ainda não há registros nesta turma.</td></tr>`;
    return;
  }

  tbody.innerHTML = sliced.map((r) => `
    <tr>
      <td>${escapeHtml(r.date || "")}</td>
      <td><b>${escapeHtml(r.studentName || r.studentEmail || "")}</b></td>
      <td>${escapeHtml(r.presence || "")}</td>
      <td>${escapeHtml(r.grade || "")}</td>
    </tr>
  `).join("");
}

// ================== UI events ==================
$("btnLogout")?.addEventListener("click", logout);

$("btnLoad")?.addEventListener("click", async () => {
  const classId = $("selClass").value;
  if (!classId) return alert("Selecione uma turma.");
  currentClass = classId;
  await loadStudentsForClass(classId);
  await loadHistoryForClass(classId);
});

$("btnSaveAll")?.addEventListener("click", saveAllForDate);

$("btnReloadHistory")?.addEventListener("click", async () => {
  const classId = $("selClass").value;
  if (!classId) return;
  await loadHistoryForClass(classId);
});

// default date = hoje
(function setToday() {
  const inp = $("lessonDate");
  if (!inp) return;
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  inp.value = `${yyyy}-${mm}-${dd}`;
})();

// ================== Boot ==================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }

  const profile = await requireTeacher(user);
  if (!profile) return;

  currentTeacher = { uid: user.uid, ...profile };
  $("who").textContent = `${profile.name || user.email} • (professor)`;

  await loadMyClasses(user.uid);

  // se só tiver 1 turma, selecionar automaticamente
  const sel = $("selClass");
  if (sel && sel.options.length === 2) {
    sel.selectedIndex = 1;
  }
});