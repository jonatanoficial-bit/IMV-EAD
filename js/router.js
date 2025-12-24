// js/router.js
import { auth } from "./firebase.js";
import { onAuth, getMyProfile } from "./auth.js";

function here() {
  const path = location.pathname.split("/").pop() || "index.html";
  return path.toLowerCase();
}

function basePath() {
  // GitHub Pages: /IMV-EAD/...
  // Retorna o diretório atual para montar links relativos
  const p = location.pathname;
  return p.endsWith("/") ? p : p.substring(0, p.lastIndexOf("/") + 1);
}

function go(file) {
  const target = basePath() + file;
  if (location.href.endsWith("/" + file) || location.href.endsWith(file)) return;
  location.replace(target);
}

export function routeByRole(role) {
  if (role === "admin") return "admin.html";
  if (role === "teacher") return "teacher.html";
  return "student.html";
}

export function startRouter() {
  let guarding = false;

  onAuth(async (user) => {
    if (guarding) return;
    guarding = true;

    try {
      const current = here();

      if (!user) {
        // Deslogado: só index
        if (current !== "index.html" && current !== "") go("index.html");
        guarding = false;
        return;
      }

      const profile = await getMyProfile(user.uid);

      if (!profile || !profile.role) {
        // Logou no Auth, mas sem perfil no Firestore
        // Para evitar loop/piscando: faz logout e volta index
        try { await auth.signOut(); } catch {}
        go("index.html");
        guarding = false;
        return;
      }

      const dest = routeByRole(profile.role);

      // Se já está na página certa, não redireciona (evita “piscar”)
      if (current !== dest) go(dest);
    } catch (e) {
      // Se falhar, volta index (evita tela branca)
      try { await auth.signOut(); } catch {}
      go("index.html");
    } finally {
      guarding = false;
    }
  });
}