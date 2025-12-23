// js/router.js
import { watchAuth, getUserRole, logout } from "./auth.js";

/**
 * Detecta automaticamente o base path do GitHub Pages:
 * Ex: /IMV-EAD/
 */
function detectBasePath() {
  const p = window.location.pathname || "/";
  const parts = p.split("/").filter(Boolean);
  const isGithubPages = window.location.hostname.endsWith("github.io");
  if (isGithubPages && parts.length >= 1) return `/${parts[0]}/`;
  return "/";
}

export const BASE = detectBasePath();

export function go(path) {
  const clean = path.replace(/^\//, "");
  const target = BASE + clean;

  // Evita recarregar a mesma página (reduz flicker)
  if (window.location.pathname.endsWith(clean)) return;

  window.location.href = target;
}

export function requireAuth(allowedRoles = []) {
  watchAuth(async (user) => {
    if (!user) {
      go("index.html");
      return;
    }

    let role = null;
    try {
      role = await getUserRole(user.uid);
    } catch (e) {
      // Se Firestore bloquear, não entra em loop: faz logout e volta
      console.error("Erro ao ler role:", e);
      alert("Erro ao validar perfil (Firestore). Vou sair e voltar ao login.");
      await logout();
      go("index.html");
      return;
    }

    if (!role) {
      alert("Seu usuário está logado, mas ainda NÃO tem 'role' no Firestore. Vou sair para evitar loop.");
      await logout();
      go("index.html");
      return;
    }

    if (allowedRoles.length && !allowedRoles.includes(role)) {
      alert("Acesso não autorizado para este perfil. Vou sair.");
      await logout();
      go("index.html");
      return;
    }
  });
}

export async function redirectByRoleSafe(user) {
  let role = null;

  try {
    role = await getUserRole(user.uid);
  } catch (e) {
    console.error("Erro ao ler role:", e);
    return { ok: false, reason: "firestore_error", error: e };
  }

  if (!role) return { ok: false, reason: "missing_role" };

  if (role === "admin") { go("admin.html"); return { ok: true, role }; }
  if (role === "teacher") { go("teacher.html"); return { ok: true, role }; }
  if (role === "student") { go("student.html"); return { ok: true, role }; }

  return { ok: false, reason: "unknown_role", role };
}