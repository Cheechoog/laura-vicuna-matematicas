// public/grado.js

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);

  // ✅ Formato oficial: gradoId
  // ✅ Compatibilidad: id (antiguo)
  const gradoId = params.get("gradoId") || params.get("id");

  // 🔒 Requiere sesión (si no hay token, manda a seleccionar.html)
  if (typeof requireSession === "function") {
    requireSession(gradoId);
  }

  // Validación
  if (!gradoId) {
    console.error("❌ Falta gradoId en la URL. Usa: grado.html?gradoId=1");
    const container = document.getElementById("temas-container");
    if (container) {
      container.innerHTML = `<div class="cardbox">❌ Falta gradoId en la URL.</div>`;
    }
    return;
  }

  // 🔒 Bloqueo por grado (si está en sesión otro grado, lo saca)
  if (typeof requireGrade === "function") {
    const ok = requireGrade(gradoId);
    if (!ok) return;
  }

  cargarTemas(gradoId);
});

function cargarTemas(gradoId) {
  fetch(`/api/temas/${encodeURIComponent(gradoId)}`)
    .then((res) => res.json())
    .then((data) => {
      const container = document.getElementById("temas-container");
      if (!container) return;

      container.innerHTML = "";

      if (!Array.isArray(data) || data.length === 0) {
        container.innerHTML = `<div class="cardbox">Aún no hay temas para este grado.</div>`;
        return;
      }

      data.forEach((tema) => {
        const card = document.createElement("a");
        card.className = "card";

        // ✅ UNIFICADO: siempre gradoId + temaId + tema
        card.href = `tema.html?gradoId=${encodeURIComponent(gradoId)}&temaId=${encodeURIComponent(
          tema.id
        )}&tema=${encodeURIComponent(tema.nombre)}`;

        card.innerHTML = `
          <h3>${tema.nombre}</h3>
          <p>Explorar subtemas</p>
        `;

        container.appendChild(card);
      });
    })
    .catch((error) => {
      console.error("Error cargando temas:", error);
      const container = document.getElementById("temas-container");
      if (container) container.innerHTML = `<div class="cardbox">❌ Error cargando temas.</div>`;
    });
}