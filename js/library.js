// js/library.js
import { requireProfileOrRedirect, logDiag } from "./auth.js";
import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { renderMarkdown } from "./markdown.js";

function first(...selectors) {
  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el) return el;
  }
  return null;
}

window.addEventListener("DOMContentLoaded", async () => {
  const diag = first("#diagLog", "pre#diag", "pre[data-diag]");
  const listEl = first("#libList", "[data-lib-list]");
  const form = first("#libForm", "form[data-lib-form]");
  const titleEl = first("#libTitle", "input[name='title']");
  const bodyEl = first("#libBody", "textarea[name='body']");
  const previewEl = first("#libPreview", "[data-lib-preview]");

  const me = await requireProfileOrRedirect(["admin", "teacher"]);
  if (!me) return;

  logDiag(diag, `Biblioteca: acesso ${me.role}`);

  async function refresh() {
    if (!listEl) return;
    listEl.innerHTML = "Carregando...";
    const q = query(collection(db, "library"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    if (snap.empty) {
      listEl.innerHTML = "<div style='opacity:.8'>Nenhum conteúdo ainda.</div>";
      return;
    }

    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));

    listEl.innerHTML = items.map((it) => {
      return `
        <div class="card" data-lib-item="${it.id}">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
            <div>
              <div style="font-weight:700">${it.title || "(sem título)"}</div>
              <div style="opacity:.7;font-size:.9em">por ${it.authorName || it.authorEmail || "—"}</div>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn" data-view="${it.id}">Ver</button>
              <button class="btn" data-edit="${it.id}">Editar</button>
              <button class="btn danger" data-del="${it.id}">Excluir</button>
            </div>
          </div>
          <div class="md" data-md="${it.id}" style="display:none;margin-top:10px"></div>
        </div>
      `;
    }).join("");

    listEl.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-view");
        const it = items.find((x) => x.id === id);
        const mdBox = listEl.querySelector(`[data-md="${id}"]`);
        if (!mdBox) return;
        mdBox.style.display = mdBox.style.display === "none" ? "block" : "none";
        mdBox.innerHTML = renderMarkdown(it.body || "");
      });
    });

    listEl.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-edit");
        const it = items.find((x) => x.id === id);
        if (!it) return;
        if (titleEl) titleEl.value = it.title || "";
        if (bodyEl) bodyEl.value = it.body || "";
        if (form) form.setAttribute("data-editing", id);
        alert("Conteúdo carregado no editor. Edite e salve.");
      });
    });

    listEl.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del");
        if (!confirm("Excluir este conteúdo?")) return;
        await deleteDoc(doc(db, "library", id));
        await refresh();
      });
    });
  }

  if (bodyEl && previewEl) {
    bodyEl.addEventListener("input", () => {
      previewEl.innerHTML = renderMarkdown(bodyEl.value || "");
    });
  }

  if (form) {
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const title = (titleEl?.value || "").trim();
      const body = (bodyEl?.value || "").trim();
      const editingId = form.getAttribute("data-editing");

      if (!title || !body) {
        alert("Preencha título e conteúdo.");
        return;
      }

      if (editingId) {
        await updateDoc(doc(db, "library", editingId), {
          title,
          body,
          updatedAt: serverTimestamp(),
          authorEmail: me.email,
          authorName: me.name || ""
        });
        form.removeAttribute("data-editing");
      } else {
        await addDoc(collection(db, "library"), {
          title,
          body,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          authorEmail: me.email,
          authorName: me.name || ""
        });
      }

      if (titleEl) titleEl.value = "";
      if (bodyEl) bodyEl.value = "";
      if (previewEl) previewEl.innerHTML = "";
      await refresh();
    });
  }

  await refresh();
});