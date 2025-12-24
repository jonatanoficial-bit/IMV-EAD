// js/teacher.js
import { auth, db } from "./firebase.js";
import { logout, getMyProfile } from "./auth.js";

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

function qs(sel){ return document.querySelector(sel); }
function escapeHtml(s){ return (s??"").toString().replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])); }
function todayISO(){ return new Date().toISOString().slice(0,10); }

async function requireTeacher() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Não autenticado.");
  const prof = await getMyProfile(uid);
  if (!prof || prof.role !== "teacher") throw new Error("Conta não é professor.");
  qs("#meName").textContent = prof.name || prof.email || "Professor";
}

async function loadMyClasses() {
  const uid = auth.currentUser.uid;
  const sel = qs("#classSelect");
  sel.innerHTML = `<option value="">Carregando...</option>`;

  const qy = query(collection(db, "classes"), where("teacherId", "==", uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(qy);

  sel.innerHTML = `<option value="">Selecione uma turma</option>`;
  snap.forEach(d => {
    const c = d.data();
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = c.name || d.id;
    sel.appendChild(opt);
  });

  qs("#classStatus").textContent = snap.size ? "" : "Nenhuma turma vinculada a este professor ainda.";
}

async function loadStudentsForClass(classId) {
  const wrap = qs("#studentsList");
  wrap.innerHTML = "Carregando alunos...";

  // Matrículas da turma
  const qy = query(collection(db, "enrollments"), where("classId", "==", classId), orderBy("createdAt", "desc"));
  const snap = await getDocs(qy);

  if (snap.empty) {
    wrap.innerHTML = "<div class='muted'>Nenhum aluno matriculado nesta turma.</div>";
    return [];
  }

  const rows = snap.docs.map(d => d.data());
  wrap.innerHTML = rows.map((e, idx) => `
    <div class="rowLine">
      <div class="col grow">
        <div class="title">Aluno UID: ${escapeHtml(e.studentId)}</div>
        <div class="muted">Matrícula: ${escapeHtml(e.status || "active")}</div>
      </div>
      <div class="col">
        <label class="mini">Presença</label>
        <select class="input" data-presence="${idx}">
          <option value="present">Presente</option>
          <option value="absent">Faltou</option>
        </select>
      </div>
      <div class="col">
        <label class="mini">Nota</label>
        <input class="input" data-grade="${idx}" placeholder="0-10" inputmode="decimal" />
      </div>
      <div class="col">
        <label class="mini">Comentário</label>
        <input class="input" data-comment="${idx}" placeholder="Observação" />
      </div>
    </div>
  `).join("");

  return rows;
}

async function saveAttendance(classId, enrollRows) {
  const uid = auth.currentUser.uid;
  const date = (qs("#dateInput").value || todayISO()).trim();

  for (let i = 0; i < enrollRows.length; i++) {
    const studentId = enrollRows[i].studentId;
    const presentVal = qs(`[data-presence="${i}"]`)?.value || "present";
    const grade = (qs(`[data-grade="${i}"]`)?.value || "").trim();
    const comment = (qs(`[data-comment="${i}"]`)?.value || "").trim();

    await addDoc(collection(db, "attendance"), {
      classId,
      teacherId: uid,
      studentId,
      date,
      present: presentVal === "present",
      grade: grade ? Number(grade.replace(",", ".")) : null,
      comment,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}

async function main() {
  try {
    await requireTeacher();

    qs("#btnLogout").addEventListener("click", async () => logout());
    qs("#dateInput").value = todayISO();

    await loadMyClasses();

    let currentEnroll = [];

    qs("#classSelect").addEventListener("change", async () => {
      const classId = qs("#classSelect").value;
      if (!classId) {
        qs("#studentsList").innerHTML = "<div class='muted'>Selecione uma turma.</div>";
        return;
      }
      currentEnroll = await loadStudentsForClass(classId);
    });

    qs("#btnSave").addEventListener("click", async () => {
      const classId = qs("#classSelect").value;
      const msg = qs("#msg");
      msg.style.display = "none";

      try {
        if (!classId) throw new Error("Selecione uma turma.");
        if (!currentEnroll.length) throw new Error("Sem alunos para registrar.");

        qs("#btnSave").disabled = true;
        qs("#btnSave").textContent = "Salvando...";

        await saveAttendance(classId, currentEnroll);

        msg.className = "msg ok";
        msg.textContent = "Presença/nota/comentário registrados!";
        msg.style.display = "block";
      } catch (e) {
        msg.className = "msg err";
        msg.textContent = e?.message || "Erro ao salvar.";
        msg.style.display = "block";
      } finally {
        qs("#btnSave").disabled = false;
        qs("#btnSave").textContent = "Salvar presença/nota/comentário";
      }
    });
  } catch (e) {
    qs("#fatal").style.display = "block";
    qs("#fatal").textContent = e?.message || "Erro no painel do professor.";
  }
}

main();