function $(id) {
  return document.getElementById(id);
}

const params = new URLSearchParams(window.location.search);
const subtemaId = Number(params.get("subtemaId") || 0);
const subtemaNombre = params.get("subtema") || "Subtema";
const temaNombre = params.get("tema") || "";
const gradoId = params.get("gradoId");

const teacherMode = window.isTeacher?.() === true;

window.requireSession?.(gradoId);
window.requireGrade?.(gradoId);

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizarRespuesta(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ======================================================
// FORMATO MATEMATICO VISUAL
// ======================================================
function toSuperscript(text) {
  const map = {
    "0": "⁰",
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹",
    "-": "⁻",
    "+": "⁺",
    "(": "⁽",
    ")": "⁾",
    "n": "ⁿ",
  };

  return String(text || "")
    .split("")
    .map((ch) => map[ch] || ch)
    .join("");
}

function formatearExpresionMatematica(texto) {
  let s = String(texto ?? "");
  s = s.replace(/(\d+)\^([0-9()+-]+)/g, (_, base, exp) => {
    return `${base}${toSuperscript(exp)}`;
  });
  return s;
}

const tituloEl = $("titulo-subtema");
if (tituloEl) {
  tituloEl.innerHTML = `
    <div class="page-title-stack">
      <span class="page-kicker">${teacherMode ? "Subtema activo · Profesor" : "Subtema activo"}</span>
      <span>${escapeHtml(formatearExpresionMatematica(subtemaNombre))}</span>
    </div>
  `;
}

// ======================================================
// HELPERS DE REQUEST
// ======================================================
async function fetchSafe(url, useAuth = true) {
  if (useAuth && typeof window.fetchAuth === "function") {
    return window.fetchAuth(url, {}, gradoId);
  }
  return fetch(url, { cache: "no-store" });
}

function isMissingSubtema() {
  return !subtemaId || Number.isNaN(subtemaId);
}

// ======================================================
// VIDEO
// ======================================================
let cachedVideoData = null;
let videoChecked = false;

async function detectarVideoIntro() {
  if (isMissingSubtema()) return null;
  if (videoChecked) return cachedVideoData;
  videoChecked = true;

  try {
    const res = await fetch(`/api/videos/${encodeURIComponent(subtemaId)}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      cachedVideoData = null;
      return null;
    }

    const payload = await res.json();
    cachedVideoData = payload?.video || null;
    return cachedVideoData;
  } catch (e) {
    console.warn("No se pudo cargar el video del subtema:", e);
    cachedVideoData = null;
    return null;
  }
}

function renderVideoCard(videoData) {
  if (!videoData || !videoData.url) return "";

  return `
    <div class="cardbox intro-video-card">
      <h2>🎬 ${escapeHtml(formatearExpresionMatematica(videoData.titulo || "Explicación en video"))}</h2>
      <p class="meta">
        ${escapeHtml(
          videoData.descripcion ||
            (teacherMode
              ? "Modo profesor: usa este video como apoyo visual en clase."
              : "Refuerza este subtema con una explicación visual antes de seguir.")
        )}
      </p>

      <div class="intro-video-wrap">
        <video controls playsinline preload="metadata" class="intro-video-player">
          <source src="${videoData.url}" type="video/mp4">
          Tu navegador no pudo cargar el video.
        </video>
      </div>
    </div>
  `;
}

function ensureStatsWidgetStyles() {
  if (document.getElementById("stats-widget-style")) return;

  const style = document.createElement("style");
  style.id = "stats-widget-style";
  style.textContent = `
    .stats-widget{
      margin-top:16px;
      padding:16px;
      border-radius:18px;
      background:rgba(255,255,255,.06);
      border:1px solid rgba(255,255,255,.10);
    }

    .stats-widget h4{
      margin:0 0 10px;
      font-size:1rem;
      font-weight:900;
      color:#fff;
    }

    .stats-widget p{
      margin:0 0 10px;
    }

    .stats-widget textarea{
      width:100%;
      min-height:90px;
      border-radius:14px;
      padding:12px;
      border:1px solid rgba(255,255,255,.12);
      background:rgba(8,16,24,.55);
      color:#fff;
      resize:vertical;
      outline:none;
      margin-bottom:12px;
    }

    .stats-widget .stats-actions{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      margin-bottom:14px;
    }

    .stats-widget .stats-btn{
      border:none;
      border-radius:12px;
      padding:10px 14px;
      font-weight:800;
      cursor:pointer;
      background:rgba(59,130,246,.22);
      color:#fff;
      border:1px solid rgba(59,130,246,.28);
    }

    .stats-widget .stats-btn:hover{
      transform:translateY(-1px);
    }

    .stats-widget table{
      width:100%;
      border-collapse:collapse;
      margin-top:10px;
      overflow:hidden;
      border-radius:14px;
      background:rgba(255,255,255,.05);
    }

    .stats-widget th,
    .stats-widget td{
      border:1px solid rgba(255,255,255,.10);
      padding:8px 10px;
      text-align:left;
      font-size:.95rem;
    }

    .stats-widget th{
      background:rgba(255,255,255,.08);
      font-weight:900;
    }

    .stats-widget .stats-mini{
      font-size:.88rem;
      opacity:.88;
      margin-top:8px;
    }

    .stats-widget .stats-data-box{
      border-radius:14px;
      padding:12px;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08);
      margin-bottom:12px;
      line-height:1.5;
    }

    .stats-widget .stats-chart-wrap{
      margin-top:14px;
      padding:12px;
      border-radius:16px;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08);
      overflow:auto;
    }

    .stats-widget .stats-empty{
      opacity:.8;
      font-style:italic;
    }
  `;
  document.head.appendChild(style);
}

function parseStatsItems(raw) {
  return String(raw || "")
    .split(/[\n,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function contarStats(items) {
  const mapa = new Map();

  items.forEach((item) => {
    const raw = String(item || "").trim();
    if (!raw) return;

    const key = raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (!mapa.has(key)) {
      mapa.set(key, { categoria: raw, frecuencia: 0 });
    }

    mapa.get(key).frecuencia++;
  });

  return Array.from(mapa.values()).sort(
    (a, b) => b.frecuencia - a.frecuencia || a.categoria.localeCompare(b.categoria, "es")
  );
}

function formatPercent(value) {
  return `${(value * 100).toFixed(0)}%`;
}

function buildStatsTable(rows, { relative = false, cumulative = false } = {}) {
  if (!rows.length) {
    return `<p class="stats-empty">Aún no hay datos para mostrar.</p>`;
  }

  const total = rows.reduce((acc, r) => acc + r.frecuencia, 0);
  let acumulada = 0;

  const enriched = rows.map((r) => {
    acumulada += r.frecuencia;
    const rel = total ? r.frecuencia / total : 0;
    return {
      ...r,
      acumulada,
      relativa: rel,
      porcentaje: `${(rel * 100).toFixed(0)}%`
    };
  });

  return `
    <table>
      <thead>
        <tr>
          <th>Categoría</th>
<th>Frecuencia absoluta</th>
${cumulative ? "<th>Frecuencia acumulada</th>" : ""}
${relative ? "<th>Frecuencia relativa</th><th>Porcentaje</th>" : ""}
        </tr>
      </thead>
      <tbody>
        ${enriched
          .map(
            (r) => `
              <tr>
                <td>${escapeHtml(r.categoria)}</td>
                <td>${r.frecuencia}</td>
                ${cumulative ? `<td>${r.acumulada}</td>` : ""}
                ${relative ? `<td>${r.relativa.toFixed(2)}</td><td>${r.porcentaje}</td>` : ""}
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
    <p class="stats-mini"><b>Total de datos:</b> ${total}</p>
  `;
}

function buildBarChartSvg(rows, opts = {}) {
  if (!rows.length) {
    return `<p class="stats-empty">Aún no hay datos para graficar.</p>`;
  }

  const width = 760;
  const height = 360;
  const margin = { top: 24, right: 20, bottom: 100, left: 70 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(...rows.map((r) => r.frecuencia), 1);
  const xLabel = opts.xLabel || "Categorías";
  const yLabel = opts.yLabel || "Frecuencia";

  const barGap = 18;
  const barWidth = Math.max(36, (chartWidth - (rows.length - 1) * barGap) / rows.length);

  const yTicks = [];
  for (let i = 0; i <= maxValue; i++) {
    const y = margin.top + chartHeight - (i / maxValue) * chartHeight;
    yTicks.push(`
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="rgba(255,255,255,0.08)" />
      <text x="${margin.left - 10}" y="${y + 4}" font-size="12" text-anchor="end" fill="rgba(255,255,255,0.88)">${i}</text>
    `);
  }

  const bars = rows
    .map((r, index) => {
      const barHeight = (r.frecuencia / maxValue) * chartHeight;
      const x = margin.left + index * (barWidth + barGap);
      const y = margin.top + chartHeight - barHeight;
      const labelX = x + barWidth / 2;

      return `
        <rect
          x="${x}"
          y="${y}"
          width="${barWidth}"
          height="${barHeight}"
          rx="8"
          fill="rgba(59,130,246,0.78)"
          stroke="rgba(255,255,255,0.18)"
        />
        <text x="${labelX}" y="${y - 8}" font-size="12" text-anchor="middle" fill="#fff">${r.frecuencia}</text>
        <text x="${labelX}" y="${height - 54}" font-size="12" text-anchor="middle" fill="rgba(255,255,255,0.92)">
          ${escapeHtml(r.categoria)}
        </text>
      `;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="340" aria-label="Gráfico de barras">
      ${yTicks.join("")}

      <line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${width - margin.right}" y2="${margin.top + chartHeight}" stroke="rgba(255,255,255,0.92)" stroke-width="2" />
      <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartHeight}" stroke="rgba(255,255,255,0.92)" stroke-width="2" />

      <text x="${width / 2}" y="${height - 16}" font-size="13" text-anchor="middle" fill="rgba(255,255,255,0.94)">
        ${escapeHtml(xLabel)}
      </text>

      <text x="18" y="${height / 2}" font-size="13" text-anchor="middle" fill="rgba(255,255,255,0.94)"
        transform="rotate(-90 18 ${height / 2})">
        ${escapeHtml(yLabel)}
      </text>

      ${bars}
    </svg>
  `;
}
function renderWidgetBase(title, inner) {
  return `
    <div class="stats-widget">
      <h4>${title}</h4>
      ${inner}
    </div>
  `;
}

function hydrateWidgetRecoleccion(el) {
  const defaultData = el.dataset.default || "";
  el.innerHTML = renderWidgetBase(
    "Explora tus propios datos",
    `
      <p>Escribe datos separados por coma o por salto de línea.</p>
      <textarea>${escapeHtml(defaultData)}</textarea>
      <div class="stats-actions">
        <button class="stats-btn" data-action="procesar">Organizar datos</button>
      </div>
      <div class="stats-output"></div>
    `
  );

  const textarea = el.querySelector("textarea");
  const output = el.querySelector(".stats-output");
  const button = el.querySelector('[data-action="procesar"]');

  function render() {
    const items = parseStatsItems(textarea.value);
    const rows = contarStats(items);

    output.innerHTML = `
      <div class="stats-data-box">
        <b>Datos ingresados:</b><br>
        ${items.length ? items.map(escapeHtml).join(", ") : "Sin datos"}
      </div>
      ${buildStatsTable(rows)}
    `;
  }

  button.addEventListener("click", render);
  render();
}

function hydrateWidgetFrecuencias(el, opts = {}) {
  const defaultData = el.dataset.default || "";
  el.innerHTML = renderWidgetBase(
    opts.relative ? "Tabla de frecuencias con proporciones" : "Tabla de frecuencias",
    `
      <p>Modifica los datos y genera la tabla automáticamente.</p>
      <textarea>${escapeHtml(defaultData)}</textarea>
      <div class="stats-actions">
        <button class="stats-btn" data-action="procesar">Generar tabla</button>
      </div>
      <div class="stats-output"></div>
    `
  );

  const textarea = el.querySelector("textarea");
  const output = el.querySelector(".stats-output");
  const button = el.querySelector('[data-action="procesar"]');

  function render() {
    const items = parseStatsItems(textarea.value);
    const rows = contarStats(items);
    output.innerHTML = buildStatsTable(rows, { relative: !!opts.relative });
  }

  button.addEventListener("click", render);
  render();
}

function hydrateWidgetGrafico(el) {
  const defaultData = el.dataset.default || "";
  el.innerHTML = renderWidgetBase(
    "Construcción dinámica del gráfico de barras",
    `
      <p>Escribe categorías repetidas. La gráfica se construirá con sus frecuencias.</p>
      <textarea>${escapeHtml(defaultData)}</textarea>
      <div class="stats-actions">
        <button class="stats-btn" data-action="procesar">Actualizar gráfica</button>
      </div>
      <div class="stats-output"></div>
    `
  );

  const textarea = el.querySelector("textarea");
  const output = el.querySelector(".stats-output");
  const button = el.querySelector('[data-action="procesar"]');

  function render() {
    const items = parseStatsItems(textarea.value);
    const rows = contarStats(items);

    output.innerHTML = `
      ${buildStatsTable(rows)}
      <div class="stats-chart-wrap">
        ${buildBarChartSvg(rows)}
      </div>
    `;
  }

  button.addEventListener("click", render);
  render();
}

function hydrateWidgetTablaAcumulada(el) {
  const defaultData = el.dataset.default || "";
  el.innerHTML = renderWidgetBase(
  "Frecuencia absoluta, relativa, acumulada y porcentaje",
    `
      <p>Escribe datos separados por coma. La herramienta calculará frecuencia, acumulada y porcentaje.</p>
      <textarea>${escapeHtml(defaultData)}</textarea>
      <div class="stats-actions">
        <button class="stats-btn" data-action="procesar">Calcular tabla</button>
      </div>
      <div class="stats-output"></div>
    `
  );

  const textarea = el.querySelector("textarea");
  const output = el.querySelector(".stats-output");
  const button = el.querySelector('[data-action="procesar"]');

  function render() {
    const items = parseStatsItems(textarea.value);
    const rows = contarStats(items);
    output.innerHTML = buildStatsTable(rows, { relative: true, cumulative: true });
  }

  button.addEventListener("click", render);
  render();
}

function hydrateWidgetGraficoInteractivo(el) {
  const defaultData = el.dataset.default || "";
  const xLabel = el.dataset.xlabel || "Categorías";
  const yLabel = el.dataset.ylabel || "Frecuencia";

  el.innerHTML = renderWidgetBase(
    "Construye el gráfico de barras",
    `
      <p>Modifica los datos y observa cómo cambian tabla y gráfico en un plano cartesiano simple.</p>
      <textarea>${escapeHtml(defaultData)}</textarea>
      <div class="stats-actions">
        <button class="stats-btn" data-action="procesar">Actualizar gráfico</button>
      </div>
      <div class="stats-output"></div>
    `
  );

  const textarea = el.querySelector("textarea");
  const output = el.querySelector(".stats-output");
  const button = el.querySelector('[data-action="procesar"]');

  function render() {
    const items = parseStatsItems(textarea.value);
    const rows = contarStats(items);

    output.innerHTML = `
      ${buildStatsTable(rows)}
      <div class="stats-chart-wrap">
        ${buildBarChartSvg(rows, { xLabel, yLabel })}
      </div>
    `;
  }

  button.addEventListener("click", render);
  render();
}

function hydrateIntroWidgets(container) {
  if (!container) return;

  container.querySelectorAll("[data-widget]").forEach((el) => {
    const type = el.dataset.widget;

    if (type === "recoleccion") {
      hydrateWidgetRecoleccion(el);
      return;
    }

    if (type === "frecuencias") {
      hydrateWidgetFrecuencias(el, { relative: false });
      return;
    }

    if (type === "frecuencias-relativas") {
  hydrateWidgetTablaAcumulada(el);
  return;
}
    if (type === "tabla-acumulada") {
      hydrateWidgetTablaAcumulada(el);
      return;
    }

    if (type === "grafico-barras") {
      hydrateWidgetGrafico(el);
      return;
    }

    if (type === "grafico-barras-interactivo") {
      hydrateWidgetGraficoInteractivo(el);
      return;
    }
  });
}

// ======================================================
// MODAL
// ======================================================
function ensureStudentModal() {
  if (document.getElementById("student-modal-overlay")) return;

  const style = document.createElement("style");
  style.id = "student-modal-style";
  style.textContent = `
    .student-modal-overlay{
      position:fixed;
      inset:0;
      background:rgba(0,0,0,.58);
      display:none;
      align-items:center;
      justify-content:center;
      z-index:9999;
      padding:20px;
    }
    .student-modal-overlay.show{ display:flex; }
    .student-modal{
      width:min(560px, 96vw);
      border-radius:24px;
      padding:24px;
      background:linear-gradient(180deg, rgba(22,32,45,.97), rgba(13,22,33,.97));
      border:1px solid rgba(255,255,255,.12);
      box-shadow:0 30px 80px rgba(0,0,0,.45);
      color:#fff;
      text-align:center;
    }
    .student-modal-emoji{
      font-size:3rem;
      line-height:1;
      margin-bottom:12px;
    }
    .student-modal h3{
      margin:0 0 8px;
      font-size:1.6rem;
      font-weight:900;
    }
    .student-modal p{
      margin:0;
      font-size:1rem;
      opacity:.92;
      line-height:1.55;
      white-space:pre-line;
    }
    .student-modal-actions{
      margin-top:18px;
      display:flex;
      justify-content:center;
    }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.id = "student-modal-overlay";
  overlay.className = "student-modal-overlay";
  overlay.innerHTML = `
    <div class="student-modal">
      <div class="student-modal-emoji" id="student-modal-emoji">✨</div>
      <h3 id="student-modal-title">Mensaje</h3>
      <p id="student-modal-message">Texto</p>
      <div class="student-modal-actions">
        <button id="student-modal-btn" class="btn btn-primary">Aceptar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  $("student-modal-btn").addEventListener("click", () => {
    overlay.classList.remove("show");
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.remove("show");
  });
}

function showStudentModal(kind, title, message) {
  ensureStudentModal();

  const emojiMap = {
    success: "🎉",
    warning: "⚠️",
    error: "❌",
    info: "📘",
    practice: "🧠",
    quiz: "📝",
    workshop: "🧩",
    teacher: "👩‍🏫",
    game: "🎮",
  };

  $("student-modal-emoji").textContent = emojiMap[kind] || "✨";
  $("student-modal-title").textContent = title || "Mensaje";
  $("student-modal-message").textContent = message || "";
  $("student-modal-overlay").classList.add("show");
}

// ======================================================
// TABS
// ======================================================
const tabs = document.querySelectorAll(".tab");
const views = {
  intro: $("tab-intro"),
  practica: $("tab-practica"),
  taller: $("tab-taller"),
  quiz: $("tab-quiz"),
  juego: $("tab-juego"),
};

function showEmpty(containerId, text) {
  const cont = $(containerId);
  if (!cont) return;
  cont.innerHTML = `<div class="empty-box">${text}</div>`;
}

function disableTab(tabKey, message) {
  const btn = document.querySelector(`.tab[data-tab="${tabKey}"]`);
  const view = document.getElementById(`tab-${tabKey}`);

  if (btn) {
    btn.classList.add("disabled");
    btn.setAttribute("aria-disabled", "true");
    btn.title = message || "No disponible";
  }

  if (view) {
    view.innerHTML = `<div class="empty-box">${message || "Aún no hay contenido disponible."}</div>`;
  }
}

function enableTab(tabKey) {
  const btn = document.querySelector(`.tab[data-tab="${tabKey}"]`);
  if (btn) {
    btn.classList.remove("disabled");
    btn.removeAttribute("aria-disabled");
    btn.title = "";
  }
}

async function activateTab(key) {
  const btn = document.querySelector(`.tab[data-tab="${key}"]`);
  if (btn && btn.classList.contains("disabled")) return;

  tabs.forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  Object.values(views).forEach((v) => v && v.classList.remove("active"));
  if (views[key]) views[key].classList.add("active");

  if (key === "intro") await cargarIntro();
  if (key === "practica") await cargarPractica();
  if (key === "taller") await cargarTallerEvaluable();
  if (key === "quiz") await cargarQuiz();
  if (key === "juego") await cargarJuego();
}

tabs.forEach((btn) => {
  btn.addEventListener("click", async () => {
    const key = btn.dataset.tab;
    await activateTab(key);
  });
});

// ======================================================
// ESTADO EVALUACIONES
// ======================================================
let estadoEvaluaciones = {
  quiz_entregado: false,
  taller_entregado: false,
  quiz: null,
  taller: null,
};

async function cargarEstadoEvaluaciones() {
  if (isMissingSubtema()) return;

  try {
    const res = await fetchSafe(
      `/api/evaluaciones/estado/${encodeURIComponent(subtemaId)}`,
      true
    );
    if (!res.ok) throw new Error("No se pudo leer el estado");
    estadoEvaluaciones = await res.json();
  } catch {
    estadoEvaluaciones = {
      quiz_entregado: false,
      taller_entregado: false,
      quiz: null,
      taller: null,
    };
  }
}

// ======================================================
// INTRO
// ======================================================
let introCargada = false;

async function cargarIntro() {
  if (introCargada) return;
  if (isMissingSubtema()) {
    showEmpty("intro-container", "❌ No se encontró el subtema.");
    return;
  }

  introCargada = true;

  const cont = $("intro-container");
  if (!cont) return;

  cont.innerHTML = "Cargando...";

  try {
    const [introRes, videoData] = await Promise.all([
      fetchSafe(`/api/intro/${encodeURIComponent(subtemaId)}`, true),
      detectarVideoIntro(),
    ]);

    if (introRes.status === 403) {
      showEmpty("intro-container", "🔒 Este subtema aún no está disponible.");
      return;
    }

    if (!introRes.ok) throw new Error("Intro no ok");

    const rawData = await introRes.json();
    const data = Array.isArray(rawData) ? rawData : [];

    // solo registros del subtema actual
    const dataSubtema = data.filter(
      (x) => Number(x.subtema_id) === Number(subtemaId)
    );

    // quitar bloque basura tipo "Introducción / Contenido en construcción"
    const dataLimpia = dataSubtema.filter((x) => {
      const titulo = String(x.titulo || "").toLowerCase();
      const html = String(x.html || "").toLowerCase();

      return !(
        titulo.includes("introducción") &&
        html.includes("contenido en construcción")
      );
    });

    // separar tarjetas de texto y widgets
    const tarjetasTexto = [];
    const widgets = [];

    for (const item of dataLimpia) {
      const html = String(item.html || "");

      if (html.includes('data-widget=')) {
        widgets.push(item);
      } else {
        tarjetasTexto.push(item);
      }
    }

    // dejar solo 1 tarjeta de texto para evitar repetición
    const tarjetasTextoFinal = tarjetasTexto.slice(0, 1);

    // dejar todos los widgets
    const dataFinal = [...tarjetasTextoFinal, ...widgets];

    const bloquesIntro = dataFinal
      .map(
        (x) => `
          <div class="cardbox">
            <h2>${escapeHtml(formatearExpresionMatematica(x.titulo || ""))}</h2>
            <div class="rich">${x.html || ""}</div>
          </div>
        `
      )
      .join("");

    const bloqueVideo = renderVideoCard(videoData);

    if (!bloquesIntro && !bloqueVideo) {
      showEmpty("intro-container", "Aún no hay introducción para este subtema.");
      return;
    }

    cont.innerHTML = `
      ${bloquesIntro}
      ${bloqueVideo}
    `;

    ensureStatsWidgetStyles();
    hydrateIntroWidgets(cont);

    // if (typeof window.initIntroWidgets === "function") {
    //   window.initIntroWidgets(cont);
    // }

  } catch (e) {
    console.error("Error cargando intro:", e);

    const videoData = await detectarVideoIntro();
    const bloqueVideo = renderVideoCard(videoData);

    if (bloqueVideo) {
      cont.innerHTML = bloqueVideo;
      return;
    }

    showEmpty("intro-container", "❌ Error cargando introducción.");
  }
}

// ======================================================
// JUEGO
// ======================================================
let gameLoaded = false;
let gameData = null;
let gameState = {
  deck: [],
  first: null,
  second: null,
  lock: false,
  matched: 0,
  moves: 0,
  currentTeam: 1,
  team1: 0,
  team2: 0,
  finished: false,
};

async function detectarJuego() {
  if (isMissingSubtema()) return null;

  try {
    const res = await fetch(`/api/juegos/${encodeURIComponent(subtemaId)}`, {
      cache: "no-store",
    });

    if (!res.ok) return null;

    const juego = await res.json();
    return juego || null;
  } catch (e) {
    console.warn("Error detectando juego:", e);
    return null;
  }
}

function renderGameLayout(titulo, descripcion) {
  return `
    <div class="group-game-shell">
      <div class="cardbox">
        <div class="group-game-headline">
          <div>
            <h2>🎮 ${escapeHtml(formatearExpresionMatematica(titulo || "Juego grupal"))}</h2>
            <p class="group-game-help">
              ${escapeHtml(
                descripcion ||
                  "Salen dos estudiantes o dos equipos por turno. Si encuentran pareja correcta, suman punto."
              )}
            </p>
          </div>

          <div class="group-game-pill-row">
            <span class="group-game-pill">Parejas totales: <b id="gg-total-pairs">0</b></span>
            <span class="group-game-pill">Movimientos: <b id="gg-moves">0</b></span>
          </div>
        </div>
      </div>

      <div class="group-game-toolbar">
        <div class="group-game-pill-row">
          <button id="btn-reiniciar-juego" class="btn btn-primary">🔄 Reiniciar</button>
          <button id="btn-mezclar-juego" class="btn btn-ghost">🎲 Nuevas tarjetas</button>
          <button id="btn-cambiar-turno" class="btn btn-ghost">↔ Cambiar turno</button>
        </div>
      </div>

      <div class="group-game-turn-box" id="gg-turn-box">
        Turno actual: Equipo 1
      </div>

      <div class="group-game-teams">
        <div class="group-game-team active" id="gg-team-1">
          <h3>Equipo 1</h3>
          <p>Parejas encontradas</p>
          <div class="group-game-team-score" id="gg-score-1">0</div>
        </div>

        <div class="group-game-team" id="gg-team-2">
          <h3>Equipo 2</h3>
          <p>Parejas encontradas</p>
          <div class="group-game-team-score" id="gg-score-2">0</div>
        </div>
      </div>

      <div class="cardbox">
        <div class="group-game-grid" id="group-game-grid"></div>
      </div>
    </div>
  `;
}

function buildDeckFromApiGame(juego) {
  const items = [];

  (juego.items || []).forEach((p, i) => {
    items.push({
      id: `pair-${i}-a`,
      pairId: `pair-${i}`,
      text: p.a,
      revealed: false,
      matched: false,
    });
    items.push({
      id: `pair-${i}-b`,
      pairId: `pair-${i}`,
      text: p.b,
      revealed: false,
      matched: false,
    });
  });

  return shuffleArray(items);
}

function updateGameHud() {
  const totalPairs = gameState.deck.length / 2;

  const totalPairsEl = $("gg-total-pairs");
  const movesEl = $("gg-moves");
  const score1El = $("gg-score-1");
  const score2El = $("gg-score-2");
  const turnBox = $("gg-turn-box");
  const team1Box = $("gg-team-1");
  const team2Box = $("gg-team-2");

  if (totalPairsEl) totalPairsEl.textContent = String(totalPairs);
  if (movesEl) movesEl.textContent = String(gameState.moves);
  if (score1El) score1El.textContent = String(gameState.team1);
  if (score2El) score2El.textContent = String(gameState.team2);

  if (turnBox) {
    turnBox.textContent = gameState.finished
      ? "Juego finalizado"
      : `Turno actual: Equipo ${gameState.currentTeam}`;
  }

  if (team1Box) team1Box.classList.toggle("active", !gameState.finished && gameState.currentTeam === 1);
  if (team2Box) team2Box.classList.toggle("active", !gameState.finished && gameState.currentTeam === 2);
}

function renderGameBoard() {
  const grid = $("group-game-grid");
  if (!grid) return;

  updateGameHud();

  grid.innerHTML = gameState.deck
    .map((card, index) => {
      const visible = card.revealed || card.matched;
      return `
        <button
          class="group-game-tile ${visible ? "is-open" : ""} ${card.matched ? "is-matched" : ""}"
          data-index="${index}"
          ${gameState.finished ? "disabled" : ""}
        >
          <span class="group-game-face group-game-front">?</span>
          <span class="group-game-face group-game-back">${escapeHtml(formatearExpresionMatematica(card.text))}</span>
        </button>
      `;
    })
    .join("");

  grid.querySelectorAll(".group-game-tile").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.getAttribute("data-index"));
      onGameCardClick(index);
    });
  });
}

function onGameCardClick(index) {
  if (gameState.lock || gameState.finished) return;

  const card = gameState.deck[index];
  if (!card || card.matched || card.revealed) return;

  card.revealed = true;

  if (gameState.first == null) {
    gameState.first = index;
    renderGameBoard();
    return;
  }

  if (gameState.second == null) {
    gameState.second = index;
    gameState.moves++;
    renderGameBoard();

    const firstCard = gameState.deck[gameState.first];
    const secondCard = gameState.deck[gameState.second];

    if (firstCard.pairId === secondCard.pairId) {
      firstCard.matched = true;
      secondCard.matched = true;
      gameState.matched++;

      if (gameState.currentTeam === 1) {
        gameState.team1++;
      } else {
        gameState.team2++;
      }

      gameState.first = null;
      gameState.second = null;
      renderGameBoard();

      if (gameState.matched === gameState.deck.length / 2) {
        gameState.finished = true;
        renderGameBoard();

        let mensaje = "";
        if (gameState.team1 > gameState.team2) {
          mensaje = `Ganó el Equipo 1 con ${gameState.team1} parejas.`;
        } else if (gameState.team2 > gameState.team1) {
          mensaje = `Ganó el Equipo 2 con ${gameState.team2} parejas.`;
        } else {
          mensaje = `Empate: ${gameState.team1} a ${gameState.team2}.`;
        }

        setTimeout(() => {
          showStudentModal(
            "game",
            "¡Juego completado!",
            `${mensaje}\nMovimientos: ${gameState.moves}\nPuedes reiniciar para que pase otro grupo.`
          );
        }, 250);
      }

      return;
    }

    gameState.lock = true;

    setTimeout(() => {
      firstCard.revealed = false;
      secondCard.revealed = false;
      gameState.first = null;
      gameState.second = null;
      gameState.lock = false;
      gameState.currentTeam = gameState.currentTeam === 1 ? 2 : 1;
      renderGameBoard();
    }, 900);
  }
}

function mountGameFromApi(juego) {
  const container = $("juego-container");
  if (!container) return;

  gameData = juego;

  container.innerHTML = renderGameLayout(juego.titulo, juego.descripcion);

  gameState.deck = buildDeckFromApiGame(juego);
  gameState.first = null;
  gameState.second = null;
  gameState.lock = false;
  gameState.matched = 0;
  gameState.moves = 0;
  gameState.currentTeam = 1;
  gameState.team1 = 0;
  gameState.team2 = 0;
  gameState.finished = false;

  renderGameBoard();

  $("btn-reiniciar-juego")?.addEventListener("click", () => {
    mountGameFromApi(gameData);
  });

  $("btn-mezclar-juego")?.addEventListener("click", () => {
    mountGameFromApi(gameData);
  });

  $("btn-cambiar-turno")?.addEventListener("click", () => {
    if (gameState.finished) return;
    gameState.currentTeam = gameState.currentTeam === 1 ? 2 : 1;
    updateGameHud();
  });

  gameLoaded = true;
}

async function cargarJuego() {
  const container = $("juego-container");
  if (!container) return;

  if (gameLoaded) return;
  if (isMissingSubtema()) {
    container.innerHTML = `<div class="empty-box">❌ No se encontró el subtema.</div>`;
    return;
  }

  container.innerHTML = "Cargando juego...";

  try {
    const juego = await detectarJuego();

    if (!juego) {
      container.innerHTML = `
        <div class="empty-box">
          🎮 Aún no hay juego para este subtema.
        </div>
      `;
      return;
    }

    if (juego.tipo === "parejas") {
      mountGameFromApi(juego);
      return;
    }

    container.innerHTML = `
      <div class="empty-box">
        🎮 El tipo de juego configurado todavía no está soportado.
      </div>
    `;
  } catch (err) {
    console.error("Error cargando juego:", err);
    container.innerHTML = `
      <div class="empty-box">
        ❌ Error cargando juego.
      </div>
    `;
  }
}

// ======================================================
// TALLER
// ======================================================
const btnTaller = $("btn-cargar-taller");
const tallerMeta = $("taller-meta");
const tallerCont = $("taller-container");
let tallerActual = [];

if (btnTaller) {
  btnTaller.addEventListener("click", cargarTallerEvaluable);
}

function renderNotaCard(tipo, data) {
  if (!data) return "";
  return `
    <div class="cardbox" style="border:1px solid rgba(61,214,198,.28)">
      <h2>${tipo === "taller" ? "🧩 Resultado del taller" : "📝 Resultado del quiz"}</h2>
      <p class="meta">Aciertos: <b>${data.correctas}/${data.total}</b></p>
      <p class="meta">Calificación final: <b>${data.nota} / 5.0</b></p>
    </div>
  `;
}

let tallerCache = null;

function setTallerButtonLabel(info) {
  if (!btnTaller) return;

  if (info?.hasDynamic) {
    btnTaller.textContent = teacherMode
      ? "Generar taller aleatorio"
      : (estadoEvaluaciones.taller_entregado ? "Ver resultado del taller" : "Generar taller aleatorio");
    return;
  }

  if (info?.hasFixed) {
    btnTaller.textContent = "Ver talleres del subtema";
    return;
  }

  btnTaller.textContent = "Taller no disponible";
}

function renderTalleresFijosHTML(talleres) {
  return talleres.map((t, idx) => `
    <div class="cardbox">
      <h2>🧩 ${escapeHtml(formatearExpresionMatematica(t.titulo || `Taller ${idx + 1}`))}</h2>
      <div class="rich">${t.enunciado || ""}</div>
      ${
        teacherMode && t.solucion
          ? `
            <hr style="margin:16px 0;border:none;border-top:1px solid rgba(255,255,255,.12);">
            <h3>✅ Solución sugerida</h3>
            <div class="rich">${t.solucion}</div>
          `
          : ""
      }
    </div>
  `).join("");
}

function renderTalleresFijos(talleres, extraTop = "") {
  if (!tallerCont) return;

  if (tallerMeta) {
    tallerMeta.textContent = `${talleres.length} actividad(es) disponibles`;
  }

  tallerCont.innerHTML = `
    ${extraTop}
    ${renderTalleresFijosHTML(talleres)}
  `;
}

async function resolverDisponibilidadTaller(force = false) {
  if (tallerCache && !force) return tallerCache;

  const result = {
    blocked: false,
    hasDynamic: false,
    hasFixed: false,
    fixedItems: [],
    dynamicLocked: false,
  };

  const [fixedRes, dynamicRes] = await Promise.all([
    fetchSafe(`/api/talleres/${encodeURIComponent(subtemaId)}`, true).catch(() => null),
    fetchSafe(`/api/taller/generar/${encodeURIComponent(subtemaId)}?count=3`, true).catch(() => null),
  ]);

  if (fixedRes) {
    if (fixedRes.status === 403) {
      result.blocked = true;
    } else if (fixedRes.ok) {
      const data = await fixedRes.json().catch(() => []);
      result.fixedItems = Array.isArray(data) ? data : [];
      result.hasFixed = result.fixedItems.length > 0;
    }
  }

  if (dynamicRes) {
    if (dynamicRes.status === 403) {
      result.blocked = true;
    } else if (dynamicRes.status === 409) {
      result.hasDynamic = true;
      result.dynamicLocked = true;
    } else if (dynamicRes.ok) {
      const data = await dynamicRes.json().catch(() => ({}));
      result.hasDynamic = Array.isArray(data?.preguntas) && data.preguntas.length > 0;
    }
  }

  tallerCache = result;
  setTallerButtonLabel(result);
  return result;
}

async function cargarTallerEvaluable() {
  if (!tallerCont) return;

  if (isMissingSubtema()) {
    tallerCont.innerHTML = `<div class="empty-box">❌ No se encontró el subtema.</div>`;
    return;
  }

  tallerCont.innerHTML = "Cargando taller...";

  const info = await resolverDisponibilidadTaller(true);

  if (info.blocked) {
    tallerCont.innerHTML = `<div class="empty-box">🔒 Este subtema aún no está disponible.</div>`;
    if (tallerMeta) tallerMeta.textContent = "";
    return;
  }

  // Si NO hay taller dinámico pero sí hay talleres fijos, mostramos los fijos
  if (!info.hasDynamic && info.hasFixed) {
    renderTalleresFijos(
      info.fixedItems,
      `
      <div class="cardbox">
        <h2>🧩 Taller del subtema</h2>
        <p class="meta">
          Este subtema no tiene generador aleatorio activo en este momento,
          pero sí cuenta con actividades fijas de trabajo y refuerzo.
        </p>
      </div>
      `
    );
    return;
  }

  // Si no hay nada
  if (!info.hasDynamic && !info.hasFixed) {
    tallerCont.innerHTML = `<div class="empty-box">Aún no hay taller para este subtema.</div>`;
    if (tallerMeta) tallerMeta.textContent = "";
    return;
  }

  // Si el estudiante ya entregó el taller dinámico
  if (!teacherMode && estadoEvaluaciones.taller_entregado && estadoEvaluaciones.taller) {
    const t = estadoEvaluaciones.taller;

    const apoyoHtml = info.hasFixed
      ? `
        <div class="cardbox">
          <h2>📚 Talleres de apoyo</h2>
          <p class="meta">Además del taller ya entregado, este subtema incluye actividades fijas de refuerzo.</p>
        </div>
        ${renderTalleresFijosHTML(info.fixedItems)}
      `
      : "";

    tallerCont.innerHTML = `
      ${renderNotaCard("taller", t)}
      <div class="cardbox">
        <p class="meta">Ya enviaste este taller. No puedes volver a presentarlo.</p>
      </div>
      ${apoyoHtml}
    `;

    if (tallerMeta) tallerMeta.textContent = "Taller ya entregado";
    if (btnTaller) btnTaller.disabled = false;
    return;
  }

  // Si hay generador dinámico, lo usamos como experiencia principal
  if (tallerMeta) {
    tallerMeta.textContent = teacherMode
      ? "Modo profesor · vista previa sin guardar nota"
      : "";
  }

  try {
    const res = await fetchSafe(
      `/api/taller/generar/${encodeURIComponent(subtemaId)}?count=10`,
      true
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (!teacherMode && res.status === 409) {
        await cargarEstadoEvaluaciones();
        return cargarTallerEvaluable();
      }

      // fallback a talleres fijos
      if (info.hasFixed) {
        renderTalleresFijos(
          info.fixedItems,
          `
          <div class="cardbox">
            <h2>🧩 Taller del subtema</h2>
            <p class="meta">
              El generador aleatorio no está disponible en este momento,
              pero sí puedes trabajar con los talleres fijos del subtema.
            </p>
          </div>
          `
        );
        return;
      }

      if (res.status === 403) {
        tallerCont.innerHTML = `<div class="empty-box">🔒 Este subtema aún no está disponible.</div>`;
        return;
      }

      throw new Error(data?.error || "No se pudo generar el taller");
    }

    tallerActual = Array.isArray(data.preguntas) ? data.preguntas : [];

    if (!tallerActual.length) {
      if (info.hasFixed) {
        renderTalleresFijos(
          info.fixedItems,
          `
          <div class="cardbox">
            <h2>🧩 Taller del subtema</h2>
            <p class="meta">No fue posible generar un taller aleatorio, así que se muestran las actividades fijas disponibles.</p>
          </div>
          `
        );
        return;
      }

      tallerCont.innerHTML = `<div class="empty-box">No fue posible generar el taller para este subtema.</div>`;
      return;
    }

    if (tallerMeta) {
      tallerMeta.textContent = teacherMode
        ? `${tallerActual.length} preguntas · modo profesor`
        : `${tallerActual.length} preguntas calificables`;
    }

    const apoyoHtml = info.hasFixed
      ? `
        <div class="cardbox">
          <h2>📚 Talleres de apoyo del subtema</h2>
          <p class="meta">
            Además del taller aleatorio, este subtema tiene actividades fijas para reforzar el aprendizaje.
          </p>
        </div>
        ${renderTalleresFijosHTML(info.fixedItems)}
      `
      : "";

    tallerCont.innerHTML = `
      <div class="cardbox">
        <h2>🧩 Taller evaluable</h2>
        <p class="meta">
          ${
            teacherMode
              ? `Modo profesor: responde, verifica y usa el taller en clase. <b>No se guarda nota.</b>`
              : `Responde cada situación y luego presiona <b>Entregar taller</b>. Este taller se califica automáticamente en escala de <b>1.0 a 5.0</b>.`
          }
        </p>
      </div>

      ${tallerActual
        .map(
          (q, idx) => `
        <div class="cardbox taller-q">
          <h3>${idx + 1}. ${escapeHtml(formatearExpresionMatematica(q.pregunta))}</h3>
          <input type="text" id="taller_in_${idx}" placeholder="Escribe tu respuesta">
        </div>
      `
        )
        .join("")}

      <div class="cardbox">
        <button id="btn-entregar-taller" class="btn btn-primary">
          ${teacherMode ? "Ver resultado del taller" : "Entregar taller"}
        </button>
        <p id="taller-resultado" class="meta" style="margin-top:12px;"></p>
      </div>

      ${apoyoHtml}
    `;

    const btnEntregar = $("btn-entregar-taller");
    if (btnEntregar) btnEntregar.addEventListener("click", entregarTaller);
  } catch (e) {
    console.error("Error generando taller:", e);

    if (info.hasFixed) {
      renderTalleresFijos(
        info.fixedItems,
        `
        <div class="cardbox">
          <h2>🧩 Taller del subtema</h2>
          <p class="meta">Ocurrió un error con el taller aleatorio, pero sí tienes disponibles los talleres fijos del subtema.</p>
        </div>
        `
      );
      return;
    }

    tallerCont.innerHTML = `<div class="empty-box">❌ Error generando taller.</div>`;
  }
}

async function entregarTaller() {
  if (!Array.isArray(tallerActual) || !tallerActual.length) return;

  let correctas = 0;
  const detalle = [];

  tallerActual.forEach((q, idx) => {
    const inp = $(`taller_in_${idx}`);
    const user = String(inp?.value || "").trim();
    const correcta = String(q.respuesta || "").trim();

    const ok = normalizarRespuesta(user) === normalizarRespuesta(correcta);
    if (ok) correctas++;

    detalle.push({
      pregunta: q.pregunta,
      usuario: user,
      correcta,
      ok,
    });
  });

  const total = tallerActual.length;

  if (teacherMode) {
    const nota = Number((1 + (correctas / total) * 4).toFixed(1));
    const out = $("taller-resultado");
    if (out) {
      out.innerHTML = `
        👩‍🏫 Vista profesor.<br>
        Aciertos: <b>${correctas}/${total}</b><br>
        Resultado estimado: <b>${nota} / 5.0</b>
      `;
    }

    showStudentModal(
      "teacher",
      "Resultado del taller",
      `Modo profesor\nAciertos: ${correctas} de ${total}\nResultado estimado: ${nota} / 5.0\nNo se guardó ninguna nota.`
    );
    return;
  }

  try {
    const res = await fetchSafe("/api/evaluaciones", false ? true : true);
    // Esta línea se sobrescribe abajo con fetchAuth real para mantener compatibilidad.
    void res;
  } catch {}

  try {
    const res = await window.fetchAuth(
      "/api/evaluaciones",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtema_id: Number(subtemaId),
          tipo: "taller",
          correctas,
          total,
          detalle,
        }),
      },
      gradoId
    );

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 409) {
        await cargarEstadoEvaluaciones();
        return cargarTallerEvaluable();
      }
      throw new Error(data?.error || "No se pudo guardar la nota");
    }

    const out = $("taller-resultado");
    if (out) {
      out.innerHTML = `
        ✅ Taller entregado correctamente.<br>
        Aciertos: <b>${data.correctas}/${data.total}</b><br>
        Calificación: <b>${data.nota} / 5.0</b>
      `;
    }

    await cargarEstadoEvaluaciones();
        if (btnTaller) btnTaller.disabled = false;

    let titulo = "Taller entregado";
    let tipo = "workshop";
    if (data.nota >= 4.5) {
      titulo = "¡Excelente taller!";
      tipo = "success";
    } else if (data.nota >= 3.0) {
      titulo = "¡Buen trabajo!";
      tipo = "workshop";
    } else {
      titulo = "Debes reforzar el tema";
      tipo = "warning";
    }

    showStudentModal(
      tipo,
      titulo,
      `Aciertos: ${data.correctas} de ${data.total}\nCalificación final: ${data.nota} / 5.0`
    );

    await cargarTallerEvaluable();
  } catch (e) {
    const out = $("taller-resultado");
    if (out) out.textContent = `❌ ${e.message}`;
    showStudentModal("error", "No se pudo entregar el taller", e.message);
  }
}

// ======================================================
// QUIZ
// ======================================================
const btnQuiz = $("btn-cargar-quiz");
const quizMeta = $("quiz-meta");
const quizCont = $("quiz-container");
let quizActual = [];

if (btnQuiz) {
  btnQuiz.addEventListener("click", cargarQuiz);
}

function renderQuizQuestion(q, idx) {
  if (q.tipo === "mcq" && Array.isArray(q.opciones)) {
    return `
      <div class="cardbox">
        <h3>${idx + 1}. ${escapeHtml(formatearExpresionMatematica(q.pregunta))}</h3>
        ${q.opciones
          .map(
            (op) => `
          <label style="display:block;margin:8px 0" class="meta">
            <input type="radio" name="quiz_${idx}" value="${escapeHtml(op)}"> ${escapeHtml(formatearExpresionMatematica(op))}
          </label>
        `
          )
          .join("")}
      </div>
    `;
  }

  if (q.tipo === "vf") {
    return `
      <div class="cardbox">
        <h3>${idx + 1}. ${escapeHtml(formatearExpresionMatematica(q.pregunta))}</h3>
        <label class="meta" style="display:block;margin:8px 0;">
          <input type="radio" name="quiz_${idx}" value="V"> Verdadero
        </label>
        <label class="meta" style="display:block;margin:8px 0;">
          <input type="radio" name="quiz_${idx}" value="F"> Falso
        </label>
      </div>
    `;
  }

  return `
    <div class="cardbox">
      <h3>${idx + 1}. ${escapeHtml(formatearExpresionMatematica(q.pregunta))}</h3>
      <input type="text" id="quiz_in_${idx}" placeholder="Escribe tu respuesta">
    </div>
  `;
}

async function cargarQuiz() {
  if (!quizCont) return;
  if (isMissingSubtema()) {
    quizCont.innerHTML = `<div class="empty-box">❌ No se encontró el subtema.</div>`;
    return;
  }

  if (!teacherMode && estadoEvaluaciones.quiz_entregado && estadoEvaluaciones.quiz) {
    const q = estadoEvaluaciones.quiz;

    quizCont.innerHTML = `
      ${renderNotaCard("quiz", q)}
      <div class="cardbox">
        <p class="meta">Ya enviaste este quiz. No puedes volver a presentarlo.</p>
      </div>
    `;
    if (quizMeta) quizMeta.textContent = "Quiz finalizado";
    if (btnQuiz) btnQuiz.disabled = true;
    return;
  }

  quizCont.innerHTML = "Cargando quiz...";
  if (quizMeta) {
    quizMeta.textContent = teacherMode
      ? "Modo profesor · vista previa sin guardar nota"
      : "";
  }

  try {
    const res = await fetchSafe(
      `/api/quiz/${encodeURIComponent(subtemaId)}?limit=5`,
      true
    );
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (!teacherMode && res.status === 409) {
        await cargarEstadoEvaluaciones();
        return cargarQuiz();
      }
      if (res.status === 403) {
        quizCont.innerHTML = `<div class="empty-box">🔒 Este subtema aún no está disponible.</div>`;
        return;
      }
      throw new Error(data?.error || "Quiz no disponible");
    }

    quizActual = Array.isArray(data) ? data : [];

    if (!quizActual.length) {
      quizCont.innerHTML = `<div class="empty-box">Aún no hay preguntas de quiz para este subtema.</div>`;
      return;
    }

    if (quizMeta) {
      quizMeta.textContent = teacherMode
        ? `${quizActual.length} preguntas · modo profesor`
        : `${quizActual.length} preguntas aleatorias · escala 1.0 a 5.0`;
    }

    quizCont.innerHTML = `
      <div class="cardbox">
        <h2>📝 Quiz evaluable</h2>
        <p class="meta">
          ${
            teacherMode
              ? `Modo profesor: puedes resolver el quiz como demostración. <b>No se guarda nota.</b>`
              : `Responde las preguntas y luego presiona <b>Entregar quiz</b>. El resultado se calcula automáticamente en escala de <b>1.0 a 5.0</b>.`
          }
        </p>
      </div>

      ${quizActual.map((q, idx) => renderQuizQuestion(q, idx)).join("")}

      <div class="cardbox">
        <button id="btn-entregar-quiz" class="btn btn-primary">
          ${teacherMode ? "Ver resultado del quiz" : "Entregar quiz"}
        </button>
        <p id="quiz-resultado-final" class="meta" style="margin-top:12px;"></p>
      </div>
    `;

    const btnEntregar = $("btn-entregar-quiz");
    if (btnEntregar) btnEntregar.addEventListener("click", entregarQuiz);
  } catch (e) {
    console.error("Error cargando quiz:", e);
    quizCont.innerHTML = `<div class="empty-box">❌ Error cargando quiz.</div>`;
  }
}

async function entregarQuiz() {
  if (!Array.isArray(quizActual) || !quizActual.length) return;

  let correctas = 0;
  const detalle = [];

  quizActual.forEach((q, idx) => {
    let user = "";

    if (q.tipo === "mcq" || q.tipo === "vf") {
      const sel = document.querySelector(`input[name="quiz_${idx}"]:checked`);
      user = String(sel?.value || "").trim();
    } else {
      user = String($(`quiz_in_${idx}`)?.value || "").trim();
    }

    const correcta = String(q.respuesta || "").trim();
    const ok = normalizarRespuesta(user) === normalizarRespuesta(correcta);

    if (ok) correctas++;

    detalle.push({
      pregunta: q.pregunta,
      usuario: user,
      correcta,
      ok,
    });
  });

  const total = quizActual.length;

  if (teacherMode) {
    const nota = Number((1 + (correctas / total) * 4).toFixed(1));
    const out = $("quiz-resultado-final");
    if (out) {
      out.innerHTML = `
        👩‍🏫 Vista profesor.<br>
        Aciertos: <b>${correctas}/${total}</b><br>
        Resultado estimado: <b>${nota} / 5.0</b>
      `;
    }

    showStudentModal(
      "teacher",
      "Resultado del quiz",
      `Modo profesor\nAciertos: ${correctas} de ${total}\nResultado estimado: ${nota} / 5.0\nNo se guardó ninguna nota.`
    );
    return;
  }

  try {
    const res = await window.fetchAuth(
      "/api/evaluaciones",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtema_id: Number(subtemaId),
          tipo: "quiz",
          correctas,
          total,
          detalle,
        }),
      },
      gradoId
    );

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 409) {
        await cargarEstadoEvaluaciones();
        return cargarQuiz();
      }
      throw new Error(data?.error || "No se pudo guardar el quiz");
    }

    const out = $("quiz-resultado-final");
    if (out) {
      out.innerHTML = `
        ✅ Quiz entregado correctamente.<br>
        Aciertos: <b>${data.correctas}/${data.total}</b><br>
        Calificación: <b>${data.nota} / 5.0</b>
      `;
    }

    await cargarEstadoEvaluaciones();
    if (btnQuiz) btnQuiz.disabled = true;

    let titulo = "Quiz entregado";
    let tipo = "quiz";
    if (data.nota >= 4.5) {
      titulo = "¡Excelente resultado!";
      tipo = "success";
    } else if (data.nota >= 3.0) {
      titulo = "¡Buen avance!";
      tipo = "quiz";
    } else {
      titulo = "Necesitas reforzar";
      tipo = "warning";
    }

    showStudentModal(
      tipo,
      titulo,
      `Aciertos: ${data.correctas} de ${data.total}\nCalificación final: ${data.nota} / 5.0`
    );

    await cargarQuiz();
  } catch (e) {
    const out = $("quiz-resultado-final");
    if (out) out.textContent = `❌ ${e.message}`;
    showStudentModal("error", "No se pudo entregar el quiz", e.message);
  }
}

// ======================================================
// PRÁCTICA
// ======================================================
let puntos = 0;
let respondidas = 0;
const LIMITE_PREGUNTAS = 10;
const MAX_INTENTOS = 3;
let intentos = 0;
let ejercicioActual = null;

const preguntaEl = $("pregunta");
const inputRespuesta = $("respuesta");
const resultadoEl = $("resultado");
const puntajeEl = $("puntaje");
const respondidasEl = $("respondidas");
const intentosEl = $("intentos");

const btnValidar = $("btn-validar");
const btnSaltar = $("btn-saltar");

if (btnValidar) btnValidar.addEventListener("click", validarPractica);

if (btnSaltar) {
  btnSaltar.addEventListener("click", () => {
    intentos = 0;
    if (intentosEl) intentosEl.textContent = String(intentos);
    showStudentModal("practice", "Nueva práctica", "Vamos con otro ejercicio.");
    cargarPractica();
  });
}

if (inputRespuesta) {
  inputRespuesta.addEventListener("keydown", (e) => {
    if (e.key === "Enter") validarPractica();
  });
}

async function cargarPractica() {
  if (isMissingSubtema()) {
    if (preguntaEl) preguntaEl.textContent = "❌ No se encontró el subtema.";
    if (btnValidar) btnValidar.disabled = true;
    if (btnSaltar) btnSaltar.disabled = true;
    if (inputRespuesta) inputRespuesta.disabled = true;
    return;
  }

  try {
    if (resultadoEl) {
      resultadoEl.textContent = "";
      resultadoEl.className = "";
    }

    if (inputRespuesta) {
      inputRespuesta.value = "";
      inputRespuesta.focus();
    }

    intentos = 0;
    if (intentosEl) intentosEl.textContent = String(intentos);

    const res = await fetchSafe(
      `/api/ejercicio/random/${encodeURIComponent(subtemaId)}`,
      true
    );

    if (res.status === 404) {
      if (preguntaEl) preguntaEl.textContent = "⚠️ No hay práctica disponible para este subtema.";
      if (btnValidar) btnValidar.disabled = true;
      if (btnSaltar) btnSaltar.disabled = true;
      if (inputRespuesta) inputRespuesta.disabled = true;
      disableTab("practica", "⚡ Aún no hay práctica para este subtema.");
      return;
    }

    if (res.status === 403) {
      if (preguntaEl) preguntaEl.textContent = "🔒 Este subtema aún no está disponible.";
      if (btnValidar) btnValidar.disabled = true;
      if (btnSaltar) btnSaltar.disabled = true;
      if (inputRespuesta) inputRespuesta.disabled = true;
      disableTab("practica", "🔒 Este subtema aún no está disponible.");
      return;
    }

    if (!res.ok) throw new Error("No se pudo cargar práctica");

    ejercicioActual = await res.json();
    if (!ejercicioActual || !ejercicioActual.pregunta) {
      throw new Error("La práctica llegó vacía");
    }

    if (preguntaEl) preguntaEl.textContent = formatearExpresionMatematica(ejercicioActual.pregunta);

    if (btnValidar) btnValidar.disabled = false;
    if (btnSaltar) btnSaltar.disabled = false;
    if (inputRespuesta) inputRespuesta.disabled = false;
  } catch (e) {
    console.error("Error cargando práctica:", e);
    if (preguntaEl) preguntaEl.textContent = "❌ Error cargando práctica.";
  }
}

async function guardarResultado(tipo, puntaje, total) {
  if (teacherMode || isMissingSubtema()) return;

  try {
    await window.fetchAuth(
      "/api/resultados",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtema_id: Number(subtemaId),
          tipo,
          puntaje,
          total,
        }),
      },
      gradoId
    );
  } catch (e) {
    console.warn("⚠️ No se pudo guardar resultado:", e);
  }
}

async function terminarPractica() {
  if (preguntaEl) preguntaEl.textContent = "✅ Terminaste esta ronda de práctica.";
  if (btnValidar) btnValidar.disabled = true;
  if (btnSaltar) btnSaltar.disabled = true;
  if (inputRespuesta) inputRespuesta.disabled = true;

  if (resultadoEl) resultadoEl.textContent = `Resultado: ${puntos} / ${LIMITE_PREGUNTAS}`;
  await guardarResultado("practica", puntos, LIMITE_PREGUNTAS);

  showStudentModal(
    teacherMode ? "teacher" : "practice",
    teacherMode ? "Vista de práctica finalizada" : "Práctica completada",
    teacherMode
      ? `Modo profesor\nResultado estimado: ${puntos} respuestas correctas de ${LIMITE_PREGUNTAS}.\nNo se guardó ningún registro.`
      : `Terminaste la práctica con ${puntos} respuestas correctas de ${LIMITE_PREGUNTAS}.`
  );
}

function validarPractica() {
  if (!ejercicioActual) return;

  const usuario = String(inputRespuesta?.value ?? "").trim();
  const correcta = String(ejercicioActual.respuesta ?? "").trim();

  if (!usuario) {
    if (resultadoEl) resultadoEl.textContent = "Escribe una respuesta.";
    showStudentModal("info", "Falta responder", "Debes escribir una respuesta antes de continuar.");
    return;
  }

  if (normalizarRespuesta(usuario) === normalizarRespuesta(correcta)) {
    if (resultadoEl) {
      resultadoEl.textContent = "✅ ¡Correcto!";
      resultadoEl.className = "correcto";
    }

    puntos++;
    respondidas++;
    intentos = 0;

    if (puntajeEl) puntajeEl.textContent = String(puntos);
    if (respondidasEl) respondidasEl.textContent = String(respondidas);
    if (intentosEl) intentosEl.textContent = String(intentos);

    showStudentModal("success", "¡Muy bien!", "Tu respuesta es correcta.");

    if (respondidas >= LIMITE_PREGUNTAS) {
      terminarPractica();
      return;
    }

    setTimeout(cargarPractica, 350);
    return;
  }

  intentos++;
  if (intentosEl) intentosEl.textContent = String(intentos);

  if (intentos >= MAX_INTENTOS) {
    if (resultadoEl) {
      resultadoEl.textContent = `❌ Incorrecto. La respuesta era: ${correcta}.`;
      resultadoEl.className = "incorrecto";
    }

    respondidas++;
    if (respondidasEl) respondidasEl.textContent = String(respondidas);

    intentos = 0;
    if (intentosEl) intentosEl.textContent = String(intentos);

    showStudentModal(
      "warning",
      "Intentos agotados",
      `La respuesta correcta era ${correcta}. Pasemos al siguiente ejercicio.`
    );

    if (respondidas >= LIMITE_PREGUNTAS) {
      terminarPractica();
      return;
    }

    setTimeout(cargarPractica, 500);
    return;
  }

  if (resultadoEl) {
    resultadoEl.textContent = `❌ Intenta de nuevo (${intentos}/${MAX_INTENTOS})`;
    resultadoEl.className = "incorrecto";
  }

  showStudentModal(
    "warning",
    "Sigue intentando",
    `Todavía puedes volver a responder. Llevas ${intentos} de ${MAX_INTENTOS} intentos.`
  );
}

// ======================================================
// DETECCIÓN
// ======================================================
async function detectarContenidoYDesactivarTabs() {
  if (isMissingSubtema()) {
    disableTab("intro", "📘 No se encontró el subtema.");
    disableTab("practica", "⚡ No se encontró el subtema.");
    disableTab("taller", "🧩 No se encontró el subtema.");
    disableTab("quiz", "📝 No se encontró el subtema.");
    disableTab("juego", "🎮 No se encontró el subtema.");
    return;
  }

  try {
    const [r, videoData] = await Promise.all([
      fetchSafe(`/api/intro/${encodeURIComponent(subtemaId)}`, true),
      detectarVideoIntro(),
    ]);

    if (r.status === 403) {
      disableTab("intro", "🔒 Este subtema aún no está disponible.");
    } else {
      const data = await r.json().catch(() => []);
      if ((!Array.isArray(data) || data.length === 0) && !videoData) {
        disableTab("intro", "📘 Aún no hay introducción ni video para este subtema.");
      } else {
        enableTab("intro");
      }
    }
  } catch {
    const videoData = await detectarVideoIntro();
    if (!videoData) {
      disableTab("intro", "📘 Error cargando introducción.");
    }
  }

  try {
    const r = await fetchSafe(
      `/api/ejercicio/random/${encodeURIComponent(subtemaId)}`,
      true
    );
    if (r.status === 404) disableTab("practica", "⚡ Aún no hay práctica.");
    else if (r.status === 403) disableTab("practica", "🔒 Este subtema aún no está disponible.");
    else if (r.ok) enableTab("practica");
  } catch {}

      try {
    const info = await resolverDisponibilidadTaller(true);

    if (info.blocked) {
      disableTab("taller", "🔒 Este subtema aún no está disponible.");
    } else if (info.hasDynamic || info.hasFixed) {
      enableTab("taller");
    } else {
      disableTab("taller", "🧩 Aún no hay taller.");
    }
  } catch {
    disableTab("taller", "🧩 Error cargando taller.");
  }

  try {
    const r = await fetchSafe(
      `/api/quiz/${encodeURIComponent(subtemaId)}?limit=1`,
      true
    );
    if (r.status === 404) disableTab("quiz", "📝 Aún no hay quiz.");
    else if (r.status === 403) disableTab("quiz", "🔒 Este subtema aún no está disponible.");
    else if (r.ok || r.status === 409) enableTab("quiz");
  } catch {}

  try {
    const juego = await detectarJuego();
    if (!juego) {
      disableTab("juego", "🎮 Aún no hay juego grupal para este subtema.");
    } else {
      enableTab("juego");
    }
  } catch {
    disableTab("juego", "🎮 Error cargando juego grupal.");
  }
}

// ======================================================
// INIT
// ======================================================
(async function init() {
  ensureStudentModal();

  if (isMissingSubtema()) {
    showEmpty("intro-container", "❌ No se encontró el subtema.");
    disableTab("practica", "⚡ No se encontró el subtema.");
    disableTab("taller", "🧩 No se encontró el subtema.");
    disableTab("quiz", "📝 No se encontró el subtema.");
    disableTab("juego", "🎮 No se encontró el subtema.");
    return;
  }

  await cargarEstadoEvaluaciones();
  await detectarContenidoYDesactivarTabs();

  const first = Array.from(document.querySelectorAll(".tab")).find(
    (b) => !b.classList.contains("disabled")
  );

  if (first) {
    await activateTab(first.dataset.tab);
  } else {
    showEmpty("intro-container", "⚠️ Este subtema no tiene contenido disponible.");
  }
})();