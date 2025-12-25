// js/student.js (ETAPA 8) — Aluno: turmas + pagamentos + contratos + ficha (somente leitura)
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
    return;
  }

  const classesSnap = await getDocs(collection(db, "classes"));
  const classMap = new Map(classesSnap.docs.map(d => [d.id, d.data()]));

  wrap.innerHTML = enrollSnap.docs.map(d => {
    const e = d.data();
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

async function main(){
  try {
    qs("#btnLogout").addEventListener("click", () => logout());
    const me = await requireStudent();
    await loadMyClasses(me.uid);
    await loadMyPayments(me.uid);
    await loadMyContracts(me.uid);
    await loadMyProfile(me.uid);
  } catch (e) {
    qs("#fatal").style.display = "block";
    qs("#fatal").textContent = e?.message || "Erro no painel do aluno.";
  }
}

main();