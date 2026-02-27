// public/session.js

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("estudianteId");
  localStorage.removeItem("grupoId");
  localStorage.removeItem("estudianteNombre");
  localStorage.removeItem("gradoId");
}

function getNextUrl() {
  return window.location.pathname + window.location.search;
}

function redirectToSeleccionar(gradoId) {
  const next = encodeURIComponent(getNextUrl());
  const g = gradoId ? `&gradoId=${encodeURIComponent(gradoId)}` : "";
  window.location.href = `seleccionar.html?next=${next}${g}`;
}

function requireSession(gradoIdOpcional) {
  const token = localStorage.getItem("token");
  if (!token) {
    redirectToSeleccionar(gradoIdOpcional);
    return false;
  }
  return true;
}

function requireGrade(expectedGradoId) {
  const stored = localStorage.getItem("gradoId");
  if (!expectedGradoId) return true;
  if (!stored) return true;

  if (String(stored) !== String(expectedGradoId)) {
    alert("❌ No puedes entrar a este grado con tu sesión actual.");
    clearSession();
    window.location.href = "index.html";
    return false;
  }
  return true;
}

// 🔥 Botón cerrar sesión global (si existe)
function setupLogoutButton() {
  const btn = document.getElementById("btn-logout");
  if (!btn) return;

  // ✅ En seleccionar.html JAMÁS mostramos logout (aunque exista por error)
  if (window.location.pathname.includes("seleccionar.html")) {
    btn.style.display = "none";
    return;
  }

  // ✅ Mostrar/ocultar según token
  const token = localStorage.getItem("token");
  btn.style.display = token ? "inline-flex" : "none";

  // ✅ Evita doble listener si el script se carga 2 veces
  if (btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";

  btn.addEventListener("click", () => {
    clearSession();
    window.location.href = "index.html";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupLogoutButton();
});