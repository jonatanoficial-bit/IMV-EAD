// js/router.js
import { watchAuth, getUserRole } from "./auth.js";

/**
 * Base dinâmica:
 * - Em GitHub Pages com repo: /NOME-DO-REPO/
 * - Em domínio raiz: /
 * Assim NÃO quebra se o repo mudar de nome e evita loop/piscar.
 */
function detectBasePath() {
  const p = window.location.pathname || "/";
  // Ex.: "/IMV-EAD/index.html" => ["", "IMV-EAD", "index.html"]
  const parts = p.split("/").filter(Boolean);

  // Se estiver em github.io e tiver um primeiro segmento, assume ser o repo
  const isGithubPages = window.location.hostname.endsWith("github.io");
  if (isGithubPages && parts.length >= 1) return `/${parts[0]}/`;

  // Caso contrário (domínio raiz), usa "/"
  return "/";
}

const BASE = detectBasePath();

export function go(path) {
  const clean = path.replace(/^\//, "");
  window.location.href = BASE + clean;
}

export function requireAuth(allowedRoles = []) {
  watchAuth(async (user) => {
    if (!user) {
      go("index.html");
      return;
    }

    const role = await getUserRole(user.uid);

    if (!role) {
      alert("Usuário sem perfil no sistema (role). Fale com o administrador.");
      go("index.html");
      return;
    }

    if (allowedRoles.length && !allowedRoles.includes(role)) {
      alert("Acesso não autorizado para este perfil.");
      go("index.html");
      return;
    }
  });
}

export async function redirectByRole(user) {
  const role = await getUserRole(user.uid);

  if (role === "admin") go("admin.html");
  else if (role === "teacher") go("teacher.html");
  else if (role === "student") go("student.html");
  else go("index.html");
}