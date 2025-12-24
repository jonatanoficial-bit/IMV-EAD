// js/teacher.js
// Painel do Professor: listar turmas do professor, alunos matriculados, presença/nota/comentário.
// Correções:
// - não trava em "carregando": mostra erro na tela
// - busca turmas via getDocs(collection) e filtra no JS (menos chance de index)
// - logs e mensagens claras em caso de permission-denied

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
  getDocs,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

function showBox(el, text, isError = false) {
  if (!el) return;
  el.style.display = "block";
  el.textContent = text;
  el.style.borderColor = isError ? "rgba(255,92,122,.45)" : "rgba(72,213,151,.35)";
  el.style.background = isError ? "rgba(255,92,122,.10)" : "rgba(72,213,151,.08)";
}
function hideBox(el) {
  if (!el) return;
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
function safeSortByLabel(a, b) {
  return (a.label || "").toLowerCase().localeCompare((b.label || "").toLowerCase());
}
function safeSortByName(a, b) {
  const an = (a?.studentName || a?.studentEmail || "").toLowerCase();
  const bn = (b?.studentName || b?.studentEmail || "").toLowerCase();
  return an.localeCompare(bn);
}
function prettyErr(e) {
  const msg = (e?.message || String(e || "")).toLowerCase();
  if (msg.includes("permission-denied")) return "❌ Sem permissão no Firestore (permission-denied). Precisa ajustar as Rules para professor ler turmas/matrículas.";
  if (msg.includes("requires an index")) return "❌ Firestore pediu índice. (Não deveria aqui. Me mande print do erro.)";
  if (msg.includes("network")) return "❌ Falha de rede. Tente novamente.";
  return "❌ Erro: " + (e?.message || String(e));
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

// ================== Estado ==================
let currentTeacher = null;
let currentEnrollments = [];

// ================== Turmas do professor ==================
async function loadMyClasses(teacherId) {
  const sel = $("selClass");
  const histTbody = $("histTbody");
  const studentsTbody = $("studentsTbody");

  if (sel) sel.innerHTML = `<option value="">Carregando turmas…</option>`;
  if (histTbody) histTbody.innerHTML = `<tr><td colspan="4" class="muted">Selecione uma turma para ver o histórico.</td></tr>`;
  if (studentsTbody) studentsTbody.innerHTML = `<tr><td colspan="4" class="muted">Selecione uma turma e clique em “Carregar alunos”.</td></tr>`;

  try {
    // ✅ Carrega todas as turmas e filtra no JS (evita índice e evita where falhar por regras específicas)
    const snap = await getDocs(collection(db, "classes"));

    const list = [];
    snap.forEach(s => {
      const d = s.data() || {};
      if (d.active !== true) return;
      if (String(d.teacherId || "") !== String(teacherId)) return;

      const label = `${d.title || s.id} • ${d.courseName || ""}`.trim();
      list.push({ id: s.id, label });
    });

    list.sort(safeSortByLabel);

    if (!sel) return;

    sel.innerHTML = list.length
      ? `<option value="">Selecione uma turma</option>` +
        list.map(x => `<option value="${escapeHtml(x.id)}">${escapeHtml(x.label)}</option>`).join("")
      : `<option value="">Nenhuma turma ativa (para este professor)</option>`;

  } catch (e) {
    console.error("loadMyClasses error:", e);
    if (sel) sel.innerHTML = `<option value="">Erro ao carregar turmas</option>`;
    alert(prettyErr(e));
  }
}

// ================== Data da aula ==================
function setTodayIfEmpty() {
  const inp = $("lessonDate");
  if (!inp) return;
  if (inp.value) return;
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  inp.value = `${yyyy}-${mm}-${dd}`;
}
function getLessonDate() {
  return ($("lessonDate")?.value || "");
}
function attendanceDocId(classId, date, studentId) {
  return `${classId}_${date}_${studentId}`;
}

// ================== Alunos matriculados ==================
async function loadStudentsForClass(classId) {
  const tbody = $("studentsTbody");
  const out = $("outSave");
  hideBox(out);

  if ($("studentsCount")) $("studentsCount").textContent = "0";
  if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="muted">Carregando…</td></tr>`;

  try {
    // ✅ Busca enrollments por classId (pode depender de rules; se negar, mostra erro)
    const qy = query(collection(db, "enrollments"), where("classId", "==", classId));
    const snap = await getDocs(qy);

    const list = [];
    snap.forEach(s => {
      const d = s.data() || {};
      if (d.active !== true) return;
      list.push({ id: s.id, ...d });
    });

    list.sort(safeSortByName);
    currentEnrollments = list;

    if ($("studentsCount")) $("studentsCount").textContent = String(list.length);

    if (!tbody) return;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="muted">Nenhum aluno matriculado nesta turma.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((e) => `
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
        <td><input class="input grade" placeholder="0–10 ou texto" /></td>
        <td><input class="input note" placeholder="Comentário rápido da aula" /></td>
      </tr>
    `).join("");

    await preloadAttendanceForDate(classId);
    await loadHistoryForClass(classId);

  } catch (e) {
    console.error("loadStudentsForClass error:", e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="muted">Erro ao carregar alunos.</td></tr>`;
    alert(prettyErr(e));
  }
}

async function preloadAttendanceForDate(classId) {
  const date = getLessonDate();
  if (!date) return;

  const tbody = $("studentsTbody");
  const trs = Array.from(tbody?.querySelectorAll("tr[data-student]") || []);
  if (!trs.length) return;

  try {
    for (const tr of trs) {
      const studentId = tr.getAttribute("data-student");
      const docId = attendanceDocId(classId, date, studentId);
      const snap = await getDoc(doc(db, "attendance", docId));
      if (!snap.exists()) continue;

      const data = snap.data() || {};
      const presenceSel = tr.querySelector("select.presence");
      const gradeInp = tr.querySelector("input.grade");
      const noteInp = tr.querySelector("input.note");

      if (presenceSel && data.presence) presenceSel.value = data.presence;
      if (gradeInp && typeof data.grade !== "undefined") gradeInp.value = String(data.grade || "");
      if (noteInp && typeof data.note !== "undefined") noteInp.value = String(data.note || "");
    }
  } catch (e) {
    console.error("preloadAttendanceForDate error:", e);
    // não trava a tela, só avisa
  }
}

// ================== Salvar presença/nota ==================
async function saveAllForDate() {
  const out = $("outSave");
  hideBox(out);

  const classId = $("selClass")?.value || "";
  const date = getLessonDate();

  if (!classId) { showBox(out, "❌ Selecione uma turma.", true); return; }
  if (!date) { showBox(out, "❌ Selecione a data da aula.", true); return; }

  const tbody = $("studentsTbody");
  const trs = Array.from(tbody?.querySelectorAll("tr[data-student]") || []);
  if (!trs.length) { showBox(out, "❌ Não há alunos para salvar.", true); return; }

  try {
    const clSnap = await getDoc(doc(db, "classes", classId));
    const cl = clSnap.exists() ? (clSnap.data() || {}) : {};

    let ok = 0;
    for (const tr of trs) {
      const studentId = tr.getAttribute("data-student");
      const enrollId = tr.getAttribute("data-enroll") || "";

      const presence = tr.querySelector("select.presence")?.value || "presente";
      const grade = tr.querySelector("input.grade")?.value?.trim() || "";
      const note = tr.querySelector("input.note")?.value?.trim() || "";

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
        date,
        presence,
        grade,
        note,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docId = attendanceDocId(classId, date, studentId);
      await setDoc(doc(db, "attendance", docId), payload, { merge: true });
      ok++;
    }

    showBox(out, `✅ Salvo!\nTurma: ${cl.title || classId}\nData: ${date}\nRegistros: ${ok}`, false);
    await loadHistoryForClass(classId);

  } catch (e) {
    console.error("saveAllForDate error:", e);
    showBox(out, prettyErr(e), true);
  }
}

// ================== Histórico ==================
async function loadHistoryForClass(classId) {
  const tbody = $("histTbody");
  if ($("histCount")) $("histCount").textContent = "0";
  if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="muted">Carregando…</td></tr>`;

  try {
    const qy = query(collection(db, "attendance"), where("classId", "==", classId));
    const snap = await getDocs(qy);

    const list = [];
    snap.forEach(s => list.push(s.data() || {}));

    list.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    const sliced = list.slice(0, 30);

    if ($("histCount")) $("histCount").textContent = String(sliced.length);

    if (!tbody) return;

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

  } catch (e) {
    console.error("loadHistoryForClass error:", e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="muted">Erro ao carregar histórico.</td></tr>`;
  }
}

// ================== Eventos ==================
$("btnLogout")?.addEventListener("click", logout);

$("btnLoad")?.addEventListener("click", async () => {
  const classId = $("selClass")?.value || "";
  if (!classId) return alert("Selecione uma turma.");
  await loadStudentsForClass(classId);
});

$("btnSaveAll")?.addEventListener("click", saveAllForDate);

$("btnReloadHistory")?.addEventListener("click", async () => {
  const classId = $("selClass")?.value || "";
  if (!classId) return;
  await loadHistoryForClass(classId);
});

// ================== Boot ==================
setTodayIfEmpty();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }

  const profile = await requireTeacher(user);
  if (!profile) return;

  currentTeacher = { uid: user.uid, ...profile };
  if ($("who")) $("who").textContent = `${profile.name || user.email} • (professor)`;

  await loadMyClasses(user.uid);
});