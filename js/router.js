// js/router.js — roteador simples e estável por role
import { requireUserProfile } from "./auth.js";

function pageName() {
  const p = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  return p;
}

function go(file) {
  if (pageName() !== file.toLowerCase()) window.location.href = `./${file}`;
}

// Páginas públicas:
const PUBLIC = new Set(["index.html", ""]);

export async function startRouter() {
  const p = pageName();
  if (PUBLIC.has(p)) return; // index não força nada

  try {
    const { profile } = await requireUserProfile();
    const role = profile.role;

    // ✅ library e reports também entram aqui
    if (p === "library.html") return;
    if (p === "reports.html") {
      if (role !== "admin") go("index.html");
      return;
    }

    if (role === "admin") {
      if (p !== "admin.html") go("admin.html");
      return;
    }
    if (role === "teacher") {
      if (p !== "teacher.html") go("teacher.html");
      return;
    }
    if (role === "student") {
      if (p !== "student.html") go("student.html");
      return;
    }

    // role desconhecida
    go("index.html");
  } catch (e) {
    // não autenticado ou sem perfil → volta pro login
    go("index.html");
  }
}