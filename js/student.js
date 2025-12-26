// js/student.js
import { requireProfileOrRedirect, signOutNow, logDiag } from "./auth.js";

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

  const me = await requireProfileOrRedirect(["student"]);
  if (!me) return;

  if (who) who.textContent = `${me.name || me.email} (${me.role})`;
  logDiag(diag, "Aluno logado OK.");

  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      await signOutNow();
      location.href = "index.html";
    });
  }
});