// js/admin.js (ETAPA 8) — Admin total + Financeiro + Contratos + Ficha do aluno + Relatórios/CSV
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
  updateDoc,
  limit
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut as signOutAuth
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

function qs(sel){ return document.querySelector(sel); }
function escapeHtml(s){ return (s??"").toString().replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])); }
function showMsg(el, ok, text){ el.className = ok ? "msg ok" : "msg err"; el.textContent=text; el.style.display="block"; }
function hideMsg(el){ if(el){ el.style.display="none"; el.textContent=""; } }

function randomPass(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function toAmountNumber(s) {
  const raw = (s || "").toString().trim();
  if (!raw) return 0;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}
function pad2(n){ return String(n).padStart(2,"0"); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function monthISOFromNow(){
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
}
function makeDueDate(month, dueDay){
  const [y,m] = month.split("-").map(Number);
  const dd = Math.min(Math.max(Number(dueDay||10), 1), 28);
  return `${y}-${pad2(m)}-${pad2(dd)}`;
}
function splitLines(str){
  return (str || "").split("\n").map(s => s.trim()).filter(Boolean);
}
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
  // rows: array of objects. build header union
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

async function ensureAdmin() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Não autenticado.");
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) throw new Error("Perfil não encontrado em users/{uid}.");
  const role = snap.data()?.role;
  if (role !== "admin") throw new Error("Sem permissão (role).");
  return { uid, ...snap.data() };
}

async function createUserAccount(email, password) {
  const secondaryApp = initializeApp(firebaseConfig, "secondary-" + Date.now());
  const secondaryAuth = getAuth(secondaryApp);
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password);
  await signOutAuth(secondaryAuth);
  return cred.user;
}

async function createProfile({ uid, email, name, role }) {
  await setDoc(doc(db, "users", uid), {
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

async function fillTeachersSelect() {
  const sel = qs("#classTeacher");
  sel.innerHTML = "<option value=''>Carregando...</option>";
  const snap = await getDocs(query(collection(db, "users"), where("role","==","teacher"), orderBy("createdAt","desc")));
  sel.innerHTML = "<option value=''>Selecione...</option>";
  snap.forEach(docu => {
    const u = docu.data();
    const opt = document.createElement("option");
    opt.value = docu.id;
    opt.textContent = (u.name || u.email || docu.id);
    sel.appendChild(opt);
  });
}

async function fillTeacherFiltersAndPayouts() {
  const ids = ["rateTeacherSel","sessTeacherFilter","payoutTeacherSel"];
  const sels = ids.map(id => qs("#"+id));
  sels.forEach(s => s.innerHTML = "<option value=''>Carregando...</option>");

  const snap = await getDocs(query(collection(db, "users"), where("role","==","teacher"), orderBy("createdAt","desc")));

  sels.forEach(sel => {
    sel.innerHTML = "<option value=''>Selecione...</option>";
    snap.forEach(docu => {
      const u = docu.data();
      const opt = document.createElement("option");
      opt.value = docu.id;
      opt.textContent = `${u.name || "Professor"} • ${u.email || docu.id}`;
      sel.appendChild(opt);
    });
  });

  qs("#sessTeacherFilter").innerHTML = "<option value=''>Todos</option>" + qs("#sessTeacherFilter").innerHTML.replace("<option value=''>Selecione...</option>","");
}

async function fillCoursesSelect() {
  const sel = qs("#classCourse");
  sel.innerHTML = "<option value=''>Carregando...</option>";
  const snap = await getDocs(query(collection(db, "courses"), orderBy("createdAt","desc")));
  sel.innerHTML = "<option value=''>Selecione...</option>";
  snap.forEach(docu => {
    const c = docu.data();
    const opt = document.createElement("option");
    opt.value = docu.id;
    opt.textContent = (c.title || docu.id);
    sel.appendChild(opt);
  });
}

async function fillStudentsSelects() {
  const sels = [
    qs("#enrollStudentSel"),
    qs("#contractStudentSel"),
    qs("#profileStudentSel")
  ];
  sels.forEach(sel => sel.innerHTML = "<option value=''>Carregando...</option>");

  const snap = await getDocs(query(collection(db, "users"), where("role","==","student"), orderBy("createdAt","desc")));

  sels.forEach(sel => {
    sel.innerHTML = "<option value=''>Selecione o aluno...</option>";
    snap.forEach(docu => {
      const u = docu.data();
      const opt = document.createElement("option");
      opt.value = docu.id;
      opt.textContent = `${u.name || "Aluno"} • ${u.email || docu.id}`;
      sel.appendChild(opt);
    });
  });
}

async function fillClassesSelects() {
  const selEnroll = qs("#enrollClassSel");
  const selCfg = qs("#cfgClassSel");
  const selReport = qs("#reportClassSel");

  selEnroll.innerHTML = "<option value=''>Carregando...</option>";
  selCfg.innerHTML = "<option value=''>Carregando...</option>";
  selReport.innerHTML = "<option value=''>Carregando...</option>";

  const snap = await getDocs(query(collection(db, "classes"), orderBy("createdAt","desc")));

  selEnroll.innerHTML = "<option value=''>Selecione a turma...</option>";
  selCfg.innerHTML = "<option value=''>Selecione a turma...</option>";
  selReport.innerHTML = "<option value=''>Selecione a turma...</option>";

  snap.forEach(docu => {
    const c = docu.data();
    const label = `${c.name || "Turma"} • (${docu.id})`;

    const opt1 = document.createElement("option");
    opt1.value = docu.id;
    opt1.textContent = label;
    selEnroll.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = docu.id;
    opt2.textContent = label;
    selCfg.appendChild(opt2);

    const opt3 = document.createElement("option");
    opt3.value = docu.id;
    opt3.textContent = label;
    selReport.appendChild(opt3);
  });
}

async function renderCourses() {
  const wrap = qs("#coursesList");
  wrap.innerHTML = "Carregando...";
  const snap = await getDocs(query(collection(db, "courses"), orderBy("createdAt","desc")));
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
        <div class="muted" style="margin-top:6px;">ID: ${escapeHtml(d.id)}</div>
      </div>
    `;
  }).join("");
}

async function renderClasses() {
  const wrap = qs("#classesList");
  wrap.innerHTML = "Carregando...";
  const snap = await getDocs(query(collection(db, "classes"), orderBy("createdAt","desc")));
  if (snap.empty) { wrap.innerHTML = "<div class='muted'>Nenhuma turma ainda.</div>"; return; }

  wrap.innerHTML = snap.docs.map(d => {
    const c = d.data();
    const modality = c.modality || "-";
    const meeting = c.meetingLink ? "link ok" : "sem link";
    const schedule = c.schedule || "";
    return `
      <div class="item">
        <div class="row">
          <div>
            <div class="title">${escapeHtml(c.name || "Turma")}</div>
            <div class="muted">courseId: ${escapeHtml(c.courseId || "-")} • teacherId: ${escapeHtml(c.teacherId || "-")}</div>
            <div class="muted">Modalidade: ${escapeHtml(modality)} • ${escapeHtml(meeting)} ${schedule ? "• " + escapeHtml(schedule) : ""}</div>
          </div>
          <div class="pill">${escapeHtml(c.active ? "ativa" : "inativa")}</div>
        </div>
        <div class="muted" style="margin-top:6px;">ID: ${escapeHtml(d.id)}</div>
      </div>
    `;
  }).join("");
}

async function renderEnrollments() {
  const wrap = qs("#enrollList");
  wrap.innerHTML = "Carregando...";

  const snap = await getDocs(query(collection(db, "enrollments"), orderBy("createdAt","desc")));
  if (snap.empty) { wrap.innerHTML = "<div class='muted'>Nenhuma matrícula ainda.</div>"; return; }

  const usersSnap = await getDocs(collection(db, "users"));
  const usersMap = new Map(usersSnap.docs.map(d => [d.id, d.data()]));

  const classesSnap = await getDocs(collection(db, "classes"));
  const classMap = new Map(classesSnap.docs.map(d => [d.id, d.data()]));

  const plansSnap = await getDocs(collection(db, "plans"));
  const planMap = new Map(plansSnap.docs.map(d => [d.id, d.data()]));

  wrap.innerHTML = snap.docs.slice(0, 30).map(d => {
    const e = d.data();
    const u = usersMap.get(e.studentId) || {};
    const c = classMap.get(e.classId) || {};
    const p = e.planId ? (planMap.get(e.planId) || {}) : {};
    const planName = e.planId ? (p.name || e.planId) : "— sem plano";
    const amount = (e.customAmount != null && e.customAmount !== undefined) ? e.customAmount : (p.amount || "");
    return `
      <div class="item">
        <div class="row">
          <div>
            <div class="title">${escapeHtml(u.name || u.email || e.studentId)}</div>
            <div class="muted">Turma: ${escapeHtml(c.name || e.classId)} • status: ${escapeHtml(e.status || "active")}</div>
            <div class="muted">Plano: ${escapeHtml(planName)} • Valor: R$ ${escapeHtml(String(amount || ""))}</div>
          </div>
          <div class="pill">matrícula</div>
        </div>
      </div>
    `;
  }).join("");
}

async function renderNotices() {
  const wrap = qs("#noticesList");
  wrap.innerHTML = "Carregando...";
  const snap = await getDocs(query(collection(db, "notices"), orderBy("createdAt","desc")));
  if (snap.empty) { wrap.innerHTML = "<div class='muted'>Nenhum aviso ainda.</div>"; return; }

  wrap.innerHTML = snap.docs.slice(0, 10).map(d => {
    const n = d.data();
    return `
      <div class="item">
        <div class="row">
          <div>
            <div class="title">${escapeHtml(n.title || "Aviso")}</div>
            <div class="muted">${escapeHtml(n.body || "")}</div>
          </div>
          <div class="pill">aviso</div>
        </div>
      </div>
    `;
  }).join("");
}

// ----------------- ETAPA 5B (sessões/payouts) -----------------
async function ensureTeacherRate(teacherId) {
  const ref = doc(db, "teacherRates", teacherId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

async function renderSessionsAdmin() {
  const wrap = qs("#sessionsAdminList");
  wrap.innerHTML = "Carregando...";

  const teacherId = qs("#sessTeacherFilter").value || "";
  const from = qs("#sessFrom").value || "";
  const to = qs("#sessTo").value || "";

  const snap = await getDocs(query(collection(db, "teacherSessions"), orderBy("date","desc")));
  let rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (teacherId) rows = rows.filter(r => r.teacherId === teacherId);
  if (from) rows = rows.filter(r => (r.date || "") >= from);
  if (to) rows = rows.filter(r => (r.date || "") <= to);

  if (!rows.length) {
    wrap.innerHTML = "<div class='muted'>Nenhuma sessão no filtro.</div>";
    return;
  }

  const teachersSnap = await getDocs(query(collection(db, "users"), where("role","==","teacher"), orderBy("createdAt","desc")));
  const tMap = new Map(teachersSnap.docs.map(d => [d.id, d.data()]));

  wrap.innerHTML = rows.slice(0, 40).map(r => {
    const t = tMap.get(r.teacherId) || {};
    const status = r.status || "pending";
    const paid = r.paid === true ? "✅ pago" : "—";
    const approveBtn = status === "pending"
      ? `<button class="secondary" data-approve="${escapeHtml(r.id)}">Aprovar</button>`
      : `<span class="pill">aprovado</span>`;

    const markPaidLabel = r.paid === true ? "Pago" : "Marcar pago";
    const paidBtn = status === "approved"
      ? `<button class="secondary" data-markpaid="${escapeHtml(r.id)}">${escapeHtml(markPaidLabel)}</button>`
      : "";

    return `
      <div class="item">
        <div class="row">
          <div>
            <div class="title">${escapeHtml(r.date || "-")} • ${escapeHtml(t.name || t.email || r.teacherId)} • ${escapeHtml(String(r.minutes || 0))} min</div>
            <div class="muted">Turma: ${escapeHtml(r.classId || "-")} • ${escapeHtml(r.mode || "-")} • Status: ${escapeHtml(status)} • ${escapeHtml(paid)}</div>
            ${r.note ? `<div class="muted" style="margin-top:6px;">${escapeHtml(r.note)}</div>` : ""}
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            ${approveBtn}
            ${paidBtn}
          </div>
        </div>
      </div>
    `;
  }).join("");

  wrap.querySelectorAll("[data-approve]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-approve");
      btn.disabled = true;
      btn.textContent = "Aprovando...";
      try {
        await updateDoc(doc(db, "teacherSessions", id), {
          status: "approved",
          approvedBy: auth.currentUser.uid,
          approvedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        await renderSessionsAdmin();
      } catch (e) {
        btn.disabled = false;
        btn.textContent = "Erro";
      }
    });
  });

  wrap.querySelectorAll("[data-markpaid]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-markpaid");
      btn.disabled = true;
      btn.textContent = "Salvando...";
      try {
        await updateDoc(doc(db, "teacherSessions", id), {
          paid: true,
          updatedAt: serverTimestamp()
        });
        await renderSessionsAdmin();
      } catch (e) {
        btn.disabled = false;
        btn.textContent = "Erro";
      }
    });
  });
}

async function renderPayoutsAdmin() {
  const wrap = qs("#payoutsAdminList");
  wrap.innerHTML = "Carregando...";

  const snap = await getDocs(query(collection(db, "teacherPayouts"), orderBy("createdAt","desc")));
  if (snap.empty) { wrap.innerHTML = "<div class='muted'>Nenhum pagamento gerado ainda.</div>"; return; }

  const teachersSnap = await getDocs(query(collection(db, "users"), where("role","==","teacher"), orderBy("createdAt","desc")));
  const tMap = new Map(teachersSnap.docs.map(d => [d.id, d.data()]));

  wrap.innerHTML = snap.docs.slice(0, 20).map(d => {
    const p = d.data();
    const t = tMap.get(p.teacherId) || {};
    const total = Number(p.total || 0).toFixed(2);
    const rate = Number(p.ratePerHour || 0).toFixed(2);
    const status = p.status || "generated";
    return `
      <div class="item">
        <div class="row">
          <div>
            <div class="title">${escapeHtml(t.name || t.email || p.teacherId)} • ${escapeHtml(p.periodFrom || "-")} → ${escapeHtml(p.periodTo || "-")}</div>
            <div class="muted">Total: R$ ${escapeHtml(total)} • Taxa: R$ ${escapeHtml(rate)}/h • Minutos: ${escapeHtml(String(p.totalMinutes || 0))} • Sessões: ${escapeHtml(String((p.sessionIds||[]).length))}</div>
            ${p.note ? `<div class="muted" style="margin-top:6px;">${escapeHtml(p.note)}</div>` : ""}
          </div>
          <div class="pill">${escapeHtml(status)}</div>
        </div>
      </div>
    `;
  }).join("");
}

async function generatePayout(teacherId, periodFrom, periodTo, note) {
  if (!teacherId) throw new Error("Selecione o professor.");
  if (!periodFrom || !periodTo) throw new Error("Defina período (início e fim).");
  if (periodFrom > periodTo) throw new Error("Período inválido.");

  const rateDoc = await ensureTeacherRate(teacherId);
  const ratePerHour = Number(rateDoc?.ratePerHour || 0);
  if (!ratePerHour || ratePerHour <= 0) throw new Error("Defina a taxa do professor (R$/hora) antes.");

  const snap = await getDocs(query(collection(db, "teacherSessions"), where("teacherId","==",teacherId), orderBy("date","desc")));
  let sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  sessions = sessions.filter(s => (s.status === "approved") && (s.paid !== true));
  sessions = sessions.filter(s => (s.date || "") >= periodFrom && (s.date || "") <= periodTo);

  if (!sessions.length) throw new Error("Nenhuma sessão aprovada (não paga) no período.");

  const totalMinutes = sessions.reduce((acc, s) => acc + Number(s.minutes || 0), 0);
  const totalHours = totalMinutes / 60;
  const total = Math.round((totalHours * ratePerHour) * 100) / 100;

  const payoutRef = await addDoc(collection(db, "teacherPayouts"), {
    teacherId,
    periodFrom,
    periodTo,
    ratePerHour,
    totalMinutes,
    total,
    sessionIds: sessions.map(s => s.id),
    status: "generated",
    note: note || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  for (const s of sessions) {
    await updateDoc(doc(db, "teacherSessions", s.id), {
      payoutId: payoutRef.id,
      updatedAt: serverTimestamp()
    });
  }

  return { payoutId: payoutRef.id, total, totalMinutes, ratePerHour, count: sessions.length };
}

// ----------------- ETAPA 7 (Planos, mensalidades, contratos) -----------------
async function fillPlansSelect() {
  const sel = qs("#enrollPlanSel");
  sel.innerHTML = "<option value=''>Carregando...</option>";
  const snap = await getDocs(query(collection(db, "plans"), orderBy("createdAt","desc")));
  sel.innerHTML = "<option value=''>Selecione o plano...</option>";
  snap.forEach(d => {
    const p = d.data();
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = `${p.name || d.id} • R$ ${String(p.amount || "")} • venc ${String(p.dueDay || "")}`;
    sel.appendChild(opt);
  });
}

async function renderPlans() {
  const wrap = qs("#plansList");
  wrap.innerHTML = "Carregando...";
  const snap = await getDocs(query(collection(db, "plans"), orderBy("createdAt","desc")));
  if (snap.empty) { wrap.innerHTML = "<div class='muted'>Nenhum plano ainda.</div>"; return; }

  wrap.innerHTML = snap.docs.map(d => {
    const p = d.data();
    return `
      <div class="item">
        <div class="row">
          <div>
            <div class="title">${escapeHtml(p.name || "Plano")}</div>
            <div class="muted">R$ ${escapeHtml(String(p.amount || ""))} • vencimento dia ${escapeHtml(String(p.dueDay || ""))}</div>
            <div class="muted">PIX: ${escapeHtml(p.pixKey || "-")}</div>
          </div>
          <div class="pill">${escapeHtml(p.active === false ? "inativo" : "ativo")}</div>
        </div>
        <div class="muted" style="margin-top:6px;">ID: ${escapeHtml(d.id)}</div>
      </div>
    `;
  }).join("");
}

async function generateMonthlyCharges(month, statusInit) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Mês inválido. Use AAAA-MM (ex: 2026-01).");

  const plansSnap = await getDocs(collection(db, "plans"));
  const planMap = new Map(plansSnap.docs.map(d => [d.id, { id:d.id, ...d.data() }]));

  const enrollSnap = await getDocs(query(collection(db, "enrollments"), where("status","==","active")));
  const enrolls = enrollSnap.docs.map(d => ({ id:d.id, ...d.data() }))
    .filter(e => !!e.planId);

  if (!enrolls.length) return { created: 0, skipped: 0 };

  let created = 0, skipped = 0;

  const paySnap = await getDocs(query(collection(db, "payments"), where("month","==", month)));
  const existingKey = new Set(paySnap.docs.map(d => {
    const p = d.data();
    return `${p.studentId}__${p.enrollId}__${p.month}`;
  }));

  for (const e of enrolls) {
    const plan = planMap.get(e.planId);
    if (!plan) { skipped++; continue; }

    const amount = (e.customAmount != null && e.customAmount !== undefined && e.customAmount !== "")
      ? Number(e.customAmount)
      : Number(plan.amount || 0);

    const dueDate = makeDueDate(month, plan.dueDay || 10);

    const key = `${e.studentId}__${e.id}__${month}`;
    if (existingKey.has(key)) { skipped++; continue; }

    await addDoc(collection(db, "payments"), {
      studentId: e.studentId,
      enrollId: e.id,
      classId: e.classId,
      planId: e.planId,
      month,
      dueDate,
      amount,
      status: statusInit || "pending",
      method: "",
      pixKey: plan.pixKey || "",
      installments: 0,
      installmentsPaid: 0,
      proofLink: "",
      note: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    created++;
  }

  return { created, skipped };
}

async function renderPayments() {
  const wrap = qs("#paymentsList");
  wrap.innerHTML = "Carregando...";

  const snap = await getDocs(query(collection(db, "payments"), orderBy("dueDate","desc"), limit(40)));
  if (snap.empty) { wrap.innerHTML = "<div class='muted'>Nenhuma cobrança lançada ainda.</div>"; return; }

  const usersSnap = await getDocs(collection(db, "users"));
  const usersMap = new Map(usersSnap.docs.map(d => [d.id, d.data()]));

  wrap.innerHTML = snap.docs.map(d => {
    const p = d.data();
    const u = usersMap.get(p.studentId) || {};
    const statusLabel = p.status || "pending";
    const method = p.method || "-";
    const proof = p.proofLink ? `<a class="chip" href="${escapeHtml(p.proofLink)}" target="_blank" rel="noopener">Comprovante</a>` : `<span class="pill">sem comprovante</span>`;
    const markPaidBtn = (statusLabel !== "paid")
      ? `<button class="secondary" data-paid="${escapeHtml(d.id)}">Marcar pago</button>`
      : `<span class="pill">pago ✅</span>`;

    return `
      <div class="item">
        <div class="row">
          <div>
            <div class="title">${escapeHtml(u.name || u.email || p.studentId)} • ${escapeHtml(p.month || "")} • R$ ${escapeHtml(String(p.amount || ""))}</div>
            <div class="muted">Venc: ${escapeHtml(p.dueDate || "-")} • Status: ${escapeHtml(statusLabel)} • Método: ${escapeHtml(method)}</div>
            <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
              ${proof}
              ${markPaidBtn}
            </div>
          </div>
          <div class="pill">${escapeHtml(statusLabel)}</div>
        </div>
      </div>
    `;
  }).join("");

  wrap.querySelectorAll("[data-paid]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-paid");
      btn.disabled = true;
      btn.textContent = "Salvando...";
      try {
        await updateDoc(doc(db, "payments", id), {
          status: "paid",
          paidAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        await renderPayments();
      } catch (e) {
        btn.disabled = false;
        btn.textContent = "Erro";
      }
    });
  });
}

async function renderContracts() {
  const wrap = qs("#contractsList");
  wrap.innerHTML = "Carregando...";

  const snap = await getDocs(query(collection(db, "contracts"), orderBy("createdAt","desc"), limit(30)));
  if (snap.empty) { wrap.innerHTML = "<div class='muted'>Nenhum contrato ainda.</div>"; return; }

  const usersSnap = await getDocs(collection(db, "users"));
  const usersMap = new Map(usersSnap.docs.map(d => [d.id, d.data()]));

  wrap.innerHTML = snap.docs.map(d => {
    const c = d.data();
    const u = usersMap.get(c.studentId) || {};
    const signed = c.signed === true ? "assinado ✅" : "pendente";
    const link = c.link ? `<a class="chip" href="${escapeHtml(c.link)}" target="_blank" rel="noopener">Abrir PDF</a>` : "";
    return `
      <div class="item">
        <div class="row">
          <div>
            <div class="title">${escapeHtml(u.name || u.email || c.studentId)} • ${escapeHtml(c.title || "Contrato")}</div>
            <div class="muted">Status: ${escapeHtml(signed)}</div>
            <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
              ${link}
              ${c.body ? `<span class="pill">texto no sistema</span>` : `<span class="pill">sem texto</span>`}
            </div>
          </div>
          <div class="pill">${escapeHtml(signed)}</div>
        </div>
      </div>
    `;
  }).join("");
}

// ----------------- ETAPA 8: STUDENT PROFILE (Ficha) -----------------
async function loadStudentProfile(studentId){
  const ref = doc(db, "studentProfiles", studentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

function renderProfilePreview(studentId, data){
  const wrap = qs("#profilePreview");
  if (!studentId){
    wrap.innerHTML = `<div class="muted">Selecione um aluno para ver a ficha.</div>`;
    return;
  }
  if (!data){
    wrap.innerHTML = `<div class="muted">Sem ficha ainda para este aluno. Preencha e salve.</div>`;
    return;
  }
  const docs = Array.isArray(data.docs) ? data.docs : [];
  wrap.innerHTML = `
    <div class="item">
      <div class="row">
        <div>
          <div class="title">Prévia da ficha</div>
          <div class="muted">studentId: ${escapeHtml(studentId)}</div>
        </div>
        <div class="pill">perfil</div>
      </div>

      <div class="muted" style="margin-top:10px;">
        <div><strong>Telefone:</strong> ${escapeHtml(data.phone || "-")}</div>
        <div><strong>Nascimento:</strong> ${escapeHtml(data.birthDate || "-")}</div>
        <div><strong>Endereço:</strong> ${escapeHtml(data.address || "-")}</div>
        <div><strong>Responsável:</strong> ${escapeHtml(data.guardianName || "-")} • ${escapeHtml(data.guardianPhone || "-")}</div>
      </div>

      ${data.notes ? `<div class="muted" style="margin-top:10px; white-space:pre-wrap;"><strong>Observações:</strong>\n${escapeHtml(data.notes)}</div>` : ""}
      ${data.history ? `<div class="muted" style="margin-top:10px; white-space:pre-wrap;"><strong>Histórico:</strong>\n${escapeHtml(data.history)}</div>` : ""}

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

function setProfileForm(data){
  qs("#pPhone").value = data?.phone || "";
  qs("#pBirth").value = data?.birthDate || "";
  qs("#pAddress").value = data?.address || "";
  qs("#pGuardianName").value = data?.guardianName || "";
  qs("#pGuardianPhone").value = data?.guardianPhone || "";
  qs("#pNotes").value = data?.notes || "";
  qs("#pHistory").value = data?.history || "";
  qs("#pDocs").value = Array.isArray(data?.docs) ? data.docs.join("\n") : "";
}

async function saveStudentProfile(studentId, payload){
  await setDoc(doc(db, "studentProfiles", studentId), {
    ...payload,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  }, { merge: true });
}

// ----------------- ETAPA 8: REPORTS/CSV -----------------
async function reportSummary(classId, month){
  const out = qs("#reportOut");
  out.innerHTML = "Carregando...";

  if (!classId) throw new Error("Selecione uma turma.");

  const classSnap = await getDoc(doc(db, "classes", classId));
  const classData = classSnap.exists() ? classSnap.data() : {};
  const className = classData.name || classId;

  const enrollSnap = await getDocs(query(collection(db, "enrollments"), where("classId","==",classId), orderBy("createdAt","desc")));
  const enrolls = enrollSnap.docs.map(d => ({ id:d.id, ...d.data() }));

  const usersSnap = await getDocs(collection(db, "users"));
  const usersMap = new Map(usersSnap.docs.map(d => [d.id, d.data()]));

  // pagamentos do mês da turma (se mês for preenchido)
  let payments = [];
  if (month && /^\d{4}-\d{2}$/.test(month)){
    const paySnap = await getDocs(query(collection(db, "payments"), where("classId","==",classId), where("month","==",month)));
    payments = paySnap.docs.map(d => ({ id:d.id, ...d.data() }));
  }

  const paidCount = payments.filter(p => p.status === "paid").length;
  const pendingCount = payments.filter(p => (p.status || "pending") !== "paid").length;
  const totalValue = payments.reduce((acc,p)=> acc + Number(p.amount||0), 0);
  const totalPaid = payments.filter(p=>p.status==="paid").reduce((acc,p)=> acc + Number(p.amount||0), 0);

  out.innerHTML = `
    <div class="item">
      <div class="row">
        <div>
          <div class="title">Resumo • ${escapeHtml(className)}</div>
          <div class="muted">classId: ${escapeHtml(classId)}</div>
        </div>
        <div class="pill">relatório</div>
      </div>

      <div class="muted" style="margin-top:10px;">
        <div><strong>Matrículas:</strong> ${enrolls.length}</div>
        <div><strong>Mês:</strong> ${escapeHtml(month || "—")}</div>
        <div><strong>Cobranças no mês:</strong> ${payments.length}</div>
        <div><strong>Pagas:</strong> ${paidCount} • <strong>Pendentes:</strong> ${pendingCount}</div>
        <div><strong>Total lançado:</strong> R$ ${totalValue.toFixed(2)} • <strong>Total pago:</strong> R$ ${totalPaid.toFixed(2)}</div>
      </div>

      <div style="margin-top:12px;">
        <div class="muted"><strong>Alunos na turma:</strong></div>
        <div style="margin-top:8px;">
          ${enrolls.slice(0,50).map(e=>{
            const u = usersMap.get(e.studentId) || {};
            return `<div class="muted">• ${escapeHtml(u.name || u.email || e.studentId)}</div>`;
          }).join("")}
        </div>
      </div>
    </div>
  `;
}

async function exportEnrollCSV(classId){
  if (!classId) throw new Error("Selecione uma turma.");
  const enrollSnap = await getDocs(query(collection(db, "enrollments"), where("classId","==",classId), orderBy("createdAt","desc")));
  const enrolls = enrollSnap.docs.map(d => ({ id:d.id, ...d.data() }));

  const usersSnap = await getDocs(collection(db, "users"));
  const usersMap = new Map(usersSnap.docs.map(d => [d.id, d.data()]));

  const classesSnap = await getDocs(collection(db, "classes"));
  const classMap = new Map(classesSnap.docs.map(d => [d.id, d.data()]));

  const plansSnap = await getDocs(collection(db, "plans"));
  const planMap = new Map(plansSnap.docs.map(d => [d.id, d.data()]));

  const rows = enrolls.map(e => {
    const u = usersMap.get(e.studentId) || {};
    const c = classMap.get(e.classId) || {};
    const p = e.planId ? (planMap.get(e.planId) || {}) : {};
    return {
      enrollId: e.id,
      studentId: e.studentId,
      studentName: u.name || "",
      studentEmail: u.email || "",
      classId: e.classId,
      className: c.name || "",
      status: e.status || "",
      planId: e.planId || "",
      planName: p.name || "",
      planAmount: p.amount || "",
      customAmount: e.customAmount || "",
      createdAt: e.createdAt?.seconds ? new Date(e.createdAt.seconds*1000).toISOString() : ""
    };
  });

  const csv = toCSV(rows);
  downloadText(`IMV_enrollments_${classId}.csv`, csv, "text/csv;charset=utf-8");
}

async function exportPaymentsCSV(classId, month){
  if (!classId) throw new Error("Selecione uma turma.");
  if (!/^\d{4}-\d{2}$/.test(month || "")) throw new Error("Informe o mês AAAA-MM para pagamentos.");

  const paySnap = await getDocs(query(collection(db, "payments"), where("classId","==",classId), where("month","==",month)));
  const pays = paySnap.docs.map(d => ({ id:d.id, ...d.data() }));

  const usersSnap = await getDocs(collection(db, "users"));
  const usersMap = new Map(usersSnap.docs.map(d => [d.id, d.data()]));

  const rows = pays.map(p => {
    const u = usersMap.get(p.studentId) || {};
    return {
      paymentId: p.id,
      month: p.month || "",
      dueDate: p.dueDate || "",
      amount: p.amount || "",
      status: p.status || "",
      method: p.method || "",
      proofLink: p.proofLink || "",
      studentId: p.studentId,
      studentName: u.name || "",
      studentEmail: u.email || "",
      enrollId: p.enrollId || "",
      planId: p.planId || "",
      pixKey: p.pixKey || "",
      paidAt: p.paidAt?.seconds ? new Date(p.paidAt.seconds*1000).toISOString() : ""
    };
  });

  const csv = toCSV(rows);
  downloadText(`IMV_payments_${classId}_${month}.csv`, csv, "text/csv;charset=utf-8");
}

// ----------------- MAIN -----------------
async function main() {
  try {
    const me = await ensureAdmin();
    qs("#meName").textContent = me.name || me.email || "Admin";
    qs("#btnLogout").addEventListener("click", async () => logout());

    // defaults
    qs("#sessFrom").value = todayISO().slice(0,8) + "01";
    qs("#sessTo").value = todayISO();
    qs("#payoutFrom").value = todayISO().slice(0,8) + "01";
    qs("#payoutTo").value = todayISO();
    qs("#genMonth").value = monthISOFromNow();
    qs("#reportMonth").value = monthISOFromNow();

    // Cadastrar aluno
    qs("#formStudent").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const name = qs("#studentName").value.trim();
      const email = qs("#studentEmail").value.trim();
      const msg = qs("#msgStudent");
      hideMsg(msg);
      try {
        if (!email) throw new Error("E-mail do aluno é obrigatório.");
        const password = randomPass(10);
        const user = await createUserAccount(email, password);
        await createProfile({ uid: user.uid, email, name, role: "student" });
        showMsg(msg, true, `Aluno criado! Email: ${email} | Senha: ${password} | UID: ${user.uid}`);
        qs("#studentName").value = "";
        qs("#studentEmail").value = "";
        await listCounts();
        await fillStudentsSelects();
      } catch (e) {
        showMsg(msg, false, e?.message || "Erro ao criar aluno.");
      }
    });

    // Cadastrar professor
    qs("#formTeacher").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const name = qs("#teacherName").value.trim();
      const email = qs("#teacherEmail").value.trim();
      const msg = qs("#msgTeacher");
      hideMsg(msg);
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
        await fillTeacherFiltersAndPayouts();
      } catch (e) {
        showMsg(msg, false, e?.message || "Erro ao criar professor.");
      }
    });

    // Aviso
    qs("#formNotice").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const title = qs("#noticeTitle").value.trim();
      const body = qs("#noticeBody").value.trim();
      const msg = qs("#msgNotice");
      hideMsg(msg);
      try {
        if (!title) throw new Error("Título é obrigatório.");
        if (!body) throw new Error("Mensagem é obrigatória.");
        await addDoc(collection(db, "notices"), {
          title, body, active: true,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        showMsg(msg, true, "Aviso publicado!");
        qs("#noticeTitle").value = "";
        qs("#noticeBody").value = "";
        await renderNotices();
      } catch (e) {
        showMsg(msg, false, e?.message || "Erro ao publicar aviso.");
      }
    });

    // Curso
    qs("#formCourse").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const title = qs("#courseTitle").value.trim();
      const description = qs("#courseDesc").value.trim();
      const msg = qs("#msgCourse");
      hideMsg(msg);
      try {
        if (!title) throw new Error("Título do curso é obrigatório.");
        await addDoc(collection(db, "courses"), {
          title, description, active: true,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp()
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

    // Turma
    qs("#formClass").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const name = qs("#className").value.trim();
      const teacherId = qs("#classTeacher").value;
      const courseId = qs("#classCourse").value;
      const msg = qs("#msgClass");
      hideMsg(msg);
      try {
        if (!name) throw new Error("Nome da turma é obrigatório.");
        if (!teacherId) throw new Error("Selecione um professor.");
        if (!courseId) throw new Error("Selecione um curso.");
        await addDoc(collection(db, "classes"), {
          name, teacherId, courseId, active: true,
          modality: "online",
          meetingLink: "",
          schedule: "",
          notes: "",
          createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        showMsg(msg, true, "Turma criada!");
        qs("#className").value = "";
        await listCounts();
        await renderClasses();
        await fillClassesSelects();
      } catch (e) {
        showMsg(msg, false, e?.message || "Erro ao criar turma.");
      }
    });

    // Config de turma
    qs("#formClassConfig").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const classId = qs("#cfgClassSel").value;
      const modality = qs("#cfgModality").value;
      const meetingLink = qs("#cfgMeetingLink").value.trim();
      const schedule = qs("#cfgSchedule").value.trim();
      const notes = qs("#cfgNotes").value.trim();
      const msg = qs("#msgCfg");
      hideMsg(msg);

      try {
        if (!classId) throw new Error("Selecione a turma.");
        await updateDoc(doc(db, "classes", classId), {
          modality, meetingLink, schedule, notes,
          updatedAt: serverTimestamp()
        });
        showMsg(msg, true, "Configuração salva!");
        await renderClasses();
      } catch (e) {
        showMsg(msg, false, e?.message || "Erro ao salvar configuração.");
      }
    });

    // Matrícula com plano
    qs("#formEnrollV2").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const studentId = qs("#enrollStudentSel").value;
      const classId = qs("#enrollClassSel").value;
      const planId = qs("#enrollPlanSel").value;
      const customAmount = toAmountNumber(qs("#enrollCustomAmount").value);

      const msg = qs("#msgEnroll");
      hideMsg(msg);
      try {
        if (!studentId) throw new Error("Selecione o aluno.");
        if (!classId) throw new Error("Selecione a turma.");
        if (!planId) throw new Error("Selecione um plano mensal.");

        const dupQ = query(collection(db, "enrollments"), where("studentId","==",studentId), where("classId","==",classId));
        const dupSnap = await getDocs(dupQ);
        if (!dupSnap.empty) throw new Error("Esse aluno já está matriculado nessa turma.");

        await addDoc(collection(db, "enrollments"), {
          studentId,
          classId,
          planId,
          customAmount: customAmount > 0 ? customAmount : null,
          status:"active",
          createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });

        showMsg(msg, true, "Matrícula criada (com plano)!");
        qs("#enrollCustomAmount").value = "";
        await listCounts();
        await renderEnrollments();
      } catch (e) {
        showMsg(msg, false, e?.message || "Erro ao matricular.");
      }
    });

    // Taxa professor
    qs("#formTeacherRate").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const teacherId = qs("#rateTeacherSel").value;
      const rate = toAmountNumber(qs("#rateValue").value);
      const msg = qs("#msgRate");
      hideMsg(msg);

      try {
        if (!teacherId) throw new Error("Selecione o professor.");
        if (!rate || rate <= 0) throw new Error("Taxa inválida.");

        await setDoc(doc(db, "teacherRates", teacherId), {
          teacherId,
          ratePerHour: rate,
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser.uid
        }, { merge: true });

        showMsg(msg, true, "Taxa salva!");
      } catch (e) {
        showMsg(msg, false, e?.message || "Erro ao salvar taxa.");
      }
    });

    qs("#btnReloadSessions").addEventListener("click", async () => renderSessionsAdmin());
    qs("#sessTeacherFilter").addEventListener("change", async () => renderSessionsAdmin());

    // gerar payout professor
    qs("#formGeneratePayout").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const teacherId = qs("#payoutTeacherSel").value;
      const from = qs("#payoutFrom").value;
      const to = qs("#payoutTo").value;
      const note = (qs("#payoutNote").value || "").trim();
      const msg = qs("#msgPayout");
      hideMsg(msg);

      try {
        const res = await generatePayout(teacherId, from, to, note);
        showMsg(msg, true, `Pagamento gerado! ID: ${res.payoutId} • Total R$ ${res.total.toFixed(2)} • ${res.count} sessões`);
        qs("#payoutNote").value = "";
        await renderPayoutsAdmin();
        await renderSessionsAdmin();
      } catch (e) {
        showMsg(msg, false, e?.message || "Erro ao gerar pagamento.");
      }
    });

    // criar plano
    qs("#formPlan").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const msg = qs("#msgPlan");
      hideMsg(msg);

      try {
        const name = (qs("#planName").value || "").trim();
        const amount = toAmountNumber(qs("#planAmount").value);
        const dueDay = Number((qs("#planDueDay").value || "").trim());
        const pixKey = (qs("#planPixKey").value || "").trim();

        if (!name) throw new Error("Nome do plano obrigatório.");
        if (!amount || amount <= 0) throw new Error("Valor mensal inválido.");
        if (!dueDay || dueDay < 1 || dueDay > 28) throw new Error("Dia vencimento deve ser 1 a 28.");

        await addDoc(collection(db, "plans"), {
          name,
          amount,
          dueDay,
          pixKey,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        showMsg(msg, true, "Plano criado!");
        qs("#planName").value = "";
        qs("#planAmount").value = "";
        qs("#planDueDay").value = "";
        qs("#planPixKey").value = "";

        await renderPlans();
        await fillPlansSelect();
      } catch (e) {
        showMsg(msg, false, e?.message || "Erro ao criar plano.");
      }
    });

    // gerar cobranças do mês
    qs("#formGenerateMonth").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const msg = qs("#msgGenMonth");
      hideMsg(msg);

      try {
        const month = (qs("#genMonth").value || "").trim();
        const statusInit = qs("#genStatus").value || "pending";
        const res = await generateMonthlyCharges(month, statusInit);
        showMsg(msg, true, `Concluído. Criadas: ${res.created} • Ignoradas: ${res.skipped}`);
        await renderPayments();
      } catch (e) {
        showMsg(msg, false, e?.message || "Erro ao gerar cobranças.");
      }
    });

    // criar contrato
    qs("#formContract").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const msg = qs("#msgContract");
      hideMsg(msg);

      try {
        const studentId = qs("#contractStudentSel").value;
        const title = (qs("#contractTitle").value || "").trim();
        const body = (qs("#contractBody").value || "").trim();
        const link = (qs("#contractLink").value || "").trim();

        if (!studentId) throw new Error("Selecione o aluno.");
        if (!title) throw new Error("Título obrigatório.");
        if (!body && !link) throw new Error("Cole texto do contrato ou forneça link (PDF).");

        await addDoc(collection(db, "contracts"), {
          studentId,
          title,
          body,
          link,
          signed: false,
          signedAt: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        showMsg(msg, true, "Contrato criado!");
        qs("#contractTitle").value = "";
        qs("#contractBody").value = "";
        qs("#contractLink").value = "";

        await renderContracts();
      } catch (e) {
        showMsg(msg, false, e?.message || "Erro ao criar contrato.");
      }
    });

    // -------- ETAPA 8: carregar ficha ao trocar aluno
    qs("#profileStudentSel").addEventListener("change", async () => {
      const studentId = qs("#profileStudentSel").value;
      if (!studentId){
        setProfileForm(null);
        renderProfilePreview("", null);
        return;
      }
      const data = await loadStudentProfile(studentId);
      setProfileForm(data);
      renderProfilePreview(studentId, data);
    });

    // salvar ficha
    qs("#formStudentProfile").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const msg = qs("#msgProfile");
      hideMsg(msg);

      try {
        const studentId = qs("#profileStudentSel").value;
        if (!studentId) throw new Error("Selecione o aluno.");

        const payload = {
          phone: (qs("#pPhone").value || "").trim(),
          birthDate: qs("#pBirth").value || "",
          address: (qs("#pAddress").value || "").trim(),
          guardianName: (qs("#pGuardianName").value || "").trim(),
          guardianPhone: (qs("#pGuardianPhone").value || "").trim(),
          notes: (qs("#pNotes").value || "").trim(),
          history: (qs("#pHistory").value || "").trim(),
          docs: splitLines(qs("#pDocs").value)
        };

        await saveStudentProfile(studentId, payload);

        showMsg(msg, true, "Ficha salva!");
        const data = await loadStudentProfile(studentId);
        renderProfilePreview(studentId, data);
      } catch (e) {
        showMsg(msg, false, e?.message || "Erro ao salvar ficha.");
      }
    });

    // relatórios + export
    qs("#formReport").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const msg = qs("#msgReport");
      hideMsg(msg);

      try {
        const classId = qs("#reportClassSel").value;
        const month = (qs("#reportMonth").value || "").trim();
        const mode = qs("#reportMode").value || "summary";

        if (mode === "summary"){
          await reportSummary(classId, month);
          showMsg(msg, true, "Resumo gerado.");
        } else if (mode === "csv_enroll"){
          await exportEnrollCSV(classId);
          showMsg(msg, true, "CSV de matrículas gerado.");
        } else if (mode === "csv_payments"){
          await exportPaymentsCSV(classId, month);
          showMsg(msg, true, "CSV de pagamentos gerado.");
        }
      } catch (e) {
        showMsg(msg, false, e?.message || "Erro no relatório.");
      }
    });

    // INIT
    await listCounts();
    await fillTeachersSelect();
    await fillTeacherFiltersAndPayouts();
    await fillCoursesSelect();
    await fillStudentsSelects();
    await fillClassesSelects();

    await renderCourses();
    await renderClasses();
    await renderEnrollments();
    await renderNotices();

    await renderSessionsAdmin();
    await renderPayoutsAdmin();

    await renderPlans();
    await fillPlansSelect();
    await renderPayments();
    await renderContracts();

    // init preview ficha
    renderProfilePreview("", null);
    qs("#reportOut").innerHTML = `<div class="muted">Selecione uma turma e gere um resumo ou export CSV.</div>`;

    // preenche mês default se vazio
    if (!qs("#reportMonth").value) qs("#reportMonth").value = monthISOFromNow();

  } catch (e) {
    qs("#fatal").style.display = "block";
    qs("#fatal").textContent = e?.message || "Erro no painel admin.";
  }
}

main();