// js/router.js
import { getSession, safeLogout, logTo } from "./auth.js";

export function roleToPage(role) {
  if (role === "admin") return "./admin.html";
  if (role === "teacher") return "./teacher.html";
  return "./student.html";
}

export async function routeByRole(preLog = null) {
  const s = await getSession(preLog);
  if (!s.user || !s.profile) return "./index.html";
  return roleToPage(s.profile.role);
}

export async function hardRouteNow(preLog = null) {
  const url = await routeByRole(preLog);
  location.replace(url);
}

export function bindLogout(btnId = "btnLogout", preLog = null) {
  const btn = document.getElementById(btnId);
  if (!btn) return;

  btn.addEventListener("click", async () => {
    logTo(preLog, "Logout solicitado...");
    await safeLogout();
    location.replace("./index.html");
  });
}