// js/teacher.js
import { requireProfileOrRedirect, signOutNow, logDiag } from "./auth.js";
import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { db } from "./firebase.js";

function first(...selectors) {
  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el) return el;
  }
  return null;
}

window.addEventListener("DOMContentLoaded", async () => {
  const diag = first("#diagLog", "pre#diag", "pre[data-diag]");
  const who = first("#who", ".who");
  const btnLogout = first("#btnLogout", "button[data-logout]", "#btnSair");

  const me = await requireProfileOrRedirect(["teacher"]);
  if (!me) return;

  if (who) who.textContent = `${me.name || me.email} (${me.role})`;
  logDiag(diag, "Professor logado OK.");

  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      await signOutNow();
      location.href = "index.html";
    });
  }

  // Carregar turmas (simples): pega todas (regras permitem teacher ler)
  // O filtro "minhas turmas" você pode fazer depois pelo campo teacherId.
  try {
    logDiag(diag, "Carregando turmas...");
    const q = collection(db, "classes");
    const snap = await getDocs(q);
    logDiag(diag, `Turmas carregadas: ${snap.size}`);
  } catch (e) {
    const msg = e?.message || String(e);
    logDiag(diag, `ERRO turmas: ${msg}`);
    alert(`Erro: ${msg}`);
  }
});