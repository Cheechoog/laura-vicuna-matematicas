// public/tema.js

// ======================
// 🔒 Guard helpers (usa session.js)
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

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ✅ fetch con token + auto logout si 401
async function fetchAuth(url, options = {}, gradoIdForRedirect = null) {
  const token = localStorage.getItem("token");

  if (!token) {
    redirectToSeleccionar(gradoIdForRedirect);
    throw new Error("Sin token");
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    clearSession();
    redirectToSeleccionar(gradoIdForRedirect);
    throw new Error("No autorizado / token vencido");
  }

  return res;
}

// ======================
// Main
// ======================
document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);

  // ✅ oficiales
  // ✅ compatibilidad vieja: grado, id
  const gradoId = params.get("gradoId") || params.get("grado") || params.get("id");
  const temaId = params.get("temaId");
  const nombreTema = params.get("tema") || "Subtemas";

  // 🔒 sesión
  if (typeof requireSession === "function") {
    requireSession(gradoId);
  }

  // 🔒 grado correcto
  if (typeof requireGrade === "function" && gradoId) {
    const ok = requireGrade(gradoId);
    if (!ok) return;
  }

  // UI titulo
  const titulo = $("titulo-tema");
  if (titulo) titulo.textContent = nombreTema;

  // Validación
  if (!gradoId) {
    console.error("❌ Falta gradoId en la URL. Usa: tema.html?gradoId=1&temaId=1");
    const container = $("subtemas-container");
    if (container) container.innerHTML = `<div class="cardbox">❌ Falta gradoId en la URL.</div>`;
    return;
  }

  if (!temaId) {
    console.error("❌ Falta temaId en la URL. Usa: tema.html?gradoId=1&temaId=1");
    const container = $("subtemas-container");
    if (container) container.innerHTML = `<div class="cardbox">❌ Falta temaId en la URL.</div>`;
    return;
  }

  await cargarSubtemasConResumen(temaId, gradoId);
});

// ======================
// ✅ LISTAR SUBTEMAS + DISPONIBILIDAD + PROGRESO
// ======================
async function cargarSubtemasConResumen(temaId, gradoId) {
  const container = $("subtemas-container");
  if (!container) return;

  container.innerHTML = "Cargando...";

  try {
    // ✅ Llamamos resumen + progreso al mismo tiempo
    const [resResumen, resProgreso] = await Promise.all([
      fetchAuth(`/api/tema/${encodeURIComponent(temaId)}/resumen`, {}, gradoId),
      fetchAuth(`/api/progreso/tema/${encodeURIComponent(temaId)}`, {}, gradoId),
    ]);

    if (!resResumen.ok) {
      container.innerHTML = `<div class="cardbox">❌ No se pudo cargar el resumen del tema.</div>`;
      return;
    }

    const resumen = await resResumen.json();
    const progreso = await resProgreso.json();

    // progresoMap[subtema_id] = { estado, ... }
    const progresoMap = {};
    if (Array.isArray(progreso)) {
      progreso.forEach((p) => {
        progresoMap[p.subtema_id] = p;
      });
    }

    container.innerHTML = "";

    if (!Array.isArray(resumen) || resumen.length === 0) {
      container.innerHTML = `<div class="cardbox">Aún no hay subtemas para este tema.</div>`;
      return;
    }

    resumen.forEach((row) => {
      const introCount = Number(row.intro_count || 0);
      const talleresCount = Number(row.talleres_count || 0);
      const quizCount = Number(row.quiz_count || 0);
      const plantillasCount = Number(row.plantillas_count || 0);

      const hasContent = introCount > 0 || talleresCount > 0 || quizCount > 0 || plantillasCount > 0;

      // ✅ disponible real (habilitado + fecha)
      const disponible = Number(row.disponible || 0) === 1;

      // ✅ progreso del estudiante
      const prog = progresoMap[row.subtema_id];
      const estado = prog?.estado || "no_iniciado";

      let progresoBadge = "";
      if (estado === "completado") {
        progresoBadge = `<span class="badge badge-success">🟢 Completado</span>`;
      } else if (estado === "en_progreso") {
        progresoBadge = `<span class="badge badge-warn">🟡 En progreso</span>`;
      } else {
        progresoBadge = `<span class="badge badge-neutral">⚪ No iniciado</span>`;
      }

      const card = document.createElement("a");
      card.className = "card";

      // ✅ Si NO tiene contenido -> tarjeta inactiva
      if (!hasContent) {
        card.classList.add("card-disabled");
        card.href = "#";
        card.addEventListener("click", (e) => {
          e.preventDefault();
          alert("⚠️ Este subtema aún no tiene contenido. Próximamente estará disponible.");
        });
      } else if (!disponible) {
        // ✅ Tiene contenido pero está BLOQUEADO por el profesor
        card.classList.add("card-disabled");
        card.href = "#";
        card.addEventListener("click", (e) => {
          e.preventDefault();
          alert("🔒 Este subtema aún no está disponible. Pregunta al profesor.");
        });
      } else {
        // ✅ disponible: entra normal
        card.href = `subtema.html?gradoId=${encodeURIComponent(gradoId)}&subtemaId=${encodeURIComponent(
          row.subtema_id
        )}&subtema=${encodeURIComponent(row.subtema_nombre)}`;
      }

      const parts = [];
      if (introCount > 0) parts.push(`📘 Intro (${introCount})`);
      if (talleresCount > 0) parts.push(`🧩 Taller (${talleresCount})`);
      if (quizCount > 0) parts.push(`✅ Quiz (${quizCount})`);
      if (plantillasCount > 0) parts.push(`⚡ Práctica`);

      // ✅ badge disponibilidad
      const disponibilidadBadge = hasContent
        ? (disponible
          ? `<span class="badge badge-ok">✅ Disponible</span>`
          : `<span class="badge badge-off">🔒 Bloqueado</span>`)
        : `<span class="badge badge-off">⏳ Sin contenido</span>`;

      card.innerHTML = `
  <div class="card-top">
    <h3 style="margin:0">${escapeHtml(row.subtema_nombre)}</h3>
    <div class="badges">
      ${disponibilidadBadge}
      ${progresoBadge}
    </div>
  </div>
  <p>${hasContent ? parts.join(" · ") : "Sin contenido disponible"}</p>
`;

      container.appendChild(card);
    });

    injectBadgeStylesIfMissing();
  } catch (e) {
    console.error(e);
    container.innerHTML = `<div class="cardbox">❌ Error cargando subtemas.</div>`;
  }
}

// ✅ si no tienes estilos badge, los inyecto aquí para que se vea bien
function injectBadgeStylesIfMissing() {
  if (document.getElementById("badge-styles")) return;
  const style = document.createElement("style");
  style.id = "badge-styles";
  style.textContent = `
    .badge {
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:6px 10px;
      border-radius:999px;
      font-size:12px;
      font-weight:800;
      border:1px solid rgba(255,255,255,0.14);
      background: rgba(255,255,255,0.10);
      white-space:nowrap;
    }
    .badge-ok {
      background: rgba(0,194,168,0.20);
      border-color: rgba(0,194,168,0.35);
    }
    .badge-off {
      opacity: 0.85;
    }

    /* ✅ progreso */
    .badge-success {
      background: rgba(34,197,94,0.20);
      border-color: rgba(34,197,94,0.40);
    }
    .badge-warn {
      background: rgba(245,158,11,0.20);
      border-color: rgba(245,158,11,0.40);
    }
    .badge-neutral {
      background: rgba(148,163,184,0.20);
      border-color: rgba(148,163,184,0.40);
    }
  `;
  document.head.appendChild(style);
} 