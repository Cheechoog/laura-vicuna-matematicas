// public/js/profesor.js
// Panel profesor: login + habilitar/bloquear subtemas
// ✅ Profesor navega libremente por toda la app
// ✅ No depende de sesión de alumno
// ✅ No lo redirige a seleccionar nunca

function $(id) {
  return document.getElementById(id);
}

function setMsg(id, text, ok = true) {
  const el = $(id);
  if (!el) return;
  el.textContent = text || "";
  el.style.opacity = text ? "1" : "0.85";
  el.style.color = ok ? "#d1fae5" : "#fecaca";
}

function clearTeacherSession() {
  localStorage.removeItem("teacherToken");
  localStorage.removeItem("teacher");
}

function isTeacher() {
  return localStorage.getItem("teacher") === "1";
}

// ✅ IMPORTANTE: usa teacherToken, NO token
async function fetchTeacher(url, options = {}) {
  const token = localStorage.getItem("teacherToken");
  if (!token) throw new Error("Sin sesión profesor");

  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    clearTeacherSession();
    window.location.href = "profesor.html";
    throw new Error("Sesión vencida");
  }

  return res;
}

// -------------------------
// UI refs
// -------------------------
const loginBox = $("login-box");
const panelBox = $("panel-box");
const btnLogin = $("btn-login");
const pinInput = $("pin");
const btnLogout = $("btn-logout");

const gradoSel = $("grado");
const temaSel = $("tema");
const btnCargar = $("btn-cargar");

const btnHabilitarTodos = $("btn-habilitar-todos");
const btnBloquearTodos = $("btn-bloquear-todos");
const disponibleDesdeInput = $("disponible-desde");

const lista = $("lista");

// -------------------------
// Login profesor
// -------------------------
async function teacherLogin(pin) {
  const res = await fetch("/api/profesor/sesion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || "Error de login");
  }

  // ✅ GUARDAR TOKEN SEPARADO
  localStorage.setItem("teacherToken", data.token);
  localStorage.setItem("teacher", "1");

  return data;
}

function showLogin() {
  if (loginBox) loginBox.style.display = "block";
  if (panelBox) panelBox.style.display = "none";
  if (btnLogout) btnLogout.style.display = "none";
}

function showPanel() {
  if (loginBox) loginBox.style.display = "none";
  if (panelBox) panelBox.style.display = "block";
  if (btnLogout) btnLogout.style.display = "inline-flex";
}

async function validarSesionProfesor() {
  const token = localStorage.getItem("teacherToken");
  if (!token || !isTeacher()) return false;

  try {
    const res = await fetchTeacher("/api/me");
    const data = await res.json().catch(() => ({}));
    return data?.role === "teacher";
  } catch {
    return false;
  }
}

// -------------------------
// Cargar datos
// -------------------------
async function cargarGrados() {
  if (!gradoSel) return;

  gradoSel.innerHTML = `<option value="">Cargando...</option>`;
  const res = await fetch("/api/grados");
  const rows = await res.json();

  gradoSel.innerHTML = `<option value="">Selecciona grado</option>`;
  rows.forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.nombre;
    gradoSel.appendChild(opt);
  });
}

async function cargarTemas(gradoId) {
  if (!temaSel) return;

  temaSel.innerHTML = `<option value="">Cargando...</option>`;
  const res = await fetch(`/api/temas/${gradoId}`);
  const rows = await res.json();

  temaSel.innerHTML = `<option value="">Selecciona tema</option>`;
  rows.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.nombre;
    temaSel.appendChild(opt);
  });
}

async function cargarSubtemas(temaId) {
  if (!lista) return;

  lista.innerHTML = "Cargando...";

  const res = await fetch(`/api/subtemas/${temaId}`);
  const rows = await res.json();

  lista.innerHTML = "";

  rows.forEach((s) => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <h3>${s.nombre}</h3>
      <div style="display:flex; gap:10px; margin-top:10px;">
        <button class="btn btn-primary" onclick="window.location.href='subtema.html?subtemaId=${s.id}&subtema=${encodeURIComponent(s.nombre)}'">
          Ver subtema
        </button>
      </div>
    `;

    lista.appendChild(card);
  });
}

// -------------------------
// Events
// -------------------------
if (btnLogin) {
  btnLogin.addEventListener("click", async () => {
    try {
      setMsg("login-msg", "Ingresando...", true);

      const pin = (pinInput?.value || "").trim();
      if (!pin) {
        setMsg("login-msg", "❌ Escribe el PIN", false);
        return;
      }

      await teacherLogin(pin);

      // ✅ Entra a la app completa
      window.location.href = "index.html";
    } catch (e) {
      setMsg("login-msg", `❌ ${e.message}`, false);
    }
  });
}

if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    clearTeacherSession();
    window.location.href = "index.html";
  });
}

if (gradoSel) {
  gradoSel.addEventListener("change", async () => {
    const id = gradoSel.value;
    if (!id) return;
    await cargarTemas(id);
  });
}

if (btnCargar) {
  btnCargar.addEventListener("click", async () => {
    const temaId = temaSel?.value;
    if (!temaId) {
      setMsg("panel-msg", "❌ Selecciona un tema", false);
      return;
    }
    await cargarSubtemas(temaId);
  });
}

// -------------------------
// Init
// -------------------------
(async function init() {
  const ok = await validarSesionProfesor();

  if (!ok) {
    showLogin();
    return;
  }

  showPanel();
  await cargarGrados();
})();