// js/teacher.js
import { requireAuth } from "./router.js";
import { watchAuth, logout, getUserProfile } from "./auth.js";

// Protege: somente teacher
requireAuth(["teacher"]);

const $ = (id) => document.getElementById(id);

watchAuth(async (user) => {
  if (!user) return;
  const profile = await getUserProfile(user.uid);
  $("who").textContent = profile?.name ? `${profile.name} • (${profile.role})` : `${user.email} • (teacher)`;
});

$("btnLogout").addEventListener("click", async () => {
  await logout();
});