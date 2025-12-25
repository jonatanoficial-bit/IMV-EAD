// js/markdown.js — Markdown LEVE (sem libs) para preview e leitura
// Suporta: # ## ###, listas "-", **negrito**, *itálico*, links https://...
function esc(s){
  return (s ?? "").toString().replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));
}

function linkify(line){
  // transforma URLs em <a>
  const urlRe = /(https?:\/\/[^\s)]+)|(www\.[^\s)]+)/g;
  return line.replace(urlRe, (m) => {
    const href = m.startsWith("http") ? m : "https://" + m;
    return `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(m)}</a>`;
  });
}

function inline(md){
  let t = esc(md);
  // negrito
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // itálico
  t = t.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // links
  t = linkify(t);
  return t;
}

export function renderMarkdown(mdText){
  const raw = (mdText ?? "").toString().replace(/\r\n/g, "\n");
  const lines = raw.split("\n");

  let html = "";
  let inList = false;

  const closeList = () => {
    if (inList) { html += "</ul>"; inList = false; }
  };

  for (const line0 of lines){
    const line = line0.trimEnd();

    if (!line.trim()){
      closeList();
      html += `<div style="height:8px;"></div>`;
      continue;
    }

    // headings
    if (line.startsWith("### ")){ closeList(); html += `<h3 style="margin:10px 0 6px;">${inline(line.slice(4))}</h3>`; continue; }
    if (line.startsWith("## ")){ closeList(); html += `<h2 style="margin:12px 0 6px; font-size:18px;">${inline(line.slice(3))}</h2>`; continue; }
    if (line.startsWith("# ")){ closeList(); html += `<h1 style="margin:12px 0 6px; font-size:20px;">${inline(line.slice(2))}</h1>`; continue; }

    // list
    if (line.startsWith("- ")){
      if (!inList){ html += "<ul style='margin:8px 0 8px 18px; padding:0;'>"; inList = true; }
      html += `<li style="margin:4px 0;">${inline(line.slice(2))}</li>`;
      continue;
    }

    closeList();
    html += `<p style="margin:6px 0; line-height:1.5;">${inline(line)}</p>`;
  }

  closeList();
  return html;
}