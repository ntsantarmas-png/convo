// ===================== AUTH TABS HANDLER =====================

// Εναλλαγή tabs (Login / Register / Anonymous)
function showTab(tabId) {
  // Κρύψε όλα τα panels
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  // Κάνε όλα τα κουμπιά ανενεργά
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));

  // Δείξε το επιλεγμένο
  const panel = document.getElementById("tab-" + tabId);
  const tab = document.getElementById(tabId + "Tab");
  if (panel) panel.classList.add("active");
  if (tab) tab.classList.add("active");
}

// Συνδέουμε τα κουμπιά tabs
document.getElementById("loginTab")?.addEventListener("click", () => showTab("login"));
document.getElementById("registerTab")?.addEventListener("click", () => showTab("register"));
document.getElementById("anonTab")?.addEventListener("click", () => showTab("anon"));

// Default → δείξε το Login
showTab("login");
