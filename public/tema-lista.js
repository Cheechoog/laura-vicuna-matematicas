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

function buildContentBadge(label, ok) {
  return `
    <span class="subtema-chip ${ok ? "subtema-chip-on" : "subtema-chip-off"}">
      <span class="subtema-chip-mark">${ok ? "✓" : "—"}</span>
      <span>${escapeHtml(label)}</span>
    </span>
  `;
}

async function authFetch(url, gradoId) {
  if (typeof window.fetchAuth === "function") {
    return window.fetchAuth(url, {}, gradoId);
  }
  return fetch(url, { cache: "no-store" });
}

function renderTemaEmpty(icono, titulo, texto) {
  const container = $("temas-container");
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state tema-empty-full">
      <div class="empty-state-icon">${icono}</div>
      <h3>${titulo}</h3>
      <p>${texto}</p>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);

  const gradoId = params.get("gradoId") || params.get("grado") || params.get("id");
  const periodoId = params.get("periodoId");
  const periodo = params.get("periodo") || "";
  const temaId = params.get("temaId");
  const nombreTema = params.get("tema") || "Subtemas";
  const teacherMode = window.isTeacher?.() === true;

  if (typeof window.requireSession === "function") {
    window.requireSession(gradoId);
  }

  if (typeof window.requireGrade === "function" && gradoId) {
    const ok = window.requireGrade(gradoId);
    if (!ok) return;
  }

  const titulo = $("titulo-periodo");
  if (titulo) {
    titulo.innerHTML = `
      <div class="page-title-stack">
        <span class="page-kicker">${teacherMode ? "Tema académico · Profesor" : "Tema académico"}</span>
        <span>${escapeHtml(nombreTema)}</span>
      </div>
    `;
  }

  const statPeriodo = $("tema-stat-periodo");
  if (statPeriodo) statPeriodo.textContent = periodo || "Periodo";

  const statGrado = $("tema-stat-grado");
  if (statGrado) {
    if (String(gradoId) === "1") statGrado.textContent = "Sexto";
    else if (String(gradoId) === "2") statGrado.textContent = "Séptimo";
    else statGrado.textContent = "Grado";
  }

  const sectionTitle = document.querySelector(".tema-section-title");
  if (sectionTitle) sectionTitle.textContent = "Selecciona un subtema";

  const sectionSubtitle = document.querySelector(".tema-section-subtitle");
  if (sectionSubtitle) {
    sectionSubtitle.textContent =
      "Cada tarjeta te lleva al subtema y a sus actividades disponibles dentro del tema actual.";
  }

  if (!gradoId) {
    renderTemaEmpty("⚠️", "Falta el grado", "No se encontró el grado para cargar los subtemas.");
    return;
  }

  if (!temaId) {
    renderTemaEmpty("⚠️", "Falta el tema", "No se encontró el tema para cargar los subtemas.");
    return;
  }

  injectTemaCardStyles();
  await cargarSubtemasConResumen(temaId, gradoId, periodoId, periodo, nombreTema, teacherMode);
});

async function cargarSubtemasConResumen(temaId, gradoId, periodoId, periodo, nombreTema, teacherMode) {
  const container = $("temas-container");
  if (!container) return;

  container.innerHTML = `
    <div class="loading-state tema-empty-full">
      <div class="loading-spinner"></div>
      <p>Cargando subtemas...</p>
    </div>
  `;

  try {
    const resResumen = await authFetch(
      `/api/tema/${encodeURIComponent(temaId)}/resumen`,
      gradoId
    );

    if (!resResumen.ok) {
      const errorText = await resResumen.text().catch(() => "");
      console.error("Error resumen tema:", resResumen.status, errorText);

      container.innerHTML = `
        <div class="empty-state tema-empty-full">
          <div class="empty-state-icon">❌</div>
          <h3>No se pudo cargar el tema</h3>
          <p>Ocurrió un problema al obtener el resumen del tema.</p>
        </div>
      `;
      return;
    }

    const resumen = await resResumen.json();
    const resumenArray = Array.isArray(resumen) ? resumen : [];

    // 1) unir filas repetidas por subtema_id
    const porId = new Map();

    for (const row of resumenArray) {
      const id = row.subtema_id;
      if (!id) continue;

      if (!porId.has(id)) {
        porId.set(id, {
          ...row,
          intro_count: Number(row.intro_count || 0),
          talleres_count: Number(row.talleres_count || 0),
          quiz_count: Number(row.quiz_count || 0),
          plantillas_count: Number(row.plantillas_count || 0),
          disponible: Number(row.disponible || 0),
        });
        continue;
      }

      const actual = porId.get(id);

      actual.intro_count = Math.max(actual.intro_count, Number(row.intro_count || 0));
      actual.talleres_count = Math.max(actual.talleres_count, Number(row.talleres_count || 0));
      actual.quiz_count = Math.max(actual.quiz_count, Number(row.quiz_count || 0));
      actual.plantillas_count = Math.max(actual.plantillas_count, Number(row.plantillas_count || 0));
      actual.disponible =
        actual.disponible === 1 || Number(row.disponible || 0) === 1 ? 1 : 0;

      if (!actual.subtema_nombre && row.subtema_nombre) {
        actual.subtema_nombre = row.subtema_nombre;
      }
    }

    const resumenPorId = Array.from(porId.values());

    // 2) unir duplicados por nombre (porque a veces vienen ids distintos con el mismo nombre)
    function claveNombre(nombre) {
      return String(nombre || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
    }

    const porNombre = new Map();

    for (const row of resumenPorId) {
      const key = claveNombre(row.subtema_nombre) || `subtema-${row.subtema_id}`;

      if (!porNombre.has(key)) {
        porNombre.set(key, { ...row });
        continue;
      }

      const actual = porNombre.get(key);

      actual.intro_count = Math.max(Number(actual.intro_count || 0), Number(row.intro_count || 0));
      actual.talleres_count = Math.max(Number(actual.talleres_count || 0), Number(row.talleres_count || 0));
      actual.quiz_count = Math.max(Number(actual.quiz_count || 0), Number(row.quiz_count || 0));
      actual.plantillas_count = Math.max(Number(actual.plantillas_count || 0), Number(row.plantillas_count || 0));
      actual.disponible =
        Number(actual.disponible || 0) === 1 || Number(row.disponible || 0) === 1 ? 1 : 0;
    }

    const resumenFinal = Array.from(porNombre.values());

    // 3) cargar progreso sin romper si falla
    let progreso = [];
    if (!teacherMode) {
      try {
        const resProgreso = await authFetch(
          `/api/progreso/tema/${encodeURIComponent(temaId)}`,
          gradoId
        );

        if (resProgreso.ok) {
          progreso = await resProgreso.json();
        }
      } catch (e) {
        console.warn("No se pudo cargar progreso:", e);
      }
    }

    const progresoMap = {};
    if (Array.isArray(progreso)) {
      progreso.forEach((p) => {
        progresoMap[p.subtema_id] = p;
      });
    }

    if (!resumenFinal.length) {
      container.innerHTML = `
        <div class="empty-state tema-empty-full">
          <div class="empty-state-icon">📘</div>
          <h3>No hay subtemas</h3>
          <p>Este tema todavía no tiene subtemas registrados.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = resumenFinal
      .map((row, index) => {
        const introCount = Number(row.intro_count || 0);
        const talleresCount = Number(row.talleres_count || 0);
        const quizCount = Number(row.quiz_count || 0);
        const plantillasCount = Number(row.plantillas_count || 0);

        const hasIntro = introCount > 0;
        const hasPractica = plantillasCount > 0;
        const hasTaller = talleresCount > 0 || plantillasCount > 0;
        const hasQuiz = quizCount > 0 || plantillasCount > 0;
        const hasContent = hasIntro || hasPractica || hasTaller || hasQuiz;

        const disponible = Number(row.disponible || 0) === 1;
        const prog = progresoMap[row.subtema_id];
        const estado = prog?.estado || "no_iniciado";

        let estadoBadge = "";
        if (teacherMode) {
          estadoBadge = `<span class="badge badge-teacher">👩‍🏫 Vista profesor</span>`;
        } else if (estado === "completado") {
          estadoBadge = `<span class="badge badge-done">✔ Completado</span>`;
        } else if (estado === "en_progreso") {
          estadoBadge = `<span class="badge badge-progress">⏳ En progreso</span>`;
        } else {
          estadoBadge = `<span class="badge badge-progress">○ No iniciado</span>`;
        }

        const disponibilidadBadge = hasContent
          ? (disponible
              ? `<span class="badge badge-ok">● Disponible</span>`
              : `<span class="badge badge-block">🔒 Bloqueado</span>`)
          : `<span class="badge badge-block">— Sin contenido</span>`;

        const href = `subtema.html?gradoId=${encodeURIComponent(gradoId)}&periodoId=${encodeURIComponent(periodoId || "")}&periodo=${encodeURIComponent(periodo || "")}&temaId=${encodeURIComponent(temaId)}&tema=${encodeURIComponent(nombreTema || "")}&subtemaId=${encodeURIComponent(row.subtema_id)}&subtema=${encodeURIComponent(row.subtema_nombre)}`;

        const contentChips = `
          <div class="subtema-content-row">
            ${buildContentBadge("Intro", hasIntro)}
            ${buildContentBadge("Práctica", hasPractica)}
            ${buildContentBadge("Taller", hasTaller)}
            ${buildContentBadge("Quiz", hasQuiz)}
          </div>
        `;

        const cardHtml = `
          <div class="subtema-card-head">
            <div class="subtema-number">Subtema ${index + 1}</div>
            <div class="subtema-arrow">→</div>
          </div>

          <div class="subtema-card-body">
            <h3 class="subtema-name">${escapeHtml(row.subtema_nombre)}</h3>
            ${contentChips}
          </div>

          <div class="subtema-footer">
            ${disponibilidadBadge}
            ${estadoBadge}
          </div>
        `;

        if (!hasContent) {
          return `
            <a href="#" class="subtema-card card-disabled" data-locked="nocontent">
              ${cardHtml}
            </a>
          `;
        }

        if (!disponible && !teacherMode) {
          return `
            <a href="#" class="subtema-card card-disabled" data-locked="blocked">
              ${cardHtml}
            </a>
          `;
        }

        return `
          <a href="${href}" class="subtema-card">
            ${cardHtml}
          </a>
        `;
      })
      .join("");

    container.querySelectorAll('[data-locked="nocontent"]').forEach((card) => {
      card.addEventListener("click", (e) => {
        e.preventDefault();
        alert("⚠️ Este subtema aún no tiene contenido.");
      });
    });

    container.querySelectorAll('[data-locked="blocked"]').forEach((card) => {
      card.addEventListener("click", (e) => {
        e.preventDefault();
        alert("🔒 Este subtema aún no está disponible. Pregunta al profesor.");
      });
    });
  } catch (e) {
    console.error("Error cargando subtemas:", e);
    container.innerHTML = `
      <div class="empty-state tema-empty-full">
        <div class="empty-state-icon">❌</div>
        <h3>Error cargando subtemas</h3>
        <p>No fue posible cargar los subtemas de este tema.</p>
      </div>
    `;
  }
}

function injectTemaCardStyles() {
  const old = document.getElementById("tema-redesign-styles");
  if (old) old.remove();

  const style = document.createElement("style");
  style.id = "tema-redesign-styles";
  style.textContent = `
    .tema-empty-full{
      grid-column: 1 / -1;
    }

    .subtema-card{
      background: linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05));
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 30px;
      padding: 22px;
      transition: .25s ease;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 280px;
      position: relative;
      text-decoration: none;
      color: #eef6ff;
      box-shadow: 0 18px 42px rgba(0,0,0,.28);
      overflow: hidden;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }

    .subtema-card::before{
      content:"";
      position:absolute;
      inset:0;
      background:
        radial-gradient(320px 140px at 100% 0%, rgba(94, 207, 255, .08), transparent 60%);
      pointer-events:none;
    }

    .subtema-card:hover{
      transform: translateY(-8px);
      border-color: rgba(94, 207, 255, .34);
      box-shadow: 0 28px 56px rgba(0,0,0,.38);
    }

    .subtema-card.card-disabled{
      opacity:.72;
      filter: grayscale(.08);
    }

    .subtema-card-head{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-bottom:18px;
    }

    .subtema-number{
      display:inline-flex;
      align-items:center;
      padding:8px 13px;
      border-radius:999px;
      font-size:.76rem;
      font-weight:900;
      letter-spacing:.03em;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.10);
      color: rgba(246,251,255,.96);
    }

    .subtema-arrow{
      font-size:1.28rem;
      font-weight:900;
      opacity:.72;
      transition:.18s ease;
    }

    .subtema-card:hover .subtema-arrow{
      transform:translateX(3px);
      opacity:1;
    }

    .subtema-card-body{
      flex:1;
      display:flex;
      flex-direction:column;
      justify-content:flex-start;
      gap:16px;
    }

    .subtema-name{
      font-size: clamp(1.22rem, 1.8vw, 1.55rem);
      line-height:1.14;
      margin:0;
      font-weight:950;
      color:#ffffff;
      text-wrap:balance;
    }

    .subtema-content-row{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
    }

    .subtema-chip{
      display:inline-flex;
      align-items:center;
      gap:7px;
      padding:8px 11px;
      border-radius:999px;
      font-size:.75rem;
      font-weight:800;
      border:1px solid rgba(255,255,255,.10);
      white-space:nowrap;
      background: rgba(255,255,255,0.07);
    }

    .subtema-chip-on{
      background:rgba(34,197,94,.14);
      border-color:rgba(34,197,94,.22);
      color:rgba(242,255,246,.98);
    }

    .subtema-chip-off{
      background:rgba(148,163,184,.12);
      border-color:rgba(148,163,184,.18);
      color:rgba(255,255,255,.84);
    }

    .subtema-chip-mark{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-width:14px;
      font-weight:900;
    }

    .subtema-footer{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      margin-top:18px;
    }

    .badge{
      padding:8px 12px;
      border-radius:999px;
      font-size:.76rem;
      font-weight:900;
      border:1px solid rgba(255,255,255,.12);
      white-space:nowrap;
      background: rgba(255,255,255,0.07);
    }

    .badge-ok{
      background:rgba(34,197,94,.16);
      border-color:rgba(34,197,94,.28);
      color:rgba(244,255,247,.98);
    }

    .badge-block{
      background:rgba(148,163,184,.14);
      border-color:rgba(148,163,184,.22);
      color:rgba(255,255,255,.88);
    }

    .badge-progress{
      background:rgba(99,102,241,.14);
      border-color:rgba(99,102,241,.24);
      color:rgba(245,246,255,.96);
    }

    .badge-done{
      background:rgba(34,197,94,.16);
      border-color:rgba(34,197,94,.28);
      color:rgba(244,255,247,.98);
    }

    .badge-teacher{
      background:rgba(255,211,107,.16);
      border-color:rgba(255,211,107,.26);
      color:rgba(255,248,230,.98);
    }

    @media (max-width: 700px){
      .subtema-card{
        min-height: 235px;
        padding: 18px;
        border-radius: 22px;
      }

      .subtema-card-head{
        margin-bottom:14px;
      }

      .subtema-name{
        font-size:1.08rem;
        line-height:1.16;
      }

      .subtema-chip,
      .badge{
        font-size:.70rem;
        padding:7px 10px;
      }

      .subtema-arrow{
        font-size:1.08rem;
      }
    }
  `;
  document.head.appendChild(style);
}