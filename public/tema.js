// ======================
// 🔒 Guard: token + grado correcto
// ======================
function getNextUrl() {
  return window.location.pathname + window.location.search;
}

function redirectToSeleccionar(gradoId) {
  const next = encodeURIComponent(getNextUrl());
  const g = gradoId ? `&gradoId=${encodeURIComponent(gradoId)}` : "";
  window.location.href = `seleccionar.html?next=${next}${g}`;
}

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("estudianteId");
  localStorage.removeItem("grupoId");
  localStorage.removeItem("estudianteNombre");
  localStorage.removeItem("gradoId");
}

function requireTokenAndGrade(expectedGradoId) {
  const token = localStorage.getItem("token");
  const storedGradoId = localStorage.getItem("gradoId");

  if (!token) {
    redirectToSeleccionar(expectedGradoId);
    return false;
  }

  // ✅ Bloquea entrar al grado contrario
  if (expectedGradoId && storedGradoId && String(storedGradoId) !== String(expectedGradoId)) {
    alert("❌ No puedes entrar a este grado con tu sesión actual.");
    clearSession();
    window.location.href = "index.html";
    return false;
  }

  return true;
}

// ✅ Helper: obtener gradoId real (nunca null)
function resolveGradoId(params) {
  // A veces viene como ?id=1 (tema.html?id=1)
  // A veces viene como ?gradoId=1
  let g = params.get("gradoId") || params.get("id");

  // Si viene "null" o vacío, intenta localStorage
  if (!g || g === "null") g = localStorage.getItem("gradoId");

  // Si ya lo tenemos, lo guardamos
  if (g && g !== "null") localStorage.setItem("gradoId", String(g));

  return g;
}

// ======================
// TU CÓDIGO (igual, solo corregí gradoId y el href)
// ======================
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);

  const gradoId = resolveGradoId(params); // ✅ FIX REAL
  const temaId = params.get("temaId");
  const nombreTema = params.get("tema");

  // ✅ PROTEGER: antes de cargar nada
  if (!requireTokenAndGrade(gradoId)) return;

  const titulo = document.getElementById("titulo-tema");
  if (titulo) titulo.textContent = nombreTema || "Subtemas";

  if (!temaId) {
    console.error("No se recibió el id del tema");
    return;
  }

  cargarSubtemas(temaId, gradoId);
});

function cargarSubtemas(temaId, gradoId) {
  fetch(`/api/subtemas/${temaId}`)
    .then((res) => res.json())
    .then((data) => {
      const container = document.getElementById("subtemas-container");
      container.innerHTML = "";

      // ✅ grado seguro (nunca null)
      const g = (gradoId && gradoId !== "null") ? gradoId : localStorage.getItem("gradoId");

      data.forEach((subtema) => {
        const card = document.createElement("a");
        card.className = "card";

        // ✅ Mantengo tu href, pero garantizo gradoId válido
        card.href = `subtema.html?gradoId=${encodeURIComponent(g)}&subtemaId=${subtema.id}&subtema=${encodeURIComponent(subtema.nombre)}`;

        card.innerHTML = `
          <h3>${subtema.nombre}</h3>
          <p>Practicar ahora</p>
        `;

        container.appendChild(card);
      });
    })
    .catch((error) => console.error("Error cargando subtemas:", error));
}