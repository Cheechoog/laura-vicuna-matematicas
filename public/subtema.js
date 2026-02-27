// ======================
// 🔒 Punto 4 PRO: proteger entrada + manejar token vencido + BLOQUEO GRADO
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

const params = new URLSearchParams(window.location.search);
const subtemaId = params.get("subtemaId");
const subtemaNombre = params.get("subtema") || "Subtema";
const gradoId = params.get("gradoId"); // ✅ NUEVO: viene desde tema.js

let token = localStorage.getItem("token");
const storedGradoId = localStorage.getItem("gradoId");

// ✅ Si no hay token -> seleccionar
if (!token) {
  redirectToSeleccionar(gradoId);
}

// ✅ Si el grado de la URL no coincide con el guardado -> bloquea
if (gradoId && storedGradoId && String(gradoId) !== String(storedGradoId)) {
  alert("❌ No puedes entrar a este grado con tu sesión actual.");
  clearSession();
  window.location.href = "index.html";
}

// Fetch con token + auto-logout si 401 (token malo / vencido)
async function fetchAuth(url, options = {}) {
  token = localStorage.getItem("token");
  if (!token) {
    redirectToSeleccionar(gradoId);
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
    redirectToSeleccionar(gradoId);
    throw new Error("No autorizado (token vencido o inválido)");
  }

  return res;
}

// ✅ Validar token al cargar
async function validarSesionOnLoad() {
  try {
    await fetchAuth("/api/me");
  } catch (e) {
    // fetchAuth ya redirige
  }
}

// ======================
// Estado práctica
// ======================
let puntos = 0;
let respondidas = 0;
const LIMITE_PREGUNTAS = 10;

const MAX_INTENTOS = 3;
let intentos = 0;

let ejercicioActual = null;

// ======================
// Helpers DOM seguros
// ======================
function $(id) {
  return document.getElementById(id);
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
// -------- Tabs --------
// ======================
const tabs = document.querySelectorAll(".tab");
const views = {
  intro: $("tab-intro"),
  taller: $("tab-taller"),
  quiz: $("tab-quiz"),
  practica: $("tab-practica"),
};

tabs.forEach((btn) => {
  btn.addEventListener("click", () => {
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
    const res = await fetch(`/api/intro/${subtemaId}`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      cont.innerHTML = `<div class="cardbox">Aún no hay introducción para este subtema.</div>`;
      return;
    }

    cont.innerHTML = data
      .map(
        (x) => `
        <div class="cardbox">
          <h2>${x.titulo}</h2>
          <div>${x.html}</div>
        </div>
      `
      )
      .join("");
  } catch (e) {
    cont.innerHTML = `<div class="cardbox">❌ Error cargando introducción.</div>`;
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
    const res = await fetch(`/api/talleres/${subtemaId}`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      cont.innerHTML = `<div class="cardbox">Aún no hay talleres para este subtema.</div>`;
      return;
    }

    cont.innerHTML = data
      .map(
        (t) => `
        <div class="cardbox">
          <h2>${t.titulo}</h2>
          <div>${t.enunciado}</div>
          ${
            t.solucion
              ? `<details style="margin-top:10px">
                  <summary><b>Ver solución</b></summary>
                  <div style="margin-top:8px">${t.solucion}</div>
                </details>`
              : ""
          }
        </div>
      `
      )
      .join("");
  } catch (e) {
    cont.innerHTML = `<div class="cardbox">❌ Error cargando talleres.</div>`;
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
    const res = await fetch(`/api/quiz/${subtemaId}?limit=10`);
    const preguntas = await res.json();

    if (!Array.isArray(preguntas) || preguntas.length === 0) {
      quizCont.innerHTML = `<div class="cardbox">Aún no hay preguntas de quiz para este subtema.</div>`;
      return;
    }

    if (quizMeta) quizMeta.textContent = `${preguntas.length} preguntas`;

    quizCont.innerHTML = preguntas
      .map((q, idx) => {
        if (q.tipo === "mcq" && Array.isArray(q.opciones)) {
          const opts = q.opciones
            .map(
              (op) => `
              <label style="display:block;margin:6px 0">
                <input type="radio" name="q${q.id}" value="${escapeHtml(op)}"> ${escapeHtml(op)}
              </label>
            `
            )
            .join("");

          return `
            <div class="cardbox">
              <h3>${idx + 1}. ${escapeHtml(q.pregunta)}</h3>
              ${opts}
              <button class="btn-secundario" onclick="revisarMCQ(${q.id}, '${escapeQuotes(q.respuesta)}', '${escapeQuotes(q.explicacion || "")}')">Revisar</button>
              <p id="r${q.id}" class="meta"></p>
            </div>
          `;
        }

        if (q.tipo === "vf") {
          return `
            <div class="cardbox">
              <h3>${idx + 1}. ${escapeHtml(q.pregunta)}</h3>
              <label style="margin-right:10px"><input type="radio" name="q${q.id}" value="V"> Verdadero</label>
              <label><input type="radio" name="q${q.id}" value="F"> Falso</label>
              <div style="margin-top:10px">
                <button class="btn-secundario" onclick="revisarMCQ(${q.id}, '${escapeQuotes(q.respuesta)}', '${escapeQuotes(q.explicacion || "")}')">Revisar</button>
                <p id="r${q.id}" class="meta"></p>
              </div>
            </div>
          `;
        }

        return `
          <div class="cardbox">
            <h3>${idx + 1}. ${escapeHtml(q.pregunta)}</h3>
            <input id="in${q.id}" type="text" placeholder="Tu respuesta"
              style="padding:10px;border-radius:12px;border:1px solid #d1d5db;width:min(360px,100%)">
            <div style="margin-top:10px">
              <button class="btn-secundario" onclick="revisarAbierta(${q.id}, '${escapeQuotes(q.respuesta)}', '${escapeQuotes(q.explicacion || "")}')">Revisar</button>
              <p id="r${q.id}" class="meta"></p>
            </div>
          </div>
        `;
      })
      .join("");
  } catch (e) {
    quizCont.innerHTML = `<div class="cardbox">❌ Error cargando quiz.</div>`;
  }
}

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

    const res = await fetch(`/api/ejercicio/random/${subtemaId}`);
    if (!res.ok) throw new Error("No se pudo cargar práctica");

    ejercicioActual = await res.json();
    if (preguntaEl) preguntaEl.textContent = ejercicioActual.pregunta;
  } catch (e) {
    if (preguntaEl) preguntaEl.textContent = "❌ Error cargando práctica.";
  }
}

async function guardarResultado(tipo, puntaje, total) {
  try {
    await fetchAuth("/api/resultados", {
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
// Carga inicial
// ======================
validarSesionOnLoad();
cargarIntro();
cargarPractica();