// js/router.js
import { watchAuth, getUserRole } from "./auth.js";

/**
 * ATENÇÃO:
 * O BASE precisa ser EXATAMENTE o nome do repositório no GitHub Pages.
 * Seu site está em:
 * https://jonatanoficial-bit.github.io/IMV-EA/
 */
const BASE = "/IMV-EA/";

export function go(path) {
  window.location.href = BASE + path.replace(/^\//, "");
}

export function requireAuth(allowedRoles = []) {
  watchAuth(async (user) => {
    if (!user) {
      go("index.html");
      return;
    }

    const role = await getUserRole(user.uid);

    if (!role) {
      alert("Usuário sem perfil no sistema. Fale com o administrador.");
      await import("./auth.js").then(m => m.logout());
      go("index.html");
      return;
    }

    if (allowedRoles.length && !allowedRoles.includes(role)) {
      alert("Acesso não autorizado para este perfil.");
      await import("./auth.js").then(m => m.logout());
      go("index.html");
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