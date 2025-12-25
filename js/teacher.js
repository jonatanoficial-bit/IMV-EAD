// js/teacher.js (ETAPA 9) — Professor: turmas + aulas + chamada + avaliações + notas
import { auth, db } from "./firebase.js";
import { logout, requireUserProfile } from "./auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  limit
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

function qs(sel){ return document.querySelector(sel); }
function escapeHtml(s){ return (s??"").toString().replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])); }
function showMsg(el, ok, text){ el.className = ok ? "msg ok" : "msg err"; el.textContent=text; el.style.display="block"; }
function hideMsg(el){ if(el){ el.style.display="none"; el.textContent=""; } }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function toNum(s){
  const raw = (s||"").toString().trim();
  if(!raw) return 0;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function attendanceDocId(sessionId, studentId){ return `${sessionId}__${studentId}`; }
function gradeDocId(assessmentId, studentId){ return `${assessmentId}__${studentId}`; }

async function requireTeacher(){
  const { uid, profile } = await requireUserProfile();
  if (profile.role !== "teacher") throw new Error("Conta não é professor.");
  qs("#meName").textContent = profile.name || profile.email || "Professor";
  return { uid, profile };
}

async function loadMyClasses(teacherId){
  const sel = qs("#teacherClassSel");
  sel.innerHTML = `<option value="">Carregando...</option>`;
  const snap = await getDocs(query(collection(db, "classes"), where("teacherId","==",teacherId), orderBy("createdAt","desc")));
  sel.innerHTML = `<option value="">Selecione...</option>`;
  snap.forEach(d=>{
    const c = d.data();
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = `${c.name || "Turma"} • ${d.id}`;
    sel.appendChild(opt);
  });
  if(snap.size === 1){
    sel.value = snap.docs[0].id;
    sel.dispatchEvent(new Event("change"));
  }
}

async function getEnrollStudents(classId){
  const enrollSnap = await getDocs(query(collection(db, "enrollments"), where("classId","==",classId), where("status","==","active"), orderBy("createdAt","desc")));
  const studentIds = enrollSnap.docs.map(d=>d.data().studentId);

  const usersSnap = await getDocs(collection(db, "users"));
  const usersMap = new Map(usersSnap.docs.map(d=>[d.id, d.data()]));

  return studentIds.map(id=>{
    const u = usersMap.get(id) || {};
    return { id, name: u.name || "", email: u.email || "" };
  });
}

async function renderClassInfo(classId){
  const info = qs("#classInfo");
  if(!classId){ info.innerHTML = "—"; return; }
  const cSnap = await getDoc(doc(db,"classes",classId));
  const c = cSnap.exists() ? cSnap.data() : {};
  const link = c.meetingLink ? `<a class="chip" href="${escapeHtml(c.meetingLink)}" target="_blank" rel="noopener">Abrir link</a>` : "";
  info.innerHTML = `
    <div class="item">
      <div class="row">
        <div>
          <div class="title">${escapeHtml(c.name || classId)}</div>
          <div class="muted">Modalidade: ${escapeHtml(c.modality || "-")} ${c.schedule ? "• " + escapeHtml(c.schedule) : ""}</div>
        </div>
        <div class="inline">${link}<span class="pill">turma</span></div>
      </div>
      ${c.notes ? `<div class="muted" style="white-space:pre-wrap; margin-top:8px;">${escapeHtml(c.notes)}</div>` : ""}
    </div>
  `;
}

async function createSession({ classId, teacherId, date, topic, notes }){
  const ref = await addDoc(collection(db,"classSessions"), {
    classId, teacherId, date,
    topic: topic || "",
    notes: notes || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

async function loadSessions(classId){
  const list = qs("#sessionsList");
  const sel = qs("#sessionSel");
  list.innerHTML = "Carregando...";
  sel.innerHTML = `<option value="">Carregando...</option>`;

  const snap = await getDocs(query(collection(db,"classSessions"), where("classId","==",classId), orderBy("date","desc"), limit(30)));
  if(snap.empty){
    list.innerHTML = `<div class="muted">Nenhuma aula criada ainda.</div>`;
    sel.innerHTML = `<option value="">—</option>`;
    return [];
  }

  const rows = snap.docs.map(d=>({ id:d.id, ...d.data() }));
  list.innerHTML = rows.map(r=>`
    <div class="item">
      <div class="row">
        <div>
          <div class="title">${escapeHtml(r.date || "-")} ${r.topic ? "• " + escapeHtml(r.topic) : ""}</div>
          ${r.notes ? `<div class="muted" style="white-space:pre-wrap; margin-top:6px;">${escapeHtml(r.notes)}</div>` : `<div class="muted">Sem observações.</div>`}
        </div>
        <div class="pill">aula</div>
      </div>
      <div class="muted" style="margin-top:6px;">sessionId: ${escapeHtml(r.id)}</div>
    </div>
  `).join("");

  sel.innerHTML = `<option value="">Selecione a aula...</option>` + rows.map(r=>`
    <option value="${escapeHtml(r.id)}">${escapeHtml(r.date || "-")} ${r.topic ? "• " + escapeHtml(r.topic) : ""}</option>
  `).join("");

  sel.value = rows[0].id;
  sel.dispatchEvent(new Event("change"));
  return rows;
}

async function loadAttendanceRecords(sessionId){
  const snap = await getDocs(query(collection(db,"attendanceRecords"), where("sessionId","==",sessionId)));
  const map = new Map();
  snap.forEach(d=> map.set(d.data().studentId, { id:d.id, ...d.data() }));
  return map;
}

async function renderAttendanceBox({ classId, sessionId, teacherId }){
  const box = qs("#attendanceBox");
  if(!classId || !sessionId){
    box.innerHTML = `<div class="muted">Selecione turma e aula.</div>`;
    return;
  }
  box.innerHTML = "Carregando...";

  const students = await getEnrollStudents(classId);
  const recordsMap = await loadAttendanceRecords(sessionId);

  if(!students.length){
    box.innerHTML = `<div class="muted">Sem alunos matriculados nessa turma.</div>`;
    return;
  }

  box.innerHTML = `
    <div class="item">
      <div class="row">
        <div>
          <div class="title">Chamada</div>
          <div class="muted">Marque presença: Presente / Falta / Atraso / Justificada</div>
        </div>
        <div class="pill">presença</div>
      </div>

      <table class="table" style="margin-top:10px;">
        <thead>
          <tr>
            <th>Aluno</th>
            <th>Status</th>
            <th>Obs</th>
            <th>Salvar</th>
          </tr>
        </thead>
        <tbody>
          ${students.map(s=>{
            const rec = recordsMap.get(s.id);
            const status = rec?.status || "present";
            const note = rec?.note || "";
            return `
              <tr>
                <td>
                  <div style="font-weight:900;">${escapeHtml(s.name || "Aluno")}</div>
                  <div class="muted">${escapeHtml(s.email || s.id)}</div>
                </td>
                <td style="min-width:170px;">
                  <select class="input" data-att-status="${escapeHtml(s.id)}">
                    <option value="present" ${status==="present"?"selected":""}>Presente</option>
                    <option value="absent" ${status==="absent"?"selected":""}>Falta</option>
                    <option value="late" ${status==="late"?"selected":""}>Atraso</option>
                    <option value="excused" ${status==="excused"?"selected":""}>Justificada</option>
                  </select>
                </td>
                <td style="min-width:220px;">
                  <input class="input" data-att-note="${escapeHtml(s.id)}" placeholder="Opcional" value="${escapeHtml(note)}" />
                </td>
                <td style="min-width:120px;">
                  <button class="smallBtn secondary" data-att-save="${escapeHtml(s.id)}">Salvar</button>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  box.querySelectorAll("[data-att-save]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const studentId = btn.getAttribute("data-att-save");
      const stEl = box.querySelector(`[data-att-status="${CSS.escape(studentId)}"]`);
      const noteEl = box.querySelector(`[data-att-note="${CSS.escape(studentId)}"]`);
      const status = (stEl?.value || "present").trim();
      const note = (noteEl?.value || "").trim();

      btn.disabled = true;
      btn.textContent = "Salvando...";
      try{
        const id = attendanceDocId(sessionId, studentId);
        await setDoc(doc(db,"attendanceRecords",id), {
          classId, sessionId, studentId, teacherId,
          status, note,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        }, { merge:true });

        btn.textContent = "Salvo ✅";
        setTimeout(()=>{ btn.textContent="Salvar"; btn.disabled=false; }, 800);
      }catch{
        btn.disabled=false;
        btn.textContent="Erro";
      }
    });
  });
}

async function createAssessment({ classId, teacherId, title, date, maxScore, description }){
  const ref = await addDoc(collection(db,"assessments"), {
    classId, teacherId, title, date, maxScore,
    description: description || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

async function loadAssessments(classId){
  const list = qs("#assessmentsList");
  const sel = qs("#assessSel");
  list.innerHTML = "Carregando...";
  sel.innerHTML = `<option value="">Carregando...</option>`;

  const snap = await getDocs(query(collection(db,"assessments"), where("classId","==",classId), orderBy("date","desc"), limit(30)));
  if(snap.empty){
    list.innerHTML = `<div class="muted">Nenhuma avaliação criada ainda.</div>`;
    sel.innerHTML = `<option value="">—</option>`;
    return [];
  }

  const rows = snap.docs.map(d=>({ id:d.id, ...d.data() }));

  list.innerHTML = rows.map(r=>`
    <div class="item">
      <div class="row">
        <div>
          <div class="title">${escapeHtml(r.title || "Avaliação")} • ${escapeHtml(r.date || "-")}</div>
          <div class="muted">Máx: ${escapeHtml(String(r.maxScore || 0))}</div>
          ${r.description ? `<div class="muted" style="white-space:pre-wrap; margin-top:6px;">${escapeHtml(r.description)}</div>` : ""}
        </div>
        <div class="pill">avaliação</div>
      </div>
      <div class="muted" style="margin-top:6px;">assessmentId: ${escapeHtml(r.id)}</div>
    </div>
  `).join("");

  sel.innerHTML = `<option value="">Selecione a avaliação...</option>` + rows.map(r=>`
    <option value="${escapeHtml(r.id)}">${escapeHtml(r.title || "Avaliação")} • ${escapeHtml(r.date || "-")}</option>
  `).join("");

  sel.value = rows[0].id;
  sel.dispatchEvent(new Event("change"));
  return rows;
}

async function loadGrades(assessmentId){
  const snap = await getDocs(query(collection(db,"grades"), where("assessmentId","==",assessmentId)));
  const map = new Map();
  snap.forEach(d=> map.set(d.data().studentId, { id:d.id, ...d.data() }));
  return map;
}

async function renderGradesBox({ classId, assessmentId, teacherId }){
  const box = qs("#gradesBox");
  if(!classId || !assessmentId){
    box.innerHTML = `<div class="muted">Selecione turma e avaliação.</div>`;
    return;
  }
  box.innerHTML = "Carregando...";

  const students = await getEnrollStudents(classId);
  if(!students.length){
    box.innerHTML = `<div class="muted">Sem alunos matriculados nessa turma.</div>`;
    return;
  }

  const aSnap = await getDoc(doc(db,"assessments",assessmentId));
  const a = aSnap.exists() ? aSnap.data() : {};
  const maxScore = Number(a.maxScore || 10);

  const gradesMap = await loadGrades(assessmentId);

  box.innerHTML = `
    <div class="item">
      <div class="row">
        <div>
          <div class="title">Notas • ${escapeHtml(a.title || "Avaliação")}</div>
          <div class="muted">Máximo: ${escapeHtml(String(maxScore))}</div>
        </div>
        <div class="pill">notas</div>
      </div>

      <table class="table" style="margin-top:10px;">
        <thead>
          <tr>
            <th>Aluno</th>
            <th>Nota</th>
            <th>Comentário</th>
            <th>Salvar</th>
          </tr>
        </thead>
        <tbody>
          ${students.map(s=>{
            const g = gradesMap.get(s.id);
            const score = (g?.score ?? "").toString();
            const comment = g?.comment || "";
            return `
              <tr>
                <td>
                  <div style="font-weight:900;">${escapeHtml(s.name || "Aluno")}</div>
                  <div class="muted">${escapeHtml(s.email || s.id)}</div>
                </td>
                <td style="min-width:120px;">
                  <input class="input" data-grade-score="${escapeHtml(s.id)}" inputmode="decimal" placeholder="0-${escapeHtml(String(maxScore))}" value="${escapeHtml(score)}" />
                </td>
                <td style="min-width:240px;">
                  <input class="input" data-grade-comment="${escapeHtml(s.id)}" placeholder="Opcional" value="${escapeHtml(comment)}" />
                </td>
                <td style="min-width:120px;">
                  <button class="smallBtn secondary" data-grade-save="${escapeHtml(s.id)}">Salvar</button>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  box.querySelectorAll("[data-grade-save]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const studentId = btn.getAttribute("data-grade-save");
      const scoreEl = box.querySelector(`[data-grade-score="${CSS.escape(studentId)}"]`);
      const comEl = box.querySelector(`[data-grade-comment="${CSS.escape(studentId)}"]`);

      const score = toNum(scoreEl?.value || "");
      const comment = (comEl?.value || "").trim();

      btn.disabled = true;
      btn.textContent = "Salvando...";
      try{
        const id = gradeDocId(assessmentId, studentId);
        await setDoc(doc(db,"grades",id), {
          classId, assessmentId, studentId, teacherId,
          score, comment,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        }, { merge:true });

        btn.textContent="Salvo ✅";
        setTimeout(()=>{ btn.textContent="Salvar"; btn.disabled=false; }, 800);
      }catch{
        btn.disabled=false;
        btn.textContent="Erro";
      }
    });
  });
}

async function main(){
  try{
    qs("#btnLogout").addEventListener("click", ()=>logout());

    qs("#sessionDate").value = todayISO();
    qs("#assessDate").value = todayISO();
    qs("#assessMax").value = "10";

    const me = await requireTeacher();

    await loadMyClasses(me.uid);

    qs("#teacherClassSel").addEventListener("change", async ()=>{
      const classId = qs("#teacherClassSel").value;
      qs("#attendanceBox").innerHTML = `<div class="muted">Selecione uma aula.</div>`;
      qs("#gradesBox").innerHTML = `<div class="muted">Selecione uma avaliação.</div>`;
      qs("#sessionsList").innerHTML = "";
      qs("#assessmentsList").innerHTML = "";

      if(!classId){ await renderClassInfo(""); return; }

      await renderClassInfo(classId);
      await loadSessions(classId);
      await loadAssessments(classId);
    });

    qs("#formCreateSession").addEventListener("submit", async (ev)=>{
      ev.preventDefault();
      const msg = qs("#msgSession"); hideMsg(msg);

      const classId = qs("#teacherClassSel").value;
      const date = qs("#sessionDate").value;
      const topic = (qs("#sessionTopic").value || "").trim();
      const notes = (qs("#sessionNotes").value || "").trim();

      try{
        if(!classId) throw new Error("Selecione a turma.");
        if(!date) throw new Error("Informe a data.");
        await createSession({ classId, teacherId: me.uid, date, topic, notes });
        showMsg(msg,true,"Aula criada!");
        qs("#sessionTopic").value="";
        qs("#sessionNotes").value="";
        await loadSessions(classId);
      }catch(e){
        showMsg(msg,false,e?.message || "Erro ao criar aula.");
      }
    });

    qs("#sessionSel").addEventListener("change", async ()=>{
      const classId = qs("#teacherClassSel").value;
      const sessionId = qs("#sessionSel").value;
      await renderAttendanceBox({ classId, sessionId, teacherId: me.uid });
    });

    qs("#formCreateAssessment").addEventListener("submit", async (ev)=>{
      ev.preventDefault();
      const msg = qs("#msgAssess"); hideMsg(msg);

      const classId = qs("#teacherClassSel").value;
      const title = (qs("#assessTitle").value || "").trim();
      const date = qs("#assessDate").value;
      const maxScore = toNum(qs("#assessMax").value);
      const description = (qs("#assessDesc").value || "").trim();

      try{
        if(!classId) throw new Error("Selecione a turma.");
        if(!title) throw new Error("Nome da avaliação é obrigatório.");
        if(!date) throw new Error("Informe a data.");
        if(!maxScore || maxScore <= 0) throw new Error("Nota máxima inválida.");

        await createAssessment({ classId, teacherId: me.uid, title, date, maxScore, description });
        showMsg(msg,true,"Avaliação criada!");
        qs("#assessTitle").value="";
        qs("#assessDesc").value="";
        await loadAssessments(classId);
      }catch(e){
        showMsg(msg,false,e?.message || "Erro ao criar avaliação.");
      }
    });

    qs("#assessSel").addEventListener("change", async ()=>{
      const classId = qs("#teacherClassSel").value;
      const assessmentId = qs("#assessSel").value;
      await renderGradesBox({ classId, assessmentId, teacherId: me.uid });
    });

  }catch(e){
    qs("#fatal").style.display="block";
    qs("#fatal").textContent = e?.message || "Erro no painel do professor.";
  }
}
main();