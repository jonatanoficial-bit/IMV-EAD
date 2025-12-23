// js/router.js
import { watchAuth, getUserRole } from "./auth.js";

const BASE = "/IMV-EAD/"; // porque seu site é https://jonatanoficial-bit.github.io/IMV-EAD/

export function go(path) {
  window.location.href = BASE + path.replace(/^\//, "");
}

export function requireAuth(allowedRoles = []) {
  // Protege páginas (admin.html, teacher.html, student.html)
  watchAuth(async (user) => {
    if (!user) {
      go("index.html");
      return;
    }

    const role = await getUserRole(user.uid);
    if (!role) {
      alert("Seu usuário ainda não tem perfil/role no sistema. Fale com o admin.");
      go("index.html");
      return;
    }

    if (allowedRoles.length && !allowedRoles.includes(role)) {
      alert("Acesso negado para este perfil.");
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