// js/library.js (ETAPA 6B) — Biblioteca estilo Wikipedia + busca + filtros + fixar + preview + versões
import { auth, db } from "./firebase.js";
import { logout, getMyProfile } from "./auth.js";
import { renderMarkdown } from "./markdown.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

function qs(sel){ return document.querySelector(sel); }
function escapeHtml(s){ return (s??"").toString().replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])); }

function showMsg(el, ok, text){
  el.className = ok ? "msg ok" : "msg err";
  el.textContent = text;
  el.style.display = "block";
}
function hideMsg(el){
  el.style.display = "none";
  el.textContent = "";
}

function normalizeTags(str){
  const raw = (str || "").split(",").map(s => s.trim()).filter(Boolean);
  const unique = Array.from(new Set(raw.map(t => t.toLowerCase())));
  return unique;
}

function linksFromTextarea(str){
  return (str || "")
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);
}

function textIndex(page){
  const t = [
    page.title || "",
    page.summary || "",
    page.body || "",
    Array.isArray(page.tags) ? page.tags.join(" ") : ""
  ].join(" ").toLowerCase();
  return t;
}

async function getMe(){
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Não autenticado.");
  const me = await getMyProfile(uid);
  if (!me || !me.role) throw new Error("Perfil inválido.");
  return { uid, ...me };
}

async function loadCoursesInto(selectEl){
  const snap = await getDocs(query(collection(db, "courses"), orderBy("createdAt","desc")));
  selectEl.innerHTML = `<option value="">—</option>`;
  snap.forEach(d => {
    const c = d.data();
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = c.title || d.id;
    selectEl.appendChild(opt);
  });
}

async function loadClassesInto(selectEl){
  const snap = await getDocs(query(collection(db, "classes"), orderBy("createdAt","desc")));
  selectEl.innerHTML = `<option value="">—</option>`;
  snap.forEach(d => {
    const c = d.data();
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = c.name || d.id;
    selectEl.appendChild(opt);
  });
}

async function fillFilterSelects(){
  const catFilter = qs("#filterCategory");
  const catEditor = qs("#pageCategory");
  catFilter.innerHTML = `<option value="">Todas</option>` + Array.from(catEditor.options).map(o => {
    return `<option value="${escapeHtml(o.value)}">${escapeHtml(o.textContent)}</option>`;
  }).join("");

  await loadCoursesInto(qs("#filterCourse"));
  await loadClassesInto(qs("#filterClass"));

  await loadCoursesInto(qs("#pageCourse"));
  await loadClassesInto(qs("#pageClass"));
}

function canUserEdit(me){
  return me.role === "admin" || me.role === "teacher";
}

function setEditorControls(canEdit){
  qs("#btnNew").style.display = canEdit ? "inline-flex" : "none";
  qs("#btnEditToggle").style.display = canEdit ? "inline-flex" : "none";
}

function clearEditor(){
  qs("#pageId").value = "";
  qs("#pageTitle").value = "";
  qs("#pageCategory").value = "teoria";
  qs("#pageCourse").value = "";
  qs("#pageClass").value = "";
  qs("#pageTags").value = "";
  qs("#pagePinned").checked = false;
  qs("#pageVisibility").value = "public";
  qs("#pageSummary").value = "";
  qs("#pageBody").value = "";
  qs("#pageLinks").value = "";
  hideMsg(qs("#msgPage"));

  qs("#previewBox").style.display = "none";
  qs("#versionsBox").style.display = "none";
}

function fillEditorFromPage(id, page){
  qs("#pageId").value = id || "";
  qs("#pageTitle").value = page.title || "";
  qs("#pageCategory").value = page.category || "teoria";
  qs("#pageCourse").value = page.courseId || "";
  qs("#pageClass").value = page.classId || "";
  qs("#pageTags").value = (Array.isArray(page.tags) ? page.tags.join(", ") : "");
  qs("#pagePinned").checked = page.pinned === true;
  qs("#pageVisibility").value = page.visibility || "public";
  qs("#pageSummary").value = page.summary || "";
  qs("#pageBody").value = page.body || "";
  qs("#pageLinks").value = (Array.isArray(page.links) ? page.links.join("\n") : "");
  hideMsg(qs("#msgPage"));
}

function renderViewer(me, page){
  const viewer = qs("#viewer");
  if (!page) {
    viewer.innerHTML = `<div class="muted">Selecione uma página para ler.</div>`;
    return;
  }

  // visibilidade: se private e não for admin nem autor, bloqueia (extra segurança no front)
  const isOwner = page.authorId && me.uid === page.authorId;
  if (page.visibility === "private" && !(me.role === "admin" || isOwner)){
    viewer.innerHTML = `<div class="msg err">Esta página é privada.</div>`;
    return;
  }

  const tags = Array.isArray(page.tags) ? page.tags : [];
  const links = Array.isArray(page.links) ? page.links : [];

  const meta = [];
  if (page.category) meta.push(`Categoria: ${page.category}`);
  if (page.courseId) meta.push(`Curso: ${page.courseId}`);
  if (page.classId) meta.push(`Turma: ${page.classId}`);
  if (page.pinned) meta.push("📌 Fixada");

  const linksHtml = links.length
    ? `<div style="margin-top:12px;">
         <div class="muted">Materiais</div>
         <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
           ${links.map(u => `<a class="chip" href="${escapeHtml(u)}" target="_blank" rel="noopener">Abrir</a>`).join("")}
         </div>
       </div>`
    : "";

  const bodyHtml = page.body ? renderMarkdown(page.body) : "";

  viewer.innerHTML = `
    <div class="item">
      <div class="row">
        <div>
          <div class="title" style="font-size:18px;">${escapeHtml(page.title || "Sem título")}</div>
          ${page.summary ? `<div class="muted" style="margin-top:4px;">${escapeHtml(page.summary)}</div>` : ""}
          <div class="muted" style="margin-top:6px;">${escapeHtml(meta.join(" • "))}</div>
        </div>
        <div class="pill">${escapeHtml(page.visibility || "public")}</div>
      </div>

      ${tags.length ? `<div style="margin-top:10px; display:flex; gap:6px; flex-wrap:wrap;">
        ${tags.map(t => `<span class="pill">${escapeHtml(t)}</span>`).join("")}
      </div>` : ""}

      ${page.body ? `<div style="margin-top:14px;" class="muted">${bodyHtml}</div>` : ""}

      ${linksHtml}
    </div>
  `;
}

function applyFiltersAndSort(me, pages){
  const qText = (qs("#searchInput").value || "").trim().toLowerCase();
  const cat = qs("#filterCategory").value || "";
  const classId = qs("#filterClass").value || "";
  const courseId = qs("#filterCourse").value || "";
  const onlyMine = qs("#onlyMine").checked;
  const onlyPinned = qs("#onlyPinned").checked;
  const sort = qs("#sortSelect").value || "pinned_updated";

  let out = pages.slice();

  if (cat) out = out.filter(p => (p.category || "") === cat);
  if (classId) out = out.filter(p => (p.classId || "") === classId);
  if (courseId) out = out.filter(p => (p.courseId || "") === courseId);

  // private: só exibe se admin ou autor
  out = out.filter(p => {
    if ((p.visibility || "public") !== "private") return true;
    return me.role === "admin" || p.authorId === me.uid;
  });

  if (onlyMine) out = out.filter(p => (p.authorId || "") === me.uid);
  if (onlyPinned) out = out.filter(p => p.pinned === true);

  if (qText){
    out = out.filter(p => textIndex(p).includes(qText));
  }

  const byTitle = (a,b) => (a.title||"").localeCompare(b.title||"", "pt-BR");
  const byUpdated = (a,b) => {
    const ax = a.updatedAt?.seconds ? a.updatedAt.seconds : 0;
    const bx = b.updatedAt?.seconds ? b.updatedAt.seconds : 0;
    return bx - ax;
  };
  const byPinnedUpdated = (a,b) => {
    const ap = a.pinned === true ? 1 : 0;
    const bp = b.pinned === true ? 1 : 0;
    if (bp !== ap) return bp - ap;
    return byUpdated(a,b);
  };

  if (sort === "title") out.sort(byTitle);
  else if (sort === "updated") out.sort(byUpdated);
  else out.sort(byPinnedUpdated);

  return out;
}

function renderList(me, pages){
  const list = qs("#pagesList");

  if (!pages.length){
    list.innerHTML = `<div class="muted">Nenhuma página encontrada.</div>`;
    return;
  }

  list.innerHTML = pages.slice(0, 60).map(p => {
    const tags = Array.isArray(p.tags) ? p.tags.slice(0,3) : [];
    const pinned = p.pinned ? "📌 " : "";
    const summary = p.summary ? `<div class="muted">${escapeHtml(p.summary)}</div>` : "";
    const vis = p.visibility || "public";

    return `
      <div class="item" style="cursor:pointer;" data-open="${escapeHtml(p.id)}">
        <div class="row">
          <div>
            <div class="title">${escapeHtml(pinned + (p.title || "Sem título"))}</div>
            <div class="muted">${escapeHtml(p.category || "outros")} ${p.courseId ? "• curso" : ""}${p.classId ? "• turma" : ""}</div>
            ${summary}
          </div>
          <div class="pill">${escapeHtml(vis)}</div>
        </div>
        ${tags.length ? `<div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">
          ${tags.map(t => `<span class="pill">${escapeHtml(t)}</span>`).join("")}
        </div>` : ""}
      </div>
    `;
  }).join("");
}

async function loadAllPages(){
  const snap = await getDocs(query(collection(db, "libraryPages"), orderBy("updatedAt","desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Histórico: grava uma “revisão” a cada update (e também na criação)
async function writeRevision(me, pageId, snapshotData, action){
  await addDoc(collection(db, "libraryRevisions"), {
    pageId,
    action: action || "update",
    editorId: me.uid,
    editorRole: me.role,
    title: snapshotData.title || "",
    category: snapshotData.category || "",
    visibility: snapshotData.visibility || "public",
    pinned: snapshotData.pinned === true,
    summary: snapshotData.summary || "",
    tags: Array.isArray(snapshotData.tags) ? snapshotData.tags : [],
    body: snapshotData.body || "",
    links: Array.isArray(snapshotData.links) ? snapshotData.links : [],
    createdAt: serverTimestamp()
  });
}

async function loadRevisions(pageId){
  const snap = await getDocs(query(
    collection(db, "libraryRevisions"),
    where("pageId","==",pageId),
    orderBy("createdAt","desc")
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function main(){
  try {
    qs("#btnLogout").addEventListener("click", () => logout());

    const me = await getMe();
    qs("#meName").textContent = me.name || me.email || "Usuário";
    qs("#meRole").textContent = me.role;

    const back = qs("#backLink");
    if (me.role === "admin") back.href = "./admin.html";
    else if (me.role === "teacher") back.href = "./teacher.html";
    else back.href = "./student.html";

    const canEdit = canUserEdit(me);
    setEditorControls(canEdit);

    await fillFilterSelects();

    let allPages = await loadAllPages();
    let currentId = "";

    const rerender = () => {
      const filtered = applyFiltersAndSort(me, allPages);
      renderList(me, filtered);
      attachOpenHandlers(filtered);
      if (currentId){
        const open = allPages.find(p => p.id === currentId);
        if (open) renderViewer(me, open);
      }
    };

    function attachOpenHandlers(filteredPages){
      const map = new Map(filteredPages.map(p => [p.id, p]));
      qs("#pagesList").querySelectorAll("[data-open]").forEach(el => {
        el.addEventListener("click", () => {
          const id = el.getAttribute("data-open");
          currentId = id;
          const page = map.get(id) || allPages.find(p => p.id === id);
          renderViewer(me, page);

          if (canEdit && page){
            // professor: só edita se for autor (ou admin)
            const isOwner = page.authorId === me.uid;
            if (me.role === "admin" || isOwner){
              fillEditorFromPage(id, page);
            } else {
              // não é dono: abre editor vazio (sem permitir editar do outro)
              clearEditor();
              qs("#pageId").value = "";
            }
          }
        });
      });
    }

    // eventos filtros
    qs("#btnReload").addEventListener("click", async () => {
      allPages = await loadAllPages();
      rerender();
    });

    const liveControls = ["#filterCategory","#filterClass","#filterCourse","#onlyMine","#onlyPinned","#sortSelect"];
    liveControls.forEach(sel => qs(sel).addEventListener("change", rerender));

    let tmr = null;
    qs("#searchInput").addEventListener("input", () => {
      clearTimeout(tmr);
      tmr = setTimeout(rerender, 180);
    });

    // editor toggle
    qs("#btnEditToggle").addEventListener("click", () => {
      const ed = qs("#editor");
      ed.style.display = (ed.style.display === "none" || !ed.style.display) ? "block" : "none";
    });

    qs("#btnNew").addEventListener("click", () => {
      clearEditor();
      currentId = "";
      renderViewer(me, null);
      qs("#editor").style.display = "block";
    });

    qs("#btnClear").addEventListener("click", clearEditor);

    // preview
    qs("#btnPreview").addEventListener("click", () => {
      const box = qs("#previewBox");
      const vbox = qs("#versionsBox");
      vbox.style.display = "none";

      const title = (qs("#pageTitle").value || "").trim();
      const body = (qs("#pageBody").value || "").trim();
      const html = renderMarkdown(body);

      qs("#previewContent").innerHTML = `
        <div class="title" style="margin-bottom:6px;">${escapeHtml(title || "Sem título")}</div>
        <div class="muted">${html}</div>
      `;
      box.style.display = (box.style.display === "none" || !box.style.display) ? "block" : "none";
    });

    // versões
    qs("#btnVersions").addEventListener("click", async () => {
      const box = qs("#versionsBox");
      const pbox = qs("#previewBox");
      pbox.style.display = "none";

      const pageId = (qs("#pageId").value || "").trim();
      if (!pageId){
        qs("#versionsList").textContent = "Selecione uma página para ver versões.";
        box.style.display = "block";
        return;
      }

      qs("#versionsList").textContent = "Carregando...";
      box.style.display = "block";

      try {
        const items = await loadRevisions(pageId);
        if (!items.length){
          qs("#versionsList").innerHTML = `<div class="muted">Sem versões ainda.</div>`;
          return;
        }

        qs("#versionsList").innerHTML = items.slice(0, 12).map(r => {
          const dt = r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000) : null;
          const when = dt ? dt.toLocaleString("pt-BR") : "";
          return `
            <div class="item">
              <div class="row">
                <div>
                  <div class="title">${escapeHtml(r.action || "update")} • ${escapeHtml(when)}</div>
                  <div class="muted">Editor: ${escapeHtml(r.editorRole || "")} • ${escapeHtml(r.editorId || "")}</div>
                </div>
                <div class="pill">${escapeHtml(r.visibility || "public")}</div>
              </div>
              <div class="muted" style="margin-top:8px;">
                <div><strong>Título:</strong> ${escapeHtml(r.title || "")}</div>
                <div><strong>Categoria:</strong> ${escapeHtml(r.category || "")}</div>
                ${r.summary ? `<div><strong>Resumo:</strong> ${escapeHtml(r.summary)}</div>` : ""}
                ${Array.isArray(r.tags) && r.tags.length ? `<div><strong>Tags:</strong> ${escapeHtml(r.tags.join(", "))}</div>` : ""}
              </div>
            </div>
          `;
        }).join("");
      } catch (e) {
        qs("#versionsList").innerHTML = `<div class="msg err">Erro ao carregar versões.</div>`;
      }
    });

    // salvar página
    qs("#formPage").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const msg = qs("#msgPage");
      hideMsg(msg);

      try {
        if (!canEdit) throw new Error("Sem permissão para editar.");

        const id = (qs("#pageId").value || "").trim();
        const title = (qs("#pageTitle").value || "").trim();
        const category = qs("#pageCategory").value || "outros";
        const courseId = qs("#pageCourse").value || "";
        const classId = qs("#pageClass").value || "";
        const tags = normalizeTags(qs("#pageTags").value);
        const pinned = qs("#pagePinned").checked === true;
        const visibility = qs("#pageVisibility").value || "public";
        const summary = (qs("#pageSummary").value || "").trim();
        const body = (qs("#pageBody").value || "").trim();
        const links = linksFromTextarea(qs("#pageLinks").value);

        if (!title) throw new Error("Título é obrigatório.");
        if (!body && links.length === 0) throw new Error("Coloque conteúdo ou pelo menos 1 link.");

        // payload principal
        const payload = {
          title,
          category,
          courseId,
          classId,
          tags,
          pinned,
          visibility,
          summary,
          body,
          links,
          authorId: id ? undefined : me.uid, // só setaremos no create
          authorRole: id ? undefined : me.role,
          updatedAt: serverTimestamp()
        };

        // create
        if (!id){
          const docPayload = {
            ...payload,
            authorId: me.uid,
            authorRole: me.role,
            createdAt: serverTimestamp()
          };
          const ref = await addDoc(collection(db, "libraryPages"), docPayload);

          // revision create
          await writeRevision(me, ref.id, docPayload, "create");

          showMsg(msg, true, `Página criada! ID: ${ref.id}`);
          qs("#pageId").value = ref.id;
          currentId = ref.id;
        } else {
          // update: carregar para checar dono (extra no front)
          const prevSnap = await getDoc(doc(db, "libraryPages", id));
          if (!prevSnap.exists()) throw new Error("Página não encontrada.");

          const prev = prevSnap.data();
          const isOwner = prev.authorId === me.uid;
          if (!(me.role === "admin" || isOwner)) throw new Error("Você só pode editar páginas que você criou.");

          // merge sem undefined
          const clean = {};
          Object.keys(payload).forEach(k => {
            if (payload[k] !== undefined) clean[k] = payload[k];
          });

          await setDoc(doc(db, "libraryPages", id), clean, { merge: true });

          // revision update (snapshot “novo”)
          const revSnapshot = {
            title, category, courseId, classId, tags, pinned, visibility, summary, body, links
          };
          await writeRevision(me, id, revSnapshot, "update");

          showMsg(msg, true, "Página atualizada!");
          currentId = id;
        }

        // reload
        allPages = await loadAllPages();
        rerender();

        // abrir no viewer
        const opened = allPages.find(p => p.id === currentId);
        if (opened) renderViewer(me, opened);

      } catch (e) {
        showMsg(msg, false, e?.message || "Erro ao salvar.");
      }
    });

    // primeira renderização
    rerender();

  } catch (e) {
    qs("#fatal").style.display = "block";
    qs("#fatal").textContent = e?.message || "Erro na biblioteca.";
  }
}

main();