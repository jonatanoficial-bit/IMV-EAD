// js/student.js (ETAPA 9) — Aluno: turmas + pagamentos + contratos + ficha + boletim + presenças
import { auth, db } from "./firebase.js";
import { logout, getMyProfile } from "./auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp,
  limit
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

function qs(sel){ return document.querySelector(sel); }
function escapeHtml(s){ return (s??"").toString().replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])); }
function toAmount(v){ return Number(v||0).toFixed(2); }

async function requireStudent() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Não autenticado.");
  const me = await getMyProfile(uid);
  if (!me || me.role !== "student") throw new Error("Conta não é aluno.");
  qs("#meName").textContent = me.name || me.email || "Aluno";
  return { uid, ...me };
}

async function loadMyClasses(uid) {
  const wrap = qs("#myClasses");
  wrap.innerHTML = "Carregando...";

  const enrollSnap = await getDocs(query(collection(db, "enrollments"), where("studentId","==",uid), orderBy("createdAt","desc")));
  if (enrollSnap.empty) {
    wrap.innerHTML = "<div class='muted'>Você ainda não tem matrícula.</div>";
    return [];
  }

  const classesSnap = await getDocs(collection(db, "classes"));
  const classMap = new Map(classesSnap.docs.map(d => [d.id, d.data()]));

  const enrolls = enrollSnap.docs.map(d => ({ id:d.id, ...d.data() }));
  const classIds = Array.from(new Set(enrolls.map(e=>e.classId)));

  wrap.innerHTML = enrolls.map(d => {
    const e = d;
    const c = classMap.get(e.classId) || {};
    const link = c.meetingLink ? `<a class="chip" href="${escapeHtml(c.meetingLink)}" target="_blank" rel="noopener">Entrar na aula</a>` : "";
    return `
      <div class="item">
        <div class="row">
          <div>
            <div class="title">${escapeHtml(c.name || e.classId || "Turma")}</div>
            <div class="muted">${escapeHtml(c.modality || "-")} ${c.schedule ? "• " + escapeHtml(c.schedule) : ""}</div>
          </div>
          <div class="pill">${escapeHtml(e.status || "active")}</div>
        </div>
        <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
          ${link}
        </div>
      </div>
    `;
  }).join("");

  return classIds.map(id => ({ id, ...(classMap.get(id)||{}) }));
}

async function fillStudentClassSel(classes){
  const sel = qs("#studentClassSel");
  if(!sel) return;
  sel.innerHTML = `<option value="">Selecione...</option>`;
  classes.forEach(c=>{
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.name || "Turma"} • ${c.id}`;
    sel.appendChild(opt);
  });
  if(classes.length === 1){
    sel.value = classes[0].id;
    sel.dispatchEvent(new Event("change"));
  }
}

async function loadMyPayments(uid) {
  const wrap = qs("#myPayments");
  wrap.innerHTML = "Carregando...";

  const snap = await getDocs(query(collection(db, "payments"), where("studentId","==",uid), orderBy("dueDate","desc"), limit(24)));
  if (snap.empty) {
    wrap.innerHTML = "<div class='muted'>Nenhuma cobrança ainda.</div>";
    return;
  }

  wrap.innerHTML = snap.docs.map(d => {
    const p = d.data();
    const status = p.status || "pending";
    const method = p.method || "";
    const proof = p.proofLink || "";
    const pixKey = p.pixKey || "";

    return `
      <div class="item">
        <div class="row">
          <div>
            <div class="title">${escapeHtml(p.month || "")} • R$ ${escapeHtml(toAmount(p.amount))}</div>
            <div class="muted">Venc: ${escapeHtml(p.dueDate || "-")} • Status: ${escapeHtml(status)}</div>
            ${pixKey ? `<div class="muted" style="margin-top:6px;">PIX (chave): <strong>${escapeHtml(pixKey)}</strong></div>` : ""}
          </div>
          <div class="pill">${escapeHtml(status)}</div>
        </div>

        <div class="grid" style="gap:10px; margin-top:10px;">
          <div class="formRow" style="margin-top:0;">
            <label>Forma de pagamento</label>
            <select class="input" data-method="${escapeHtml(d.id)}">
              <option value="">—</option>
              <option value="pix_avista" ${method==="pix_avista"?"selected":""}>PIX à vista</option>
              <option value="pix_parcelado" ${method==="pix_parcelado"?"selected":""}>PIX parcelado</option>
            </select>
          </div>

          <div class="formRow" style="margin-top:0;">
            <label>Link do comprovante (Drive/Foto/WhatsApp)</label>
            <input class="input" data-proof="${escapeHtml(d.id)}" placeholder="https://..." value="${escapeHtml(proof)}" />
          </div>

          <div class="actions" style="margin-top:0;">
            <button class="secondary" data-savepay="${escapeHtml(d.id)}">Salvar</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  wrap.querySelectorAll("[data-savepay]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-savepay");
      const methodEl = wrap.querySelector(`[data-method="${CSS.escape(id)}"]`);
      const proofEl = wrap.querySelector(`[data-proof="${CSS.escape(id)}"]`);
      const method = (methodEl?.value || "").trim();
      const proofLink = (proofEl?.value || "").trim();

      btn.disabled = true;
      btn.textContent = "Salvando...";

      try {
        await updateDoc(doc(db, "payments", id), {
          method,
          proofLink,
          updatedAt: serverTimestamp(),
          studentUpdatedAt: serverTimestamp()
        });
        btn.textContent = "Salvo ✅";
        setTimeout(() => { btn.textContent = "Salvar"; btn.disabled = false; }, 900);
      } catch (e) {
        btn.disabled = false;
        btn.textContent = "Erro";
      }
    });
  });
}

async function loadMyContracts(uid) {
  const wrap = qs("#myContracts");
  wrap.innerHTML = "Carregando...";

  const snap = await getDocs(query(collection(db, "contracts"), where("studentId","==",uid), orderBy("createdAt","desc"), limit(10)));
  if (snap.empty) {
    wrap.innerHTML = "<div class='muted'>Nenhum contrato ainda.</div>";
    return;
  }

  wrap.innerHTML = snap.docs.map(d => {
    const c = d.data();
    const signed = c.signed === true;
    const link = c.link ? `<a class="chip" href="${escapeHtml(c.link)}" target="_blank" rel="noopener">Abrir PDF</a>` : "";
    const text = c.body ? `<div class="muted" style="white-space:pre-wrap; margin-top:8px;">${escapeHtml(c.body)}</div>` : "";
    const signBtn = signed
      ? `<span class="pill">assinado ✅</span>`
      : `<button class="secondary" data-sign="${escapeHtml(d.id)}">Assinar</button>`;

    return `
      <div class="item">
        <div class="row">
          <div>
            <div class="title">${escapeHtml(c.title || "Contrato")}</div>
            <div class="muted">Status: ${escapeHtml(signed ? "assinado" : "pendente")}</div>
          </div>
          <div class="pill">${escapeHtml(signed ? "ok" : "pendente")}</div>
        </div>

        <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          ${link}
          ${signBtn}
        </div>

        ${text}
      </div>
    `;
  }).join("");

  wrap.querySelectorAll("[data-sign]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-sign");
      btn.disabled = true;
      btn.textContent = "Assinando...";
      try {
        await updateDoc(doc(db, "contracts", id), {
          signed: true,
          signedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        await loadMyContracts(uid);
      } catch (e) {
        btn.disabled = false;
        btn.textContent = "Erro";
      }
    });
  });
}

async function loadMyProfile(uid){
  const wrap = qs("#myProfile");
  wrap.innerHTML = "Carregando...";

  const snap = await getDoc(doc(db, "studentProfiles", uid));
  if (!snap.exists()){
    wrap.innerHTML = `<div class="muted">Sua ficha ainda não foi preenchida pela escola.</div>`;
    return;
  }

  const p = snap.data();
  const docs = Array.isArray(p.docs) ? p.docs : [];

  wrap.innerHTML = `
    <div class="item">
      <div class="row">
        <div>
          <div class="title">Minha ficha</div>
          <div class="muted">Atualizado: ${p.updatedAt?.seconds ? new Date(p.updatedAt.seconds*1000).toLocaleString("pt-BR") : "-"}</div>
        </div>
        <div class="pill">perfil</div>
      </div>

      <div class="muted" style="margin-top:10px;">
        <div><strong>Telefone:</strong> ${escapeHtml(p.phone || "-")}</div>
        <div><strong>Nascimento:</strong> ${escapeHtml(p.birthDate || "-")}</div>
        <div><strong>Endereço:</strong> ${escapeHtml(p.address || "-")}</div>
        <div><strong>Responsável:</strong> ${escapeHtml(p.guardianName || "-")} • ${escapeHtml(p.guardianPhone || "-")}</div>
      </div>

      ${p.notes ? `<div class="muted" style="margin-top:10px; white-space:pre-wrap;"><strong>Observações:</strong>\n${escapeHtml(p.notes)}</div>` : ""}
      ${p.history ? `<div class="muted" style="margin-top:10px; white-space:pre-wrap;"><strong>Histórico:</strong>\n${escapeHtml(p.history)}</div>` : ""}

      ${docs.length ? `
        <div style="margin-top:10px;">
          <div class="muted"><strong>Documentos/Links:</strong></div>
          <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
            ${docs.map(u => `<a class="chip" href="${escapeHtml(u)}" target="_blank" rel="noopener">Abrir</a>`).join("")}
          </div>
        </div>
      ` : `<div class="muted" style="margin-top:10px;">Sem documentos.</div>`}
    </div>
  `;
}

// ============ ETAPA 9 (Boletim + Presença) ============

function statusLabel(s){
  if(s==="present") return "Presente";
  if(s==="absent") return "Falta";
  if(s==="late") return "Atraso";
  if(s==="excused") return "Justificada";
  return s || "-";
}

async function renderStudentBoletim({ uid, classId }){
  const out = qs("#studentGrades");
  if(!out) return;
  if(!classId){
    out.innerHTML = `<div class="muted">Selecione uma turma para ver suas notas.</div>`;
    return;
  }
  out.innerHTML = "Carregando...";

  const aSnap = await getDocs(query(collection(db,"assessments"), where("classId","==",classId), orderBy("date","desc"), limit(50)));
  const assessments = aSnap.docs.map(d=>({ id:d.id, ...d.data() }));

  if(!assessments.length){
    out.innerHTML = `<div class="muted">Ainda não existem avaliações nessa turma.</div>`;
    return;
  }

  const gSnap = await getDocs(query(collection(db,"grades"), where("classId","==",classId), where("studentId","==",uid)));
  const gradesMap = new Map();
  gSnap.forEach(d=>{
    const g = d.data();
    gradesMap.set(g.assessmentId, g);
  });

  const rows = assessments.map(a=>{
    const g = gradesMap.get(a.id);
    const score = (g?.score ?? null);
    const max = Number(a.maxScore || 10);
    const pct = (score==null) ? "" : `${Math.round((Number(score)/max)*100)}%`;
    return {
      title: a.title || "Avaliação",
      date: a.date || "-",
      max,
      score: (score==null ? "" : Number(score)),
      percent: pct,
      comment: g?.comment || ""
    };
  });

  const avg = (() => {
    const vals = rows.filter(r=>r.score!=="" && r.score!=null).map(r=>Number(r.score));
    if(!vals.length) return null;
    const sum = vals.reduce((a,b)=>a+b,0);
    return Math.round((sum/vals.length)*100)/100;
  })();

  out.innerHTML = `
    <div class="item">
      <div class="row">
        <div>
          <div class="title">Boletim</div>
          <div class="muted">Turma: ${escapeHtml(classId)} • Média (se houver): <strong>${avg==null? "-" : avg}</strong></div>
        </div>
        <div class="pill">notas</div>
      </div>

      <table class="table" style="margin-top:10px;">
        <thead>
          <tr>
            <th>Avaliação</th>
            <th>Data</th>
            <th>Nota</th>
            <th>%</th>
            <th>Comentário</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r=>`
            <tr>
              <td><div style="font-weight:900;">${escapeHtml(r.title)}</div></td>
              <td class="muted">${escapeHtml(r.date)}</td>
              <td>${r.score==="" ? `<span class="pill">—</span>` : `<strong>${escapeHtml(String(r.score))}</strong> / ${escapeHtml(String(r.max))}`}</td>
              <td class="muted">${escapeHtml(r.percent || "")}</td>
              <td class="muted">${escapeHtml(r.comment || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function renderStudentAttendance({ uid, classId }){
  const out = qs("#studentAttendance");
  if(!out) return;
  if(!classId){
    out.innerHTML = `<div class="muted">Selecione uma turma para ver presenças.</div>`;
    return;
  }
  out.innerHTML = "Carregando...";

  const sSnap = await getDocs(query(collection(db,"classSessions"), where("classId","==",classId), orderBy("date","desc"), limit(50)));
  const sessions = sSnap.docs.map(d=>({ id:d.id, ...d.data() }));

  if(!sessions.length){
    out.innerHTML = `<div class="muted">Ainda não existem aulas registradas nessa turma.</div>`;
    return;
  }

  // carrega meus registros por turma
  const rSnap = await getDocs(query(collection(db,"attendanceRecords"), where("classId","==",classId), where("studentId","==",uid)));
  const recMap = new Map();
  rSnap.forEach(d=>{
    const r = d.data();
    recMap.set(r.sessionId, r);
  });

  const presentCount = sessions.filter(s=> (recMap.get(s.id)?.status || "") === "present").length;
  const absentCount = sessions.filter(s=> (recMap.get(s.id)?.status || "") === "absent").length;

  out.innerHTML = `
    <div class="item">
      <div class="row">
        <div>
          <div class="title">Presenças</div>
          <div class="muted">Turma: ${escapeHtml(classId)} • Presente: ${presentCount} • Falta: ${absentCount}</div>
        </div>
        <div class="pill">aulas</div>
      </div>

      <table class="table" style="margin-top:10px;">
        <thead>
          <tr>
            <th>Data</th>
            <th>Tema</th>
            <th>Status</th>
            <th>Obs</th>
          </tr>
        </thead>
        <tbody>
          ${sessions.map(s=>{
            const r = recMap.get(s.id);
            const st = r?.status || "";
            return `
              <tr>
                <td><strong>${escapeHtml(s.date || "-")}</strong></td>
                <td class="muted">${escapeHtml(s.topic || "")}</td>
                <td>${st ? `<span class="pill">${escapeHtml(statusLabel(st))}</span>` : `<span class="pill">—</span>`}</td>
                <td class="muted">${escapeHtml(r?.note || "")}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function main(){
  try {
    qs("#btnLogout").addEventListener("click", () => logout());
    const me = await requireStudent();

    const classes = await loadMyClasses(me.uid);
    await fillStudentClassSel(classes);

    await loadMyPayments(me.uid);
    await loadMyContracts(me.uid);
    await loadMyProfile(me.uid);

    const classSel = qs("#studentClassSel");
    if(classSel){
      classSel.addEventListener("change", async ()=>{
        const classId = classSel.value;
        await renderStudentBoletim({ uid: me.uid, classId });
        await renderStudentAttendance({ uid: me.uid, classId });
      });
      // dispara se já tiver valor
      if(classSel.value){
        classSel.dispatchEvent(new Event("change"));
      }
    }
  } catch (e) {
    qs("#fatal").style.display = "block";
    qs("#fatal").textContent = e?.message || "Erro no painel do aluno.";
  }
}

main();