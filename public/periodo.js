function $(id) {
  return document.getElementById(id);
}

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);

  const gradoId = params.get("gradoId") || params.get("id");
  const periodoId = params.get("periodoId");
  const nombrePeriodo = params.get("periodo") || "Periodo";

  if (typeof requireSession === "function") {
    requireSession(gradoId);
  }

  if (typeof requireGrade === "function") {
    const ok = requireGrade(gradoId);
    if (!ok) return;
  }

  const titulo = $("titulo-periodo");
  if (titulo) {
    titulo.innerHTML = `
      <div class="page-title-stack">
        <span class="page-kicker">Periodo académico</span>
        <span>${escapeHtml(nombrePeriodo)}</span>
      </div>
    `;
  }

  if (!gradoId || !periodoId) {
    const container = $("temas-container");
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3>Faltan datos</h3>
          <p>No se encontró el grado o el periodo para cargar los temas.</p>
        </div>
      `;
    }
    return;
  }

  injectPeriodoCardStyles();
  await cargarTemas(gradoId, periodoId, nombrePeriodo);
});

async function cargarTemas(gradoId, periodoId, nombrePeriodo) {
  const container = $("temas-container");
  if (!container) return;

  container.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Cargando temas del periodo...</p>
    </div>
  `;

  try {
    const res = await fetch(
      `/api/temas/grado/${encodeURIComponent(gradoId)}/periodo/${encodeURIComponent(periodoId)}`
    );
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📚</div>
          <h3>Aún no hay temas</h3>
          <p>Este periodo todavía no tiene temas registrados.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = data
      .map((tema, index) => {
        const href = `tema.html?gradoId=${encodeURIComponent(gradoId)}&periodoId=${encodeURIComponent(periodoId)}&periodo=${encodeURIComponent(nombrePeriodo)}&temaId=${encodeURIComponent(tema.id)}&tema=${encodeURIComponent(tema.nombre)}`;

        return `
          <a class="card academic-card academic-card-tema" href="${href}">
            <div class="academic-card-top">
              <span class="academic-card-badge">Tema ${index + 1}</span>
              <span class="academic-card-arrow">→</span>
            </div>

            <div class="academic-card-body">
              <h3>${escapeHtml(tema.nombre)}</h3>
              <p>Ingresa para revisar los subtemas y seguir avanzando en este periodo.</p>
            </div>

            <div class="academic-card-footer">
              <span class="academic-card-chip">Tocar para abrir</span>
            </div>
          </a>
        `;
      })
      .join("");
  } catch (e) {
    console.error(e);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">❌</div>
        <h3>Error cargando temas</h3>
        <p>No se pudieron cargar los temas del periodo.</p>
      </div>
    `;
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function injectPeriodoCardStyles() {
  if (document.getElementById("periodo-academic-card-styles")) return;

  const style = document.createElement("style");
  style.id = "periodo-academic-card-styles";
  style.textContent = `
    .academic-card {
      min-height: 210px;
      padding: 22px;
      justify-content: space-between;
      gap: 16px;
      border-radius: 26px;
      background: linear-gradient(180deg, rgba(255,255,255,0.11), rgba(255,255,255,0.06));
      border: 1px solid rgba(255,255,255,0.14);
      box-shadow: 0 16px 36px rgba(0,0,0,0.24);
    }

    .academic-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 24px 52px rgba(0,0,0,0.32);
    }

    .academic-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .academic-card-badge {
      display: inline-flex;
      align-items: center;
      padding: 8px 13px;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 900;
      letter-spacing: 0.02em;
      background: rgba(66,215,255,0.14);
      border: 1px solid rgba(66,215,255,0.25);
      color: rgba(255,255,255,0.96);
    }

    .academic-card-arrow {
      font-size: 1.35rem;
      font-weight: 900;
      opacity: 0.95;
      line-height: 1;
    }

    .academic-card-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
    }

    .academic-card-body h3 {
      margin: 0;
      font-size: clamp(1.3rem, 1.9vw, 1.8rem);
      line-height: 1.12;
      font-weight: 900;
      color: #fff;
    }

    .academic-card-body p {
      margin: 0;
      font-size: 0.97rem;
      line-height: 1.5;
      color: rgba(255,255,255,0.80);
      max-width: 42ch;
    }

    .academic-card-footer {
      display: flex;
      align-items: center;
      justify-content: flex-start;
    }

    .academic-card-chip {
      display: inline-flex;
      align-items: center;
      padding: 8px 12px;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 800;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.84);
    }

    @media (max-width: 700px) {
      .academic-card {
        min-height: 185px;
        padding: 18px;
        gap: 14px;
        border-radius: 22px;
      }

      .academic-card-body h3 {
        font-size: 1.22rem;
      }

      .academic-card-body p {
        font-size: 0.92rem;
        line-height: 1.42;
      }

      .academic-card-badge,
      .academic-card-chip {
        font-size: 0.74rem;
        padding: 7px 11px;
      }

      .academic-card-arrow {
        font-size: 1.2rem;
      }
    }

    @media (max-width: 520px) {
      .academic-card {
        min-height: 170px;
        padding: 16px;
      }

      .academic-card-body h3 {
        font-size: 1.12rem;
      }

      .academic-card-body p {
        font-size: 0.89rem;
      }
    }
  `;
  document.head.appendChild(style);
}