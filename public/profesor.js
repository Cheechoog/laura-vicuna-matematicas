// public/profesor.js
// Panel Profesor (SQLite)
// - Login con PIN profesor -> /api/profesor/sesion
// - Cargar grados -> /api/grados
// - Cargar temas por grado -> /api/temas/:gradoId
// - Cargar subtemas con resumen -> /api/tema/:temaId/resumen
// - Guardar disponibilidad -> /api/profesor/subtema/:subtemaId/disponibilidad (requiere token teacher)

const TEACHER_TOKEN_KEY = "teacherToken";

function $(id) {
  return document.getElementById(id);
}

function setText(el, text) {
  if (!el) return;
  el.textContent = text || "";
}

function getToken() {
  return localStorage.getItem(TEACHER_TOKEN_KEY);
}

function setToken(t) {
  localStorage.setItem(TEACHER_TOKEN_KEY, t);
}

function clearToken() {
  localStorage.removeItem(TEACHER_TOKEN_KEY);
}

// Convierte "YYYY-MM-DDTHH:MM" -> "YYYY-MM-DD HH:MM:00" (para guardar en SQLite)
function toSqliteDatetime(dtLocal) {
  if (!dtLocal) return null;
  const s = String(dtLocal).replace("T", " ");
  return s.length === 16 ? `${s}:00` : s;
}

async function fetchTeacher(url, options = {}) {
  const token = getToken();
  if (!token) throw new Error("Sin sesión de profesor");

  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    clearToken();
    throw new Error("Sesión profesor inválida o vencida");
  }

  return res;
}

// -------------------- LOGIN --------------------
async function login(pin) {
  const res = await fetch("/api/profesor/sesion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "PIN incorrecto");
  if (!data?.token) throw new Error("No llegó token profesor");

  setToken(data.token);
  return data;
}

// -------------------- DATA LOADERS --------------------
async function loadGrados() {
  const sel = $("grado");
  if (!sel) return;

  sel.innerHTML = `<option value="">Cargando...</option>`;
  const res = await fetch("/api/grados");
  const rows = await res.json();

  sel.innerHTML =
    `<option value="">Selecciona grado</option>` +
    rows.map((g) => `<option value="${g.id}">${g.nombre}</option>`).join("");
}

async function loadTemas(gradoId) {
  const sel = $("tema");
  if (!sel) return;

  if (!gradoId) {
    sel.innerHTML = `<option value="">Selecciona tema</option>`;
    return;
  }

  sel.innerHTML = `<option value="">Cargando...</option>`;
  const res = await fetch(`/api/temas/${encodeURIComponent(gradoId)}`);
  const rows = await res.json();

  sel.innerHTML =
    `<option value="">Selecciona tema</option>` +
    rows.map((t) => `<option value="${t.id}">${t.nombre}</option>`).join("");
}

function pillDisponible(disponible) {
  return disponible
    ? `<span class="pill pill-ok">✅ Disponible</span>`
    : `<span class="pill pill-off">🔒 Bloqueado</span>`;
}

function contentMeta(row) {
  const intro = Number(row.intro_count || 0);
  const tall = Number(row.talleres_count || 0);
  const quiz = Number(row.quiz_count || 0);
  const prac = Number(row.plantillas_count || 0);

  const parts = [];
  if (intro) parts.push(`📘 Intro (${intro})`);
  if (tall) parts.push(`🧩 Taller (${tall})`);
  if (quiz) parts.push(`✅ Quiz (${quiz})`);
  if (prac) parts.push(`⚡ Práctica`);

  return parts.length ? parts.join(" · ") : "⏳ Sin contenido aún";
}

// -------------------- RENDER SUBTEMAS --------------------
let currentTemaId = null;
let currentSubtemas = [];

async function loadSubtemas(temaId) {
  const list = $("lista");
  const msg = $("panel-msg");
  if (!list) return;

  currentTemaId = temaId;
  currentSubtemas = [];

  setText(msg, "");
  list.innerHTML = "";

  if (!temaId) {
    list.innerHTML = `<div class="panel">Selecciona un tema.</div>`;
    return;
  }

  list.innerHTML = `<div class="panel">Cargando subtemas...</div>`;

  try {
    const res = await fetch(`/api/tema/${encodeURIComponent(temaId)}/resumen`);
    const rows = await res.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      list.innerHTML = `<div class="panel">No hay subtemas para este tema.</div>`;
      return;
    }

    currentSubtemas = rows;

    list.innerHTML = "";
    rows.forEach((row) => {
      const habilitado = Number(row.habilitado || 0) === 1;
      const disponible = Number(row.disponible || 0) === 1;
      const dd = row.disponible_desde || null;

      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <div style="flex:1; min-width: 240px;">
          <h3>${row.subtema_nombre}</h3>
          <p class="meta">${contentMeta(row)}</p>
          <p class="meta">Estado actual: ${pillDisponible(disponible)}</p>
          ${dd ? `<p class="meta">Disponible desde: <b>${String(dd)}</b></p>` : ``}
        </div>

        <div style="min-width: 260px; display:flex; flex-direction:column; gap:10px; align-items:flex-end;">
          <div class="switch">
            <div class="small">Habilitado</div>
            <div class="toggle ${habilitado ? "on" : ""}" data-subtema="${row.subtema_id}" title="Click para cambiar"></div>
          </div>

          <button class="btn btn-sec btn-guardar" data-subtema="${row.subtema_id}">Guardar</button>

          <div class="small msg-save" data-subtema="${row.subtema_id}"></div>
        </div>
      `;

      // toggle visual (solo UI)
      const toggle = card.querySelector(".toggle");
      toggle.addEventListener("click", () => {
        toggle.classList.toggle("on");
      });

      // guardar
      const btnGuardar = card.querySelector(".btn-guardar");
      btnGuardar.addEventListener("click", async () => {
        const subtemaId = Number(btnGuardar.dataset.subtema);
        const localToggle = card.querySelector(`.toggle[data-subtema="${subtemaId}"]`);
        const isOn = localToggle.classList.contains("on");

        const globalDD = $("disponible-desde")?.value || "";
        const ddToSave = toSqliteDatetime(globalDD);

        const out = card.querySelector(`.msg-save[data-subtema="${subtemaId}"]`);
        setText(out, "Guardando...");

        try {
          const r = await fetchTeacher(`/api/profesor/subtema/${encodeURIComponent(subtemaId)}/disponibilidad`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              habilitado: isOn,
              disponible_desde: ddToSave,
            }),
          });

          const data = await r.json();
          if (!r.ok) throw new Error(data?.error || "No se pudo guardar");

          setText(out, "✅ Guardado");
          await loadSubtemas(currentTemaId); // refresca disponible calculado
        } catch (e) {
          setText(out, "❌ " + (e.message || "Error"));
        }
      });

      list.appendChild(card);
    });
  } catch (e) {
    console.error(e);
    list.innerHTML = `<div class="panel">❌ Error cargando subtemas.</div>`;
  }
}

// -------------------- BULK ACTIONS --------------------
async function bulkSet(habilitar) {
  const msg = $("panel-msg");
  if (!currentTemaId || !currentSubtemas.length) {
    setText(msg, "Primero carga los subtemas.");
    return;
  }

  const globalDD = $("disponible-desde")?.value || "";
  const ddToSave = toSqliteDatetime(globalDD);

  setText(msg, habilitar ? "Habilitando..." : "Bloqueando...");

  try {
    for (const row of currentSubtemas) {
      const subtemaId = Number(row.subtema_id);
      const r = await fetchTeacher(`/api/profesor/subtema/${encodeURIComponent(subtemaId)}/disponibilidad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          habilitado: habilitar,
          disponible_desde: ddToSave,
        }),
      });

      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data?.error || "Error en acción masiva");
      }
    }

    setText(msg, "✅ Listo");
    await loadSubtemas(currentTemaId);
  } catch (e) {
    setText(msg, "❌ " + (e.message || "Error"));
  }
}

// -------------------- INIT --------------------
function showPanel() {
  const lb = $("login-box");
  const pb = $("panel-box");
  if (lb) lb.style.display = "none";
  if (pb) pb.style.display = "block";

  const btnLogout = $("btn-logout");
  if (btnLogout) btnLogout.style.display = "inline-flex";
}

function showLogin() {
  const lb = $("login-box");
  const pb = $("panel-box");
  if (lb) lb.style.display = "block";
  if (pb) pb.style.display = "none";

  const btnLogout = $("btn-logout");
  if (btnLogout) btnLogout.style.display = "none";
}

async function init() {
  const btnLogin = $("btn-login");
  const pinInp = $("pin");
  const loginMsg = $("login-msg");

  const btnLogout = $("btn-logout");
  const selGrado = $("grado");
  const selTema = $("tema");
  const btnCargar = $("btn-cargar");

  const btnHabTodos = $("btn-habilitar-todos");
  const btnBloqTodos = $("btn-bloquear-todos");

  // logout
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      clearToken();
      showLogin();
      setText(loginMsg, "Sesión cerrada.");
    });
  }

  // Si ya hay token, probamos /api/me (teacher)
  if (getToken()) {
    try {
      const r = await fetchTeacher("/api/me");
      if (!r.ok) throw new Error("Token inválido");
      showPanel();
    } catch {
      clearToken();
      showLogin();
    }
  } else {
    showLogin();
  }

  // carga grados
  await loadGrados();

  // cambia grado -> carga temas
  if (selGrado) {
    selGrado.addEventListener("change", async () => {
      await loadTemas(selGrado.value);
      const lista = $("lista");
      if (lista) lista.innerHTML = "";
      currentTemaId = null;
      currentSubtemas = [];
    });
  }

  // cargar subtemas
  if (btnCargar) {
    btnCargar.addEventListener("click", async () => {
      const temaId = selTema?.value;
      await loadSubtemas(temaId);
    });
  }

  // bulk
  if (btnHabTodos) btnHabTodos.addEventListener("click", () => bulkSet(true));
  if (btnBloqTodos) btnBloqTodos.addEventListener("click", () => bulkSet(false));

  // login
  if (btnLogin) {
    btnLogin.addEventListener("click", async () => {
      setText(loginMsg, "");

      const pin = String(pinInp?.value || "").trim();
      if (!pin) {
        setText(loginMsg, "Escribe el PIN.");
        return;
      }

      try {
        await login(pin);
        setText(loginMsg, "✅ Entraste como profesor.");
        showPanel();
      } catch (e) {
        setText(loginMsg, "❌ " + (e.message || "PIN incorrecto"));
      }
    });
  }

  // enter en input pin
  if (pinInp) {
    pinInp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") btnLogin?.click();
    });
  }
}

document.addEventListener("DOMContentLoaded", init);