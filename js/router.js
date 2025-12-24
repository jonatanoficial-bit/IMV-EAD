// js/router.js
import { getMyProfileOrThrow, signOut } from "./auth.js";

export function roleHome(role) {
  if (role === "admin") return "./admin.html";
  if (role === "teacher") return "./teacher.html";
  if (role === "student") return "./student.html";
  return "./index.html";
}

// trava anti-loop: impede ficar redirecionando infinito
function setRedirectLock() {
  sessionStorage.setItem("IMV_REDIRECT_LOCK", String(Date.now()));
}
function hasRecentRedirectLock() {
  const v = Number(sessionStorage.getItem("IMV_REDIRECT_LOCK") || "0");
  return v && (Date.now() - v) < 2500; // 2.5s
}
function clearRedirectLock() {
  sessionStorage.removeItem("IMV_REDIRECT_LOCK");
}

export async function guardPage(allowedRoles = []) {
  // Se já redirecionou agora há pouco, não redireciona de novo (evita piscar)
  if (hasRecentRedirectLock()) {
    return null;
  }

  try {
    const { user, profile, role } = await getMyProfileOrThrow();

    // Se a página exige role específico e não bate
    if (allowedRoles.length && !allowedRoles.includes(role)) {
      const dest = roleHome(role);
      setRedirectLock();
      window.location.replace(dest);
      return null;
    }

    clearRedirectLock();
    return { user, profile, role };
  } catch (e) {
    // Não logado / perfil inválido → volta pro login SEM loop
    try { await signOut(); } catch {}
    setRedirectLock();
    window.location.replace("./index.html");
    return null;
  }
}