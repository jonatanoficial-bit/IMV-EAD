// js/reports.js
import { requireProfileOrRedirect, logDiag } from "./auth.js";
import { collection, getCountFromServer } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { db } from "./firebase.js";

function first(...selectors) {
  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el) return el;
  }
  return null;
}

async function safeCount(name) {
  try {
    const snap = await getCountFromServer(collection(db, name));
    return snap.data().count || 0;
  } catch (e) {
    return 0;
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  const diag = first("#diagLog", "pre#diag", "pre[data-diag]");
  const out = first("#reportsOut", "[data-reports]");

  const me = await requireProfileOrRedirect(["admin"]);
  if (!me) return;

  logDiag(diag, "Relatórios carregando...");

  const [u, c, cl, e, a, n, l] = await Promise.all([
    safeCount("users"),
    safeCount("courses"),
    safeCount("classes"),
    safeCount("enrollments"),
    safeCount("attendance"),
    safeCount("notices"),
    safeCount("library")
  ]);

  const html = `
    <div class="card">
      <div style="font-weight:800;font-size:1.05em">Resumo do sistema</div>
      <div style="margin-top:10px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
        <div class="mini">Usuários: <b>${u}</b></div>
        <div class="mini">Cursos: <b>${c}</b></div>
        <div class="mini">Turmas: <b>${cl}</b></div>
        <div class="mini">Matrículas: <b>${e}</b></div>
        <div class="mini">Presenças: <b>${a}</b></div>
        <div class="mini">Avisos: <b>${n}</b></div>
        <div class="mini">Biblioteca: <b>${l}</b></div>
      </div>
    </div>
  `;

  if (out) out.innerHTML = html;
  logDiag(diag, "Relatórios OK.");
});