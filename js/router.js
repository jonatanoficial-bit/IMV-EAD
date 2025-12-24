// js/router.js
import { signOut, getMyProfile, showBanner, hideBanner } from "./auth.js";

export function roleToHome(role) {
  if (role === "admin") return "./admin.html";
  if (role === "teacher") return "./teacher.html";
  if (role === "student") return "./student.html";
  return "./index.html";
}

/**
 * GATE DE SEGURANÇA:
 * - Lê users/{uid}
 * - Valida active + role
 * - Se role não bater com a página, redireciona para a home correta
 * - Se der erro de perfil/role, mostra erro e desloga (NÃO cai pra aluno por padrão)
 */
export async function requireRole(allowedRoles = []) {
  hideBanner();

  try {
    const { user, profile, role, error } = await getMyProfile();

    if (!user) {
      showBanner("Você precisa estar logado.", "warn");
      window.location.href = "./index.html";
      return null;
    }

    if (error) {
      showBanner(`Erro de perfil: ${error} (UID: ${user.uid})`, "error");
      await signOut();
      return null;
    }

    // atualiza UI se existir
    const nameEl = document.getElementById("whoName");
    const roleEl = document.getElementById("whoRole");
    if (nameEl) nameEl.textContent = profile?.name || user.email || "Usuário";
    if (roleEl) roleEl.textContent = role;

    // Se a página exige um role específico
    if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
      if (!allowedRoles.includes(role)) {
        // NÃO manda pro aluno “por padrão”. Manda para a home correta do role real.
        const dest = roleToHome(role);
        showBanner(`Acesso negado para esta área. Indo para sua área: ${role}.`, "warn");
        setTimeout(() => (window.location.href = dest), 700);
        return null;
      }
    }

    return { user, profile, role };
  } catch (e) {
    showBanner(`Erro ao validar login: ${e?.message || e}`, "error");
    try { await signOut(); } catch {}
    return null;
  }
}

export function bindLogoutButton() {
  const btn = document.getElementById("btnLogout");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    try {
      await signOut();
    } finally {
      window.location.href = "./index.html";
    }
  });
}