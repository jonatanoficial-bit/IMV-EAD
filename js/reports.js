// js/reports.js (ETAPA 9) — Admin: relatórios notas/presença + export CSV
import { auth, db } from "./firebase.js";
import { logout, requireUserProfile } from "./auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

function qs(sel){ return document.querySelector(sel); }
function escapeHtml(s){ return (s??"").toString().replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])); }
function showMsg(el, ok, text){ el.className = ok ? "msg ok" : "msg err"; el.textContent=text; el.style.display="block"; }
function hideMsg(el){ if(el){ el.style.display="none"; el.textContent=""; } }

function todayISO(){ return new Date().toISOString().slice(0,10); }

function downloadText(filename, text, mime="text/plain;charset=utf-8"){
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}
function toCSV(rows){
  const headers = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const esc = (v) => {
    const s = (v === null || v === undefined) ? "" : String(v);
    const safe = s.replace(/"/g,'""');
    return `"${safe}"`;
  };
  const lines = [];
  lines.push(headers.map(esc).join(","));
  for (const r of rows){
    lines.push(headers.map(h => esc(r[h])).join(","));
  }
  return lines.join("\n");
}

async function ensureAdmin(){
  const { uid, profile } = await requireUserProfile();
  if(profile.role !== "admin") throw new Error("Sem permissão (admin).");
  qs("#meName").textContent = profile.name || profile.email || "Admin";
  return { uid, profile };
}

async function fillClasses(){
  const s1 = qs("#repClassGrades");
  const s2 = qs("#repClassAttend");
  s1.innerHTML = `<option value="">Carregando...</option>`;
  s2.innerHTML = `<option value="">Carregando...</option>`;

  const snap = await getDocs(query(collection(db,"classes"), orderBy("createdAt","desc"), limit(100)));
  const opts = snap.docs.map(d=>{
    const c = d.data();
    return `<option value="${escapeHtml(d.id)}">${escapeHtml(c.name || "Turma")} • ${escapeHtml(d.id)}</option>`;
  }).join("");

  s1.innerHTML = `<option value="">Selecione...</option>` + opts;
  s2.innerHTML = `<option value="">Selecione...</option>` + opts;
}

async function reportGradesSummary(classId){
  const out = qs("#outGrades");
  out.innerHTML = "Carregando...";
  if(!classId) throw new Error("Selecione a turma.");

  const cSnap = await getDoc(doc(db,"classes",classId));
  const c = cSnap.exists() ? cSnap.data() : {};
  const className = c.name || classId;

  const enrollSnap = await getDocs(query(collection(db,"enrollments"), where("classId","==",classId), where("status","==","active")));
  const studentIds = enrollSnap.docs.map(d=>d.data().studentId);

  const usersSnap = await getDocs(collection(db,"users"));
  const usersMap = new Map(usersSnap.docs.map(d=>[d.id, d.data()]));

  const aSnap = await getDocs(query(collection(db,"assessments"), where("classId","==",classId), orderBy("date","desc")));
  const assessments = aSnap.docs.map(d=>({ id:d.id, ...d.data() }));

  const gSnap = await getDocs(query(collection(db,"grades"), where("classId","==",classId)));
  const grades = gSnap.docs.map(d=>({ id:d.id, ...d.data() }));

  const gradeByStudent = new Map();
  for(const g of grades){
    if(!gradeByStudent.has(g.studentId)) gradeByStudent.set(g.studentId, []);
    gradeByStudent.get(g.studentId).push(g);
  }

  const rows = studentIds.map(sid=>{
    const u = usersMap.get(sid) || {};
    const gs = gradeByStudent.get(sid) || [];
    const vals = gs.map(x=>Number(x.score||0)).filter(n=>Number.isFinite(n));
    const avg = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length) : null;
    return {
      studentId: sid,
      studentName: u.name || "",
      studentEmail: u.email || "",
      gradesCount: gs.length,
      average: avg==null ? "" : Math.round(avg*100)/100
    };
  });

  out.innerHTML = `
    <div class="item">
      <div class="row">
        <div>
          <div class="title">Resumo de Notas • ${escapeHtml(className)}</div>
          <div class="muted">Avaliações: ${assessments.length} • Alunos: ${studentIds.length} • Lançamentos: ${grades.length}</div>
        </div>
        <div class="pill">notas</div>
      </div>

      <table class="table" style="margin-top:10px;">
        <thead>
          <tr>
            <th>Aluno</th>
            <th>Email</th>
            <th>Qtd. notas</th>
            <th>Média</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r=>`
            <tr>
              <td><strong>${escapeHtml(r.studentName || r.studentId)}</strong></td>
              <td class="muted">${escapeHtml(r.studentEmail || "")}</td>
              <td>${escapeHtml(String(r.gradesCount))}</td>
              <td>${r.average===""? `<span class="pill">—</span>` : `<strong>${escapeHtml(String(r.average))}</strong>`}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function exportGradesCSV(classId){
  if(!classId) throw new Error("Selecione a turma.");

  const cSnap = await getDoc(doc(db,"classes",classId));
  const c = cSnap.exists() ? cSnap.data() : {};
  const className = c.name || classId;

  const usersSnap = await getDocs(collection(db,"users"));
  const usersMap = new Map(usersSnap.docs.map(d=>[d.id, d.data()]));

  const aSnap = await getDocs(query(collection(db,"assessments"), where("classId","==",classId), orderBy("date","desc")));
  const aMap = new Map(aSnap.docs.map(d=>[d.id, { id:d.id, ...d.data() }]));

  const gSnap = await getDocs(query(collection(db,"grades"), where("classId","==",classId)));
  const grades = gSnap.docs.map(d=>({ id:d.id, ...d.data() }));

  const rows = grades.map(g=>{
    const u = usersMap.get(g.studentId) || {};
    const a = aMap.get(g.assessmentId) || {};
    return {
      classId,
      className,
      assessmentId: g.assessmentId,
      assessmentTitle: a.title || "",
      assessmentDate: a.date || "",
      maxScore: a.maxScore || "",
      studentId: g.studentId,
      studentName: u.name || "",
      studentEmail: u.email || "",
      score: g.score ?? "",
      comment: g.comment || ""
    };
  });

  downloadText(`IMV_notas_${classId}.csv`, toCSV(rows), "text/csv;charset=utf-8");
}

function inRange(dateStr, from, to){
  if(!dateStr) return false;
  if(from && dateStr < from) return false;
  if(to && dateStr > to) return false;
  return true;
}

async function reportAttendSummary(classId, from, to){
  const out = qs("#outAttend");
  out.innerHTML = "Carregando...";
  if(!classId) throw new Error("Selecione a turma.");

  const cSnap = await getDoc(doc(db,"classes",classId));
  const c = cSnap.exists() ? cSnap.data() : {};
  const className = c.name || classId;

  const sSnap = await getDocs(query(collection(db,"classSessions"), where("classId","==",classId), orderBy("date","desc"), limit(200)));
  const sessions = sSnap.docs.map(d=>({ id:d.id, ...d.data() })).filter(s=>inRange(s.date, from, to));

  const rSnap = await getDocs(query(collection(db,"attendanceRecords"), where("classId","==",classId)));
  const records = rSnap.docs.map(d=>({ id:d.id, ...d.data() })).filter(r=>sessions.some(s=>s.id===r.sessionId));

  const enrollSnap = await getDocs(query(collection(db,"enrollments"), where("classId","==",classId), where("status","==","active")));
  const studentIds = enrollSnap.docs.map(d=>d.data().studentId);

  const usersSnap = await getDocs(collection(db,"users"));
  const usersMap = new Map(usersSnap.docs.map(d=>[d.id, d.data()]));

  const byStudent = new Map(studentIds.map(id=>[id,{ present:0, absent:0, late:0, excused:0, total:0 }]));
  for(const r of records){
    if(!byStudent.has(r.studentId)) continue;
    const stat = r.status || "";
    const obj = byStudent.get(r.studentId);
    obj.total++;
    if(stat==="present") obj.present++;
    else if(stat==="absent") obj.absent++;
    else if(stat==="late") obj.late++;
    else if(stat==="excused") obj.excused++;
  }

  out.innerHTML = `
    <div class="item">
      <div class="row">
        <div>
          <div class="title">Resumo de Presença • ${escapeHtml(className)}</div>
          <div class="muted">Aulas no período: ${sessions.length} • Registros: ${records.length}</div>
        </div>
        <div class="pill">presença</div>
      </div>

      <table class="table" style="margin-top:10px;">
        <thead>
          <tr>
            <th>Aluno</th>
            <th>Presente</th>
            <th>Falta</th>
            <th>Atraso</th>
            <th>Just.</th>
            <th>Total reg.</th>
          </tr>
        </thead>
        <tbody>
          ${studentIds.map(sid=>{
            const u = usersMap.get(sid) || {};
            const a = byStudent.get(sid) || {present:0,absent:0,late:0,excused:0,total:0};
            return `
              <tr>
                <td><strong>${escapeHtml(u.name || u.email || sid)}</strong></td>
                <td>${a.present}</td>
                <td>${a.absent}</td>
                <td>${a.late}</td>
                <td>${a.excused}</td>
                <td>${a.total}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function exportAttendCSV(classId, from, to){
  if(!classId) throw new Error("Selecione a turma.");

  const cSnap = await getDoc(doc(db,"classes",classId));
  const c = cSnap.exists() ? cSnap.data() : {};
  const className = c.name || classId;

  const usersSnap = await getDocs(collection(db,"users"));
  const usersMap = new Map(usersSnap.docs.map(d=>[d.id, d.data()]));

  const sSnap = await getDocs(query(collection(db,"classSessions"), where("classId","==",classId), orderBy("date","desc"), limit(200)));
  const sessions = sSnap.docs.map(d=>({ id:d.id, ...d.data() })).filter(s=>inRange(s.date, from, to));
  const sessionMap = new Map(sessions.map(s=>[s.id,s]));

  const rSnap = await getDocs(query(collection(db,"attendanceRecords"), where("classId","==",classId)));
  const records = rSnap.docs.map(d=>({ id:d.id, ...d.data() })).filter(r=>sessionMap.has(r.sessionId));

  const rows = records.map(r=>{
    const u = usersMap.get(r.studentId) || {};
    const s = sessionMap.get(r.sessionId) || {};
    return {
      classId, className,
      sessionId: r.sessionId,
      sessionDate: s.date || "",
      sessionTopic: s.topic || "",
      studentId: r.studentId,
      studentName: u.name || "",
      studentEmail: u.email || "",
      status: r.status || "",
      note: r.note || ""
    };
  });

  downloadText(`IMV_presenca_${classId}.csv`, toCSV(rows), "text/csv;charset=utf-8");
}

async function main(){
  try{
    qs("#btnLogout").addEventListener("click", ()=>logout());
    await ensureAdmin();

    qs("#repFrom").value = todayISO().slice(0,8) + "01";
    qs("#repTo").value = todayISO();

    await fillClasses();

    qs("#formGradesReport").addEventListener("submit", async (ev)=>{
      ev.preventDefault();
      const msg = qs("#msgGradesRep"); hideMsg(msg);
      const classId = qs("#repClassGrades").value;
      const mode = qs("#repGradesMode").value || "summary";
      try{
        if(mode === "summary"){
          await reportGradesSummary(classId);
          showMsg(msg,true,"Resumo gerado.");
        }else{
          await exportGradesCSV(classId);
          showMsg(msg,true,"CSV de notas exportado.");
        }
      }catch(e){
        showMsg(msg,false,e?.message || "Erro no relatório de notas.");
      }
    });

    qs("#formAttendReport").addEventListener("submit", async (ev)=>{
      ev.preventDefault();
      const msg = qs("#msgAttendRep"); hideMsg(msg);
      const classId = qs("#repClassAttend").value;
      const from = qs("#repFrom").value || "";
      const to = qs("#repTo").value || "";
      const mode = qs("#repAttendMode").value || "summary";
      try{
        if(mode === "summary"){
          await reportAttendSummary(classId, from, to);
          showMsg(msg,true,"Resumo gerado.");
        }else{
          await exportAttendCSV(classId, from, to);
          showMsg(msg,true,"CSV de presença exportado.");
        }
      }catch(e){
        showMsg(msg,false,e?.message || "Erro no relatório de presença.");
      }
    });

    qs("#outGrades").innerHTML = `<div class="muted">Selecione uma turma e gere o relatório.</div>`;
    qs("#outAttend").innerHTML = `<div class="muted">Selecione uma turma e gere o relatório.</div>`;

  }catch(e){
    qs("#fatal").style.display="block";
    qs("#fatal").textContent = e?.message || "Erro nos relatórios.";
  }
}
main();