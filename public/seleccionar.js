// seleccionar.js

const grupoSel = document.getElementById("grupo");
const estSel = document.getElementById("estudiante");
const pinInp = document.getElementById("pin");
const msg = document.getElementById("msg");
const btn = document.getElementById("btn");

const urlParams = new URLSearchParams(window.location.search);
let gradoId = urlParams.get("gradoId"); // ✅ viene desde index: 1 o 2

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("estudianteId");
  localStorage.removeItem("grupoId");
  localStorage.removeItem("estudianteNombre");
  localStorage.removeItem("gradoId");
}

function getNext() {
  const p = new URLSearchParams(window.location.search);
  return p.get("next");
}

// ✅ Si no hay gradoId, intentamos inferirlo del next (por si viene ...?gradoId=1)
function inferGradoIdFromNext(next) {
  try {
    if (!next) return null;
    const u = new URL(next, window.location.origin);
    const g = u.searchParams.get("gradoId");
    return g ? String(g) : null;
  } catch {
    return null;
  }
}

function goNext() {
  const next = getNext();

  // ✅ si venía rebotado a esta pantalla, vuelve a donde estaba
  if (next) {
    window.location.href = decodeURIComponent(next);
    return;
  }

  // ✅ si no hay next, manda a la página de GRADO (lista de TEMAS)
  // 🔥 CAMBIO: antes era tema.html?id=gradoId (eso estaba mal)
  if (gradoId) {
    window.location.href = `grado.html?id=${gradoId}`;
    return;
  }

  // fallback
  window.location.href = "index.html";
}

// ✅ si ya hay token, validarlo en backend (caducidad REAL)
(async function validarSesionExistente() {
  const existingToken = localStorage.getItem("token");
  if (!existingToken) return;

  try {
    const res = await fetch("/api/me", {
      headers: { Authorization: `Bearer ${existingToken}` },
    });

    if (!res.ok) throw new Error("Sesión inválida");

    // ✅ Si no llegó gradoId, lo saco del next si se puede
    const next = getNext();
    if (!gradoId) {
      const inferred = inferGradoIdFromNext(next);
      if (inferred) gradoId = inferred;
    }

    // ✅ Si hay gradoId en esta visita, lo guardo
    if (gradoId) {
      const stored = localStorage.getItem("gradoId");
      // si la sesión tenía un grado distinto, limpiamos para evitar inconsistencias
      if (stored && String(stored) !== String(gradoId)) {
        clearSession();
        return;
      }
      localStorage.setItem("gradoId", String(gradoId));
    }

    goNext();
  } catch {
    clearSession();
  }
})();

async function cargarGrupos() {
  const res = await fetch("/api/grupos");
  const grupos = await res.json();
  grupoSel.innerHTML =
    `<option value="">Selecciona grupo</option>` +
    grupos.map((g) => `<option value="${g.id}">${g.nombre}</option>`).join("");
}

async function cargarEstudiantes(grupoId) {
  estSel.innerHTML = `<option value="">Cargando...</option>`;
  const res = await fetch(`/api/estudiantes/${grupoId}`);
  const ests = await res.json();
  estSel.innerHTML =
    `<option value="">Selecciona estudiante</option>` +
    ests.map((e) => `<option value="${e.id}">${e.nombre}</option>`).join("");
}

grupoSel.addEventListener("change", () => {
  const id = grupoSel.value;
  if (!id) return;
  cargarEstudiantes(id);
});

btn.addEventListener("click", async () => {
  msg.textContent = "";

  // ✅ Si no llegó gradoId, intenta inferirlo del next
  if (!gradoId) {
    const inferred = inferGradoIdFromNext(getNext());
    if (inferred) gradoId = inferred;
  }

  if (!gradoId) {
    msg.textContent = "❌ Falta gradoId. Entra desde el index y elige Sexto o Séptimo.";
    return;
  }

  const estudiante_id = Number(estSel.value);
  const pin = pinInp.value.trim();

  if (!estudiante_id || pin.length < 4) {
    msg.textContent = "Selecciona estudiante y escribe el PIN.";
    return;
  }

  const res = await fetch("/api/sesion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estudiante_id, pin }),
  });

  const data = await res.json();
  if (!res.ok) {
    msg.textContent = data.error || "No se pudo iniciar.";
    return;
  }

  // ✅ Guardamos sesión
  localStorage.setItem("token", data.token);
  localStorage.setItem("estudianteId", String(data.estudiante_id));
  localStorage.setItem("grupoId", String(data.grupo_id));
  localStorage.setItem("estudianteNombre", data.nombre);

  // ✅ Guardamos el grado elegido (bloquea entrar al otro)
  localStorage.setItem("gradoId", String(gradoId));

  msg.textContent = "✅ Listo. Entrando...";

  goNext();
});

cargarGrupos();