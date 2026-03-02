// public/subtema.js

// ======================
// 🔒 Guard: token + grado correcto (si aplica)
// ======================

function $(id) {
  return document.getElementById(id);
}

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

  // ✅ profesor
  localStorage.removeItem("teacher");
  localStorage.removeItem("teacherToken");
}

function isTeacher() {
  return localStorage.getItem("teacher") === "1";
}

const params = new URLSearchParams(window.location.search);
const subtemaId = params.get("subtemaId");
const subtemaNombre = params.get("subtema") || "Subtema";
const gradoId = params.get("gradoId"); // viene desde tema.js

let token = localStorage.getItem("token");
const storedGradoId = localStorage.getItem("gradoId");

// ✅ Si no hay token y NO es profe -> login
if (!token && !isTeacher()) {
  redirectToSeleccionar(gradoId);
}

// ✅ Si el grado de la URL no coincide con el guardado -> bloquea (solo alumnos)
if (!isTeacher() && gradoId && storedGradoId && String(gradoId) !== String(storedGradoId)) {
  alert("❌ No puedes entrar a este grado con tu sesión actual.");
  clearSession();
  window.location.href = "index.html";
}

// ======================
// fetchAuth (usa el global de session.js si existe)
// ======================
async function fetchAuthLocal(url, options = {}) {
  // ✅ si session.js está cargado, úsalo
  if (typeof window.fetchAuth === "function") {
    return window.fetchAuth(url, options, gradoId);
  }

  // fallback (por si no cargó session.js)
  token = localStorage.getItem("token");
  const teacherToken = localStorage.getItem("teacherToken");
  const authToken = token || teacherToken;

  if (!authToken) {
    if (isTeacher()) {
      alert("⚠️ Profesor sin sesión. Entra al panel del profesor.");
      window.location.href = "profesor.html";
      throw new Error("Sin token profesor");
    }
    redirectToSeleccionar(gradoId);
    throw new Error("Sin token alumno");
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (res.status === 401) {
    clearSession();
    if (isTeacher()) window.location.href = "profesor.html";
    else redirectToSeleccionar(gradoId);
    throw new Error("No autorizado");
  }

  // ✅ si está bloqueado por el profesor
  if (res.status === 403) {
    let msg = "🔒 Este subtema aún no está disponible. Pregunta al profesor.";
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {}
    alert(msg);
    window.location.href = `tema.html?gradoId=${encodeURIComponent(gradoId)}&temaId=${encodeURIComponent(
      params.get("temaId") || ""
    )}&tema=${encodeURIComponent(params.get("tema") || "")}`;
    throw new Error("Bloqueado");
  }

  return res;
}

// ✅ Validar token al cargar
async function validarSesionOnLoad() {
  try {
    // Para alumno normalmente existe /api/me.
    // Para profe, depende de tu backend.
    await fetchAuthLocal("/api/me");
  } catch (e) {
    // fetchAuthLocal ya redirige si aplica
  }
}

// ======================
// Header
// ======================
const tituloEl = $("titulo-subtema");
if (tituloEl) tituloEl.textContent = subtemaNombre;

if (!subtemaId) {
  alert("❌ Falta subtemaId en la URL. Ej: subtema.html?subtemaId=1&subtema=Operaciones");
}

// ======================
// Tabs / Views
// ======================
const tabs = document.querySelectorAll(".tab");
const views = {
  intro: $("tab-intro"),
  taller: $("tab-taller"),
  quiz: $("tab-quiz"),
  practica: $("tab-practica"),
};

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

function showEmpty(containerId, text) {
  const cont = $(containerId);
  if (!cont) return;
  cont.innerHTML = `<div class="empty-box">${text}</div>`;
}

tabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.classList.contains("disabled")) return;

    tabs.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    Object.values(views).forEach((v) => v && v.classList.remove("active"));
    const key = btn.dataset.tab;
    if (views[key]) views[key].classList.add("active");

    if (key === "intro") cargarIntro();
    if (key === "taller") cargarTalleres();
  });
});

// ======================
// -------- Intro --------
// ======================
let introCargada = false;

async function cargarIntro() {
  if (introCargada) return;
  introCargada = true;

  const cont = $("intro-container");
  if (!cont) return;

  cont.innerHTML = "Cargando...";

  try {
    const res = await fetchAuthLocal(`/api/intro/${subtemaId}`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      showEmpty("intro-container", "Aún no hay introducción para este subtema.");
      return;
    }

    cont.innerHTML = data
      .map(
        (x) => `
        <div class="cardbox">
          <h2>${escapeHtml(x.titulo)}</h2>
          <div class="rich">${x.html || ""}</div>
        </div>
      `
      )
      .join("");
  } catch (e) {
    showEmpty("intro-container", "❌ Error cargando introducción.");
  }
}

// ======================
// -------- Talleres --------
// ======================
let talleresCargados = false;

async function cargarTalleres() {
  if (talleresCargados) return;
  talleresCargados = true;

  const cont = $("taller-container");
  if (!cont) return;

  cont.innerHTML = "Cargando...";

  try {
    const res = await fetchAuthLocal(`/api/talleres/${subtemaId}`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      showEmpty("taller-container", "Aún no hay talleres para este subtema.");
      return;
    }

    const teacher = isTeacher();

    cont.innerHTML = data
      .map((t, idx) => {
        const titulo = t.titulo || `Taller ${idx + 1}`;
        const enunciado = t.enunciado || "<p>(Sin enunciado)</p>";
        const solucion = t.solucion || "";

        const solHtml = teacher
          ? `
            <div style="margin-top:12px">
              <button class="btn btn-ghost" type="button" data-toggle="sol-${idx}">👁️ Mostrar/ocultar solución</button>
              <div id="sol-${idx}" style="display:none;margin-top:10px">
                <div class="cardbox">
                  <div class="rich">${solucion || "<p>(Sin solución)</p>"}</div>
                </div>
              </div>
            </div>
          `
          : `
            <div class="solution-note">
              🔒 La solución la revisa el docente. Resuelve primero y luego valida con tu profesor.
            </div>
          `;

        return `
          <div class="cardbox taller-card">
            <div class="taller-head">
              <div>
                <h2 class="taller-title">${escapeHtml(titulo)}</h2>
                <p class="meta">Actividad ${idx + 1}</p>
              </div>
              <span class="taller-tag">🧩 Taller</span>
            </div>

            <div class="taller-section">
              <h4>📌 Enunciado</h4>
              <div class="rich">${enunciado}</div>
            </div>

            ${solHtml}
          </div>
        `;
      })
      .join("");

    if (teacher) {
      cont.querySelectorAll("[data-toggle]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-toggle");
          const el = document.getElementById(id);
          if (!el) return;
          el.style.display = el.style.display === "none" ? "block" : "none";
        });
      });
    }
  } catch (e) {
    showEmpty("taller-container", "❌ Error cargando talleres.");
  }
}

// ======================
// -------- Quiz --------
// ======================
const btnQuiz = $("btn-cargar-quiz");
const quizMeta = $("quiz-meta");
const quizCont = $("quiz-container");

if (btnQuiz) btnQuiz.addEventListener("click", cargarQuiz);

async function cargarQuiz() {
  if (!quizCont) return;

  quizCont.innerHTML = "Cargando...";
  if (quizMeta) quizMeta.textContent = "";

  try {
    const res = await fetchAuthLocal(`/api/quiz/${subtemaId}?limit=10`);
    const preguntas = await res.json();

    if (!Array.isArray(preguntas) || preguntas.length === 0) {
      quizCont.innerHTML = `<div class="empty-box">Aún no hay preguntas de quiz para este subtema.</div>`;
      return;
    }

    if (quizMeta) quizMeta.textContent = `${preguntas.length} preguntas`;

    quizCont.innerHTML = preguntas
      .map((q, idx) => {
        if (q.tipo === "mcq" && Array.isArray(q.opciones)) {
          const opts = q.opciones
            .map(
              (op) => `
              <label style="display:block;margin:8px 0" class="meta">
                <input type="radio" name="q${q.id}" value="${escapeHtml(op)}"> ${escapeHtml(op)}
              </label>
            `
            )
            .join("");

          return `
            <div class="cardbox">
              <h3>${idx + 1}. ${escapeHtml(q.pregunta)}</h3>
              ${opts}
              <button class="btn-secundario" onclick="revisarMCQ(${q.id}, '${escapeQuotes(
                q.respuesta
              )}', '${escapeQuotes(q.explicacion || "")}')">Revisar</button>
              <p id="r${q.id}" class="meta"></p>
            </div>
          `;
        }

        if (q.tipo === "vf") {
          return `
            <div class="cardbox">
              <h3>${idx + 1}. ${escapeHtml(q.pregunta)}</h3>
              <label style="margin-right:10px" class="meta"><input type="radio" name="q${q.id}" value="V"> Verdadero</label>
              <label class="meta"><input type="radio" name="q${q.id}" value="F"> Falso</label>
              <div style="margin-top:10px">
                <button class="btn-secundario" onclick="revisarMCQ(${q.id}, '${escapeQuotes(
                  q.respuesta
                )}', '${escapeQuotes(q.explicacion || "")}')">Revisar</button>
                <p id="r${q.id}" class="meta"></p>
              </div>
            </div>
          `;
        }

        return `
          <div class="cardbox">
            <h3>${idx + 1}. ${escapeHtml(q.pregunta)}</h3>
            <input id="in${q.id}" type="text" placeholder="Tu respuesta"
              style="padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,0.14);background:rgba(0,0,0,0.22);color:#fff;width:min(420px,100%)">
            <div style="margin-top:10px">
              <button class="btn-secundario" onclick="revisarAbierta(${q.id}, '${escapeQuotes(
                q.respuesta
              )}', '${escapeQuotes(q.explicacion || "")}')">Revisar</button>
              <p id="r${q.id}" class="meta"></p>
            </div>
          </div>
        `;
      })
      .join("");
  } catch (e) {
    quizCont.innerHTML = `<div class="empty-box">❌ Error cargando quiz.</div>`;
  }
}

// helpers quiz
function escapeQuotes(s) {
  return String(s ?? "").replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.revisarMCQ = function (id, correcta, explicacion) {
  const sel = document.querySelector(`input[name="q${id}"]:checked`);
  const out = $(`r${id}`);
  if (!out) return;

  if (!sel) {
    out.textContent = "Elige una opción.";
    return;
  }
  out.textContent =
    sel.value === correcta
      ? `✅ Correcto. ${explicacion}`
      : `❌ Incorrecto. Respuesta: ${correcta}. ${explicacion}`;
};

window.revisarAbierta = function (id, correcta, explicacion) {
  const inp = $(`in${id}`);
  const out = $(`r${id}`);
  if (!inp || !out) return;

  const user = String(inp.value).trim();
  if (!user) {
    out.textContent = "Escribe una respuesta.";
    return;
  }
  out.textContent =
    user === String(correcta).trim()
      ? `✅ Correcto. ${explicacion}`
      : `❌ Incorrecto. Respuesta: ${correcta}. ${explicacion}`;
};

// ======================
// -------- Práctica --------
// ======================
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

if (btnSaltar)
  btnSaltar.addEventListener("click", () => {
    intentos = 0;
    if (intentosEl) intentosEl.textContent = String(intentos);
    cargarPractica();
  });

if (inputRespuesta)
  inputRespuesta.addEventListener("keydown", (e) => {
    if (e.key === "Enter") validarPractica();
  });

async function cargarPractica() {
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

    const res = await fetchAuthLocal(`/api/ejercicio/random/${subtemaId}`);

    if (res.status === 404) {
      if (preguntaEl) preguntaEl.textContent = "⚠️ No hay práctica disponible para este subtema.";
      if (btnValidar) btnValidar.disabled = true;
      if (btnSaltar) btnSaltar.disabled = true;
      if (inputRespuesta) inputRespuesta.disabled = true;
      if (resultadoEl) resultadoEl.textContent = "";
      disableTab("practica", "⚡ Aún no hay práctica para este subtema.");
      return;
    }

    if (!res.ok) throw new Error("No se pudo cargar práctica");

    ejercicioActual = await res.json();
    if (preguntaEl) preguntaEl.textContent = ejercicioActual.pregunta;

    if (btnValidar) btnValidar.disabled = false;
    if (btnSaltar) btnSaltar.disabled = false;
    if (inputRespuesta) inputRespuesta.disabled = false;
  } catch (e) {
    if (preguntaEl) preguntaEl.textContent = "❌ Error cargando práctica.";
  }
}

async function guardarResultado(tipo, puntaje, total) {
  try {
    await fetchAuthLocal("/api/resultados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subtema_id: Number(subtemaId),
        tipo,
        puntaje,
        total,
      }),
    });
  } catch (e) {
    console.warn("⚠️ No se pudo guardar resultado:", e);
  }
}

async function terminarPractica() {
  if (preguntaEl) preguntaEl.textContent = "✅ Terminaste este subtema. ¡Bien hecho!";
  if (btnValidar) btnValidar.disabled = true;
  if (btnSaltar) btnSaltar.disabled = true;
  if (inputRespuesta) inputRespuesta.disabled = true;

  if (resultadoEl) resultadoEl.textContent = `Resultado: ${puntos} / ${LIMITE_PREGUNTAS}`;

  await guardarResultado("practica", puntos, LIMITE_PREGUNTAS);
}

function validarPractica() {
  if (!ejercicioActual) return;

  const usuario = String(inputRespuesta?.value ?? "").trim();
  const correcta = String(ejercicioActual.respuesta ?? "").trim();

  if (!usuario) {
    if (resultadoEl) resultadoEl.textContent = "Escribe una respuesta.";
    return;
  }

  if (usuario === correcta) {
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

    if (respondidas >= LIMITE_PREGUNTAS) {
      terminarPractica();
      return;
    }

    setTimeout(cargarPractica, 450);
    return;
  }

  intentos++;
  if (intentosEl) intentosEl.textContent = String(intentos);

  if (intentos >= MAX_INTENTOS) {
    if (resultadoEl) {
      resultadoEl.textContent = `❌ Incorrecto. La respuesta era: ${correcta}. Siguiente…`;
      resultadoEl.className = "incorrecto";
    }

    respondidas++;
    if (respondidasEl) respondidasEl.textContent = String(respondidas);

    intentos = 0;
    if (intentosEl) intentosEl.textContent = String(intentos);

    if (respondidas >= LIMITE_PREGUNTAS) {
      terminarPractica();
      return;
    }

    setTimeout(cargarPractica, 700);
    return;
  }

  if (resultadoEl) {
    resultadoEl.textContent = `❌ Intenta de nuevo (${intentos}/${MAX_INTENTOS})`;
    resultadoEl.className = "incorrecto";
  }
}

// ======================
// Detectar contenido y desactivar tabs vacías
// ======================
async function detectarContenidoYDesactivarTabs() {
  try {
    const r = await fetchAuthLocal(`/api/intro/${subtemaId}`);
    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0) disableTab("intro", "📘 Aún no hay introducción para este subtema.");
  } catch {
    disableTab("intro", "📘 Error cargando introducción.");
  }

  try {
    const r = await fetchAuthLocal(`/api/talleres/${subtemaId}`);
    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0) disableTab("taller", "🧩 Aún no hay talleres para este subtema.");
  } catch {
    disableTab("taller", "🧩 Error cargando talleres.");
  }

  try {
    const r = await fetchAuthLocal(`/api/quiz/${subtemaId}?limit=1`);
    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0) disableTab("quiz", "✅ Aún no hay quiz para este subtema.");
  } catch {
    disableTab("quiz", "✅ Error cargando quiz.");
  }

  try {
    const r = await fetchAuthLocal(`/api/ejercicio/random/${subtemaId}`);
    if (r.status === 404) disableTab("practica", "⚡ Aún no hay práctica para este subtema.");
  } catch {}
}

// ======================
// Carga inicial
// ======================
(async function init() {
  await validarSesionOnLoad();
  await detectarContenidoYDesactivarTabs();

  const introBtn = document.querySelector(`.tab[data-tab="intro"]`);
  if (introBtn && !introBtn.classList.contains("disabled")) {
    introBtn.click();
  } else {
    const first = Array.from(document.querySelectorAll(".tab")).find((b) => !b.classList.contains("disabled"));
    if (first) first.click();
  }

  cargarPractica();
})();