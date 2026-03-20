(function () {
  if (window.initIntroWidgets) return;

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeToken(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function parseCommaList(text) {
    return String(text || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function countItems(items) {
    const map = new Map();
    items.forEach((item) => {
      const key = normalizeToken(item);
      if (!key) return;
      map.set(key, (map.get(key) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([valor, frecuencia]) => ({ valor, frecuencia }))
      .sort((a, b) => b.frecuencia - a.frecuencia || a.valor.localeCompare(b.valor));
  }

  function injectStyles() {
    if (document.getElementById("intro-widgets-styles")) return;

    const style = document.createElement("style");
    style.id = "intro-widgets-styles";
    style.textContent = `
      .iw-box{
        margin-top:16px;
        padding:16px;
        border-radius:18px;
        background:rgba(255,255,255,.06);
        border:1px solid rgba(255,255,255,.12);
      }

      .iw-title{
        margin:0 0 10px;
        font-size:1rem;
        font-weight:800;
        color:#fff;
      }

      .iw-help{
        margin:0 0 12px;
        color:rgba(255,255,255,.86);
        font-size:.95rem;
        line-height:1.5;
      }

      .iw-row{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        margin-bottom:12px;
      }

      .iw-input, .iw-textarea{
        width:100%;
        border-radius:14px;
        border:1px solid rgba(255,255,255,.14);
        background:rgba(255,255,255,.06);
        color:#fff;
        padding:12px 14px;
        outline:none;
      }

      .iw-textarea{
        min-height:92px;
        resize:vertical;
      }

      .iw-btn{
        border:1px solid rgba(255,255,255,.12);
        background:rgba(255,255,255,.08);
        color:#fff;
        border-radius:12px;
        padding:10px 14px;
        cursor:pointer;
        font-weight:700;
      }

      .iw-btn:hover{
        background:rgba(255,255,255,.12);
      }

      .iw-grid{
        display:grid;
        gap:12px;
      }

      .iw-list{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
      }

      .iw-chip{
        display:inline-flex;
        align-items:center;
        gap:6px;
        padding:8px 10px;
        border-radius:999px;
        background:rgba(59,130,246,.14);
        border:1px solid rgba(59,130,246,.24);
        color:#eef6ff;
        font-size:.88rem;
        font-weight:700;
      }

      .iw-table{
        width:100%;
        border-collapse:collapse;
        overflow:hidden;
        border-radius:14px;
      }

      .iw-table th,
      .iw-table td{
        border:1px solid rgba(255,255,255,.12);
        padding:10px;
        text-align:left;
        color:#fff;
      }

      .iw-table th{
        background:rgba(255,255,255,.08);
      }

      .iw-empty{
        color:rgba(255,255,255,.72);
        font-style:italic;
      }

      .iw-bars{
        display:grid;
        gap:10px;
      }

      .iw-bar-row{
        display:grid;
        grid-template-columns: 120px 1fr 50px;
        gap:10px;
        align-items:center;
      }

      .iw-bar-label{
        color:#fff;
        font-weight:700;
        font-size:.92rem;
      }

      .iw-bar-track{
        width:100%;
        height:18px;
        border-radius:999px;
        background:rgba(255,255,255,.08);
        overflow:hidden;
      }

      .iw-bar-fill{
        height:100%;
        border-radius:999px;
        background:linear-gradient(90deg, #4ade80, #22c55e);
      }

      .iw-bar-value{
        color:#fff;
        font-weight:800;
        text-align:right;
      }

      .iw-kpis{
        display:flex;
        flex-wrap:wrap;
        gap:10px;
      }

      .iw-kpi{
        padding:10px 12px;
        border-radius:14px;
        background:rgba(255,255,255,.07);
        border:1px solid rgba(255,255,255,.12);
        color:#fff;
        font-size:.9rem;
      }
    `;
    document.head.appendChild(style);
  }

  function renderRecolectar(el) {
    const defaults = el.dataset.default || "manzana, banano, manzana, uva";
    el.innerHTML = `
      <div class="iw-box">
        <h4 class="iw-title">🧪 Demo: recolecta datos del salón</h4>
        <p class="iw-help">
          Escribe respuestas separadas por comas. La herramienta mostrará los datos recolectados y su conteo automático.
        </p>

        <div class="iw-grid">
          <textarea class="iw-textarea" placeholder="Ejemplo: manzana, banano, manzana, uva">${escapeHtml(defaults)}</textarea>

          <div class="iw-row">
            <button class="iw-btn" data-action="procesar">Procesar datos</button>
            <button class="iw-btn" data-action="limpiar">Limpiar</button>
          </div>

          <div data-role="salida"></div>
        </div>
      </div>
    `;

    const textarea = el.querySelector(".iw-textarea");
    const salida = el.querySelector('[data-role="salida"]');

    function draw() {
      const items = parseCommaList(textarea.value);
      const counted = countItems(items);

      salida.innerHTML = `
        <div class="iw-kpis" style="margin-bottom:12px">
          <div class="iw-kpi"><b>Total de datos:</b> ${items.length}</div>
          <div class="iw-kpi"><b>Categorías distintas:</b> ${counted.length}</div>
        </div>

        <div class="iw-title" style="font-size:.95rem">Datos recolectados</div>
        <div class="iw-list" style="margin-bottom:14px">
          ${
            items.length
              ? items.map((x) => `<span class="iw-chip">${escapeHtml(x)}</span>`).join("")
              : `<div class="iw-empty">Aún no hay datos.</div>`
          }
        </div>

        <div class="iw-title" style="font-size:.95rem">Conteo automático</div>
        ${
          counted.length
            ? `
            <table class="iw-table">
              <thead>
                <tr>
                  <th>Dato</th>
                  <th>Cantidad</th>
                </tr>
              </thead>
              <tbody>
                ${counted
                  .map(
                    (row) => `
                  <tr>
                    <td>${escapeHtml(row.valor)}</td>
                    <td>${row.frecuencia}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          `
            : `<div class="iw-empty">Escribe datos para ver el conteo.</div>`
        }
      `;
    }

    el.querySelector('[data-action="procesar"]').addEventListener("click", draw);
    el.querySelector('[data-action="limpiar"]').addEventListener("click", () => {
      textarea.value = "";
      draw();
    });

    draw();
  }

  function renderFrecuencias(el, withRelative = false) {
    const defaults = el.dataset.default || "azul, rojo, azul, verde, azul, rojo";
    el.innerHTML = `
      <div class="iw-box">
        <h4 class="iw-title">${withRelative ? "📊 Demo: frecuencia absoluta y relativa" : "📋 Demo: tabla de frecuencias"}</h4>
        <p class="iw-help">
          Escribe datos separados por comas y observa cómo se construye automáticamente la tabla.
        </p>

        <textarea class="iw-textarea">${escapeHtml(defaults)}</textarea>

        <div class="iw-row">
          <button class="iw-btn" data-action="generar">Generar tabla</button>
        </div>

        <div data-role="tabla"></div>
      </div>
    `;

    const textarea = el.querySelector(".iw-textarea");
    const tabla = el.querySelector('[data-role="tabla"]');

    function draw() {
      const items = parseCommaList(textarea.value);
      const counted = countItems(items);
      const total = items.length || 1;

      tabla.innerHTML = counted.length
        ? `
          <table class="iw-table">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Frecuencia absoluta</th>
                ${
                  withRelative
                    ? `
                    <th>Frecuencia relativa</th>
                    <th>Porcentaje</th>
                  `
                    : ""
                }
              </tr>
            </thead>
            <tbody>
              ${counted
                .map((row) => {
                  const rel = row.frecuencia / total;
                  const pct = Math.round(rel * 100);
                  return `
                    <tr>
                      <td>${escapeHtml(row.valor)}</td>
                      <td>${row.frecuencia}</td>
                      ${
                        withRelative
                          ? `
                          <td>${rel.toFixed(2)}</td>
                          <td>${pct}%</td>
                        `
                          : ""
                      }
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        `
        : `<div class="iw-empty">Escribe datos para construir la tabla.</div>`;
    }

    el.querySelector('[data-action="generar"]').addEventListener("click", draw);
    draw();
  }

  function renderGrafico(el) {
    const defaults = el.dataset.default || "fútbol, fútbol, baloncesto, fútbol, natación, baloncesto";
    el.innerHTML = `
      <div class="iw-box">
        <h4 class="iw-title">📈 Demo: gráfico de barras</h4>
        <p class="iw-help">
          Escribe datos separados por comas y observa cómo cambian las barras.
        </p>

        <textarea class="iw-textarea">${escapeHtml(defaults)}</textarea>

        <div class="iw-row">
          <button class="iw-btn" data-action="dibujar">Construir gráfico</button>
        </div>

        <div data-role="grafico"></div>
      </div>
    `;

    const textarea = el.querySelector(".iw-textarea");
    const grafico = el.querySelector('[data-role="grafico"]');

    function draw() {
      const items = parseCommaList(textarea.value);
      const counted = countItems(items);
      const max = Math.max(...counted.map((x) => x.frecuencia), 1);

      grafico.innerHTML = counted.length
        ? `
          <div class="iw-bars">
            ${counted
              .map((row) => {
                const width = Math.max(12, Math.round((row.frecuencia / max) * 100));
                return `
                  <div class="iw-bar-row">
                    <div class="iw-bar-label">${escapeHtml(row.valor)}</div>
                    <div class="iw-bar-track">
                      <div class="iw-bar-fill" style="width:${width}%"></div>
                    </div>
                    <div class="iw-bar-value">${row.frecuencia}</div>
                  </div>
                `;
              })
              .join("")}
          </div>
        `
        : `<div class="iw-empty">Escribe datos para dibujar el gráfico.</div>`;
    }

    el.querySelector('[data-action="dibujar"]').addEventListener("click", draw);
    draw();
  }

  window.initIntroWidgets = function (root = document) {
    injectStyles();

    root.querySelectorAll("[data-widget]").forEach((el) => {
      if (el.dataset.widgetMounted === "1") return;

      const type = el.dataset.widget;

      if (type === "recoleccion") renderRecolectar(el);
      if (type === "frecuencias") renderFrecuencias(el, false);
      if (type === "frecuencias-relativas") renderFrecuencias(el, true);
      if (type === "grafico-barras") renderGrafico(el);

      el.dataset.widgetMounted = "1";
    });
  };
})();   