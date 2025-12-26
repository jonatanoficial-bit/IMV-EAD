// js/router.js

function withCacheBuster(url) {
  const u = new URL(url, window.location.href);
  u.searchParams.set("v", String(Date.now()));
  return u.toString();
}

export function go(url) {
  window.location.href = withCacheBuster(url);
}

// ✅ redireciona por role
export function goToRoleHome(role) {
  if (role === "admin") return go("./admin.html");
  if (role === "teacher") return go("./teacher.html");
  if (role === "student") return go("./student.html");

  // fallback
  alert("Perfil sem role válida. Verifique /users/{uid} no Firestore.");
  return go("./index.html");
}