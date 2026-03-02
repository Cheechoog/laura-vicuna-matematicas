// public/main.js
// ✅ En index.html reescribe los links según el rol.
// - Estudiante: seleccionar.html?gradoId=...
// - Profesor (teacher=1): grado.html?gradoId=...

function isTeacher() {
  return localStorage.getItem("teacher") === "1";
}

document.addEventListener("DOMContentLoaded", () => {
  // Solo actúa en index.html
  const path = window.location.pathname.toLowerCase();
  if (!path.endsWith("/index.html") && !path.endsWith("/")) return;

  const teacher = isTeacher();

  // Todas las cards de grado (usamos data-grado si existe)
  const cards = document.querySelectorAll('#grados-container a.card');

  cards.forEach((a) => {
    // intenta leer gradoId de data-grado o de la URL original
    let gradoId = a.getAttribute("data-grado");

    if (!gradoId) {
      try {
        const u = new URL(a.getAttribute("href"), window.location.origin);
        gradoId = u.searchParams.get("gradoId");
      } catch {}
    }

    if (!gradoId) return;

    if (teacher) {
      // ✅ profesor entra directo al menú normal (sin seleccionar estudiante)
      a.setAttribute("href", `grado.html?gradoId=${encodeURIComponent(gradoId)}`);
    } else {
      // ✅ estudiante: login normal
      a.setAttribute("href", `seleccionar.html?gradoId=${encodeURIComponent(gradoId)}`);
    }
  });
});