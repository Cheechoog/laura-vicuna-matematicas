const grupoSel = document.getElementById("grupo");
const estSel = document.getElementById("estudiante");
const pinInp = document.getElementById("pin");
const msg = document.getElementById("msg");
const btn = document.getElementById("btn");

const urlParams = new URLSearchParams(window.location.search);
let gradoId = urlParams.get("gradoId");

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

  if (next) {
    window.location.href = decodeURIComponent(next);
    return;
  }

  if (gradoId) {
    window.location.href = `grado.html?id=${gradoId}`;
    return;
  }

  window.location.href = "index.html";
}

function setMsg(text, ok = false) {
  if (!msg) return;
  msg.textContent = text || "";
  msg.className = ok ? "meta login-msg ok" : "meta login-msg";
}

(async function validarSesionExistente() {
  const existingToken = localStorage.getItem("token");
  if (!existingToken) return;

  try {
    const res = await fetch("/api/me", {
      headers: { Authorization: `Bearer ${existingToken}` },
    });

    if (!res.ok) throw new Error("Sesión inválida");

    const next = getNext();
    if (!gradoId) {
      const inferred = inferGradoIdFromNext(next);
      if (inferred) gradoId = inferred;
    }

    if (gradoId) {
      const stored = localStorage.getItem("gradoId");
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
  try {
    grupoSel.innerHTML = `<option value="">Cargando grupos...</option>`;

    const gradoParam = gradoId ? `?gradoId=${encodeURIComponent(gradoId)}` : "";
    const res = await fetch(`/api/grupos${gradoParam}`);
    const grupos = await res.json();

    if (!Array.isArray(grupos) || grupos.length === 0) {
      grupoSel.innerHTML = `<option value="">No hay grupos disponibles</option>`;
      estSel.innerHTML = `<option value="">Sin estudiantes</option>`;
      return;
    }

    grupoSel.innerHTML =
      `<option value="">Selecciona grupo</option>` +
      grupos.map((g) => `<option value="${g.id}">${g.nombre}</option>`).join("");
  } catch (e) {
    console.error(e);
    grupoSel.innerHTML = `<option value="">Error cargando grupos</option>`;
    estSel.innerHTML = `<option value="">Sin estudiantes</option>`;
  }
}

async function cargarEstudiantes(grupoId) {
  try {
    estSel.innerHTML = `<option value="">Cargando estudiantes...</option>`;

    const gradoParam = gradoId ? `?gradoId=${encodeURIComponent(gradoId)}` : "";
    const res = await fetch(`/api/estudiantes/${encodeURIComponent(grupoId)}${gradoParam}`);
    const ests = await res.json();

    if (!Array.isArray(ests) || ests.length === 0) {
      estSel.innerHTML = `<option value="">No hay estudiantes en este grupo</option>`;
      return;
    }

    estSel.innerHTML =
      `<option value="">Selecciona estudiante</option>` +
      ests.map((e) => `<option value="${e.id}">${e.nombre}</option>`).join("");
  } catch (e) {
    console.error(e);
    estSel.innerHTML = `<option value="">Error cargando estudiantes</option>`;
  }
}

grupoSel.addEventListener("change", () => {
  const id = grupoSel.value;
  setMsg("");
  if (!id) {
    estSel.innerHTML = `<option value="">Selecciona un grupo primero</option>`;
    return;
  }
  cargarEstudiantes(id);
});

btn.addEventListener("click", async () => {
  setMsg("");

  if (!gradoId) {
    const inferred = inferGradoIdFromNext(getNext());
    if (inferred) gradoId = inferred;
  }

  if (!gradoId) {
    setMsg("❌ Falta gradoId. Entra desde el inicio y elige Sexto o Séptimo.");
    return;
  }

  const estudiante_id = Number(estSel.value);
  const pin = pinInp.value.trim();

  if (!estudiante_id || pin.length < 4) {
    setMsg("Selecciona estudiante y escribe el PIN.");
    return;
  }

  try {
    btn.disabled = true;
    btn.textContent = "Entrando...";

    const res = await fetch("/api/sesion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estudiante_id, pin }),
    });

    const data = await res.json();

    if (!res.ok) {
      setMsg(data.error || "No se pudo iniciar sesión.");
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("estudianteId", String(data.estudiante_id));
    localStorage.setItem("grupoId", String(data.grupo_id));
    localStorage.setItem("estudianteNombre", data.nombre);
    localStorage.setItem("gradoId", String(gradoId));

    setMsg("✅ Ingreso correcto. Entrando...", true);
    setTimeout(goNext, 500);
  } catch (e) {
    console.error(e);
    setMsg("❌ Ocurrió un error al iniciar sesión.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Entrar";
  }
});

cargarGrupos();