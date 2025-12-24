// js/student.js
import { auth, db } from "./firebase.js";
import { logout, getMyProfile } from "./auth.js";

import {
  collection,
  getDocs,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

function qs(sel){ return document.querySelector(sel); }
function escapeHtml(s){ return (s??"").toString().replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])); }

async function requireStudent() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Não autenticado.");
  const prof = await getMyProfile(uid);
  if (!prof || prof.role !== "student") throw new Error("Conta não é aluno.");
  qs("#meName").textContent = prof.name || prof.email || "Aluno";
}

async function loadMyEnrollments() {
  const uid = auth.currentUser.uid;
  const wrap = qs("#enrollList");
  wrap.innerHTML = "Carregando...";

  const qy = query(collection(db, "enrollments"), where("studentId", "==", uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(qy);

  if (snap.empty) {
    wrap.innerHTML = "<div class='muted'>Você ainda não tem matrículas.</div>";
    return;
  }

  wrap.innerHTML = snap.docs.map(d => {
    const e = d.data();
    return `
      <div class="item">
        <div class="title">Turma: ${escapeHtml(e.classId || "-")}</div>
        <div class="muted">Status: ${escapeHtml(e.status || "active")}</div>
      </div>
    `;
  }).join("");
}

async function loadMyAttendance() {
  const uid = auth.currentUser.uid;
  const wrap = qs("#attList");
  wrap.innerHTML = "Carregando...";

  const qy = query(collection(db, "attendance"), where("studentId", "==", uid), orderBy("date", "desc"));
  const snap = await getDocs(qy);

  if (snap.empty) {
    wrap.innerHTML = "<div class='muted'>Sem registros ainda.</div>";
    return;
  }

  wrap.innerHTML = snap.docs.slice(0, 30).map(d => {
    const a = d.data();
    return `
      <div class="item">
        <div class="row">
          <div>
            <div class="title">${escapeHtml(a.date || "")} • ${a.present ? "✅ Presente" : "❌ Falta"}</div>
            <div class="muted">Turma: ${escapeHtml(a.classId || "-")}</div>
          </div>
          <div class="pill">${a.grade === null || a.grade === undefined ? "-" : escapeHtml(a.grade)}</div>
        </div>
        ${a.comment ? `<div class="muted" style="margin-top:6px;">${escapeHtml(a.comment)}</div>` : ""}
      </div>
    `;
  }).join("");
}

async function main() {
  try {
    await requireStudent();

    qs("#btnLogout").addEventListener("click", async () => logout());

    await loadMyEnrollments();
    await loadMyAttendance();
  } catch (e) {
    qs("#fatal").style.display = "block";
    qs("#fatal").textContent = e?.message || "Erro no painel do aluno.";
  }
}

main();