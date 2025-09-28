// ===================== AUTH TABS =====================
function showTab(tab) {
  // Κρύβει όλα τα panels
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));

  // Δείχνει το σωστό
  const panel = document.getElementById("tab-" + tab);
  const btn = document.getElementById(tab + "Tab");
  if (panel) panel.classList.add("active");
  if (btn) btn.classList.add("active");
}

// === Default: Login ===
document.addEventListener("DOMContentLoaded", () => {
  showTab("login");

  document.getElementById("loginTab")?.addEventListener("click", () => showTab("login"));
  document.getElementById("registerTab")?.addEventListener("click", () => showTab("register"));
  document.getElementById("anonTab")?.addEventListener("click", () => showTab("anonymous"));
});
