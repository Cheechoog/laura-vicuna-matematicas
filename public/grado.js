// public/grado.js

document.addEventListener("DOMContentLoaded", () => {
  // 🔒 Requiere sesión (si no hay token, manda a seleccionar.html)
  if (typeof requireSession === "function") {
    // gradoId viene en ?id=1 (tu página de temas por grado)
    const params = new URLSearchParams(window.location.search);
    const gradoId = params.get("id");

    // si no hay gradoId, igual deja continuar para que salga tu error normal
    requireSession(gradoId);
  }

  const params = new URLSearchParams(window.location.search);
  const gradoId = params.get("id");

  if (!gradoId) {
    console.error("No se recibió el id del grado");
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
  fetch(`/api/temas/${gradoId}`)
    .then((res) => res.json())
    .then((data) => {
      const container = document.getElementById("temas-container");
      container.innerHTML = "";

      data.forEach((tema) => {
        const card = document.createElement("a");
        card.className = "card";

        // ✅ CORRECTO: manda gradoId (NO "grado")
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
    .catch((error) => console.error("Error cargando temas:", error));
}