// js/markdown.js
// Render bem simples e leve (sem libs) — suficiente pra wiki/biblioteca.
export function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderMarkdown(md) {
  const text = escapeHtml(md || "");

  // headers
  let out = text
    .replace(/^######\s?(.*)$/gm, "<h6>$1</h6>")
    .replace(/^#####\s?(.*)$/gm, "<h5>$1</h5>")
    .replace(/^####\s?(.*)$/gm, "<h4>$1</h4>")
    .replace(/^###\s?(.*)$/gm, "<h3>$1</h3>")
    .replace(/^##\s?(.*)$/gm, "<h2>$1</h2>")
    .replace(/^#\s?(.*)$/gm, "<h1>$1</h1>");

  // bold/italic
  out = out
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");

  // links [txt](url)
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, `<a href="$2" target="_blank" rel="noopener">$1</a>`);

  // listas simples
  out = out.replace(/^\s*-\s(.+)$/gm, "<li>$1</li>");
  out = out.replace(/(<li>[\s\S]*<\/li>)/g, "<ul>$1</ul>");

  // parágrafos
  out = out
    .split(/\n{2,}/)
    .map((chunk) => {
      if (/^\s*<h\d|^\s*<ul>/.test(chunk)) return chunk;
      return `<p>${chunk.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");

  return out;
}