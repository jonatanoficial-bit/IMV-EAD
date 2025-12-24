// js/router.js (ANTI-LOOP)
// - Nunca fica redirecionando sem parar
// - Se role não bater com a página, mostra aviso e oferece botão para ir à área correta

import { signOut, getMyProfile, showBanner, hideBanner } from "./auth.js";

export function roleToHome(role) {
  if (role === "admin") return "./admin.html";
  if (role === "teacher") return "./teacher.html";
  if (role === "student") return "./student.html";
  return "./index.html";
}

function samePage(targetHref) {
  try {
    const cur = new URL(window.location.href);
    const tgt = new URL(targetHref, cur);
    // compara apenas pathname (ignora ?v=)
    return cur.pathname.replace(/\/+$/, "") === tgt.pathname.replace(/\/+$/, "");
  } catch {
    return false;
  }
}

function mountGoButton(dest, text) {
  // cria um botão de ação dentro do banner (se existir um container)
  const banner = document.getElementById("banner");
  if (!banner) return;

  // evita duplicar
  if (banner.querySelector("[data-go-btn='1']")) return;

  const wrap = document.createElement("div");
  wrap.style.marginTop = "12px";
  wrap.style.display = "flex";
  wrap.style.gap = "10px";
  wrap.style.flexWrap = "wrap";

  const btnGo = document.createElement("button");
  btnGo.setAttribute("data-go-btn", "1");
  btnGo.className = "btn primary";
  btnGo.textContent = text || "Ir para minha área";
  btnGo.addEventListener("click", () => {
    window.location.replace(dest);
  });

  const btnLogout = document.createElement("button");
  btnLogout.className = "btn danger";
  btnLogout.textContent = "Sair";
  btnLogout.addEventListener("click", async () => {
    try {
      await signOut();
    } finally {
      window.location.replace("./index.html");
    }
  });

  wrap.appendChild(btnGo);
  wrap.appendChild(btnLogout);
  banner.appendChild(wrap);
}

/**
 * GATE DE SEGURANÇA SEM LOOP:
 * - Valida users/{uid} (active + role)
 * - Se role não for permitido, NÃO redireciona automático (evita piscar).
 *   Mostra aviso + botão para ir à área correta.
 */
export async function requireRole(allowedRoles = []) {
  hideBanner();

  try {
    const { user, profile, role, error } = await getMyProfile();

    if (!user) {
      showBanner("Você precisa estar logado.", "warn");
      // aqui pode redirecionar sem risco de loop
      window.location.replace("./index.html");
      return null;
    }

    if (error) {
      showBanner(`Erro de perfil: ${error} (UID: ${user.uid})`, "error");
      await signOut();
      // sem loop
      window.location.replace("./index.html");
      return null;
    }

    // UI
    const nameEl = document.getElementById("whoName");
    const roleEl = document.getElementById("whoRole");
    const pillEl = document.getElementById("pillRole");

    if (nameEl) nameEl.textContent = profile?.name || user.email || "Usuário";
    if (roleEl) roleEl.textContent = role || "";
    if (pillEl) pillEl.textContent = role || "";

    // Se a página exige role específico:
    if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
      if (!allowedRoles.includes(role)) {
        const dest = roleToHome(role);

        // Se por algum motivo o destino é a mesma página, só mostra aviso e para.
        if (samePage(dest)) {
          showBanner(`Seu acesso está OK (${role}), mas esta página detectou mismatch. Atualize a página.`, "warn");
          return { user, profile, role };
        }

        // NÃO redireciona automático (evita piscar)
        showBanner(
          `Acesso negado para esta área. Você está logado como: "${role}".`,
          "warn"
        );
        mountGoButton(dest, `Ir para minha área (${role})`);
        return null;
      }
    }

    return { user, profile, role };
  } catch (e) {
    showBanner(`Erro ao validar login: ${e?.message || e}`, "error");
    try { await signOut(); } catch {}
    window.location.replace("./index.html");
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
      window.location.replace("./index.html");
    }
  });
}