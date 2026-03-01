// public/js/profesor.js
// Panel del profesor para habilitar/bloquear subtemas sin consola.

function $(id) {
  return document.getElementById(id);
}

const LS_TOKEN = "teacherToken";

// UI
const loginBox = $("login-box");
const panelBox = $("panel-box");
const loginMsg = $("login-msg");
const panelMsg = $("panel-msg");

const pinInp = $("pin");
const btnLogin = $("btn-login");
const btnLogout = $("btn-logout");

const selGrado = $("grado");
const selTema = $("tema");
const btnCargar = $("btn-cargar");

const btnHabTodos = $("btn-habilitar-todos");
const btnBloqTodos = $("btn-bloquear-todos");
const inpDisponibleDesde = $("disponible-desde");

const lista = $("lista");

// Helpers
function setMsg(el, text, ok = true) {
  if (!el) return;
  el.textContent = text || "";
  el.style.opacity = text ? "1" : "0";
  el.style.color = ok ? "" : "#ffb4b4";
}

function getTeacherToken() {
  return localStorage.getItem(LS_TOKEN);
}

function setTeacherToken(t) {
  if (t) localStorage.setItem(LS_TOKEN, t);
  else localStorage.removeItem(LS_TOKEN);
}

async function fetchTeacher(url, options = {}) {
  const token = getTeacherToken();
  if (!token) throw new Error("Sin sesión de profesor");

  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    // token vencido
    setTeacherToken(null);
    throw new Error("Sesión de profesor vencida. Vuelve a iniciar.");
  }
  return res;
}

function toSqliteDatetimeFromLocal(dtLocalValue) {
  // input datetime-local => "YYYY-MM-DDTHH:mm"
  // sqlite datetime('now') usa "YYYY-MM-DD HH:MM:SS"
  if (!dtLocalValue) return null;
  const s = String(dtLocalValue);
  const [date, time] = s.split("T");
  if (!date || !time) return null;
  return `${date} ${time}:00`;
}

// Login profesor
async function loginTeacher(pin) {
  const res = await fetch("/api/profesor/sesion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "No se pudo iniciar sesión profesor");

  setTeacherToken(data.token);
  return true;
}

async function checkTeacherSession() {
  const token = getTeacherToken();
  if (!token) return false;

  try {
    const res = await fetch("/api/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Sesión inválida");
    const me = await res.json();
    return me?.role === "teacher";
  } catch {
    setTeacherToken(null);
    return false;
  }
}

function showLogin() {
  loginBox.style.display = "";
  panelBox.style.display = "none";
  btnLogout.style.display = "none";
  setMsg(loginMsg, "");
  setMsg(panelMsg, "");
}

function showPanel() {
  loginBox.style.display = "none";
  panelBox.style.display = "";
  btnLogout.style.display = "";
  setMsg(loginMsg, "");
  setMsg(panelMsg, "");
}

// Cargar grados/temas
async function cargarGrados() {
  const res = await fetch("/api/grados");
  const grados = await res.json();

  selGrado.innerHTML = `<option value="">Selecciona grado</option>` +
    (Array.isArray(grados) ? grados.map(g => `<option value="${g.id}">${g.nombre}</option>`).join("") : "");
}

async function cargarTemas(gradoId) {
  selTema.innerHTML = `<option value="">Cargando...</option>`;
  if (!gradoId) {
    selTema.innerHTML = `<option value="">Selecciona tema</option>`;
    return;
  }

  const res = await fetch(`/api/temas/${encodeURIComponent(gradoId)}`);
  const temas = await res.json();

  selTema.innerHTML = `<option value="">Selecciona tema</option>` +
    (Array.isArray(temas) ? temas.map(t => `<option value="${t.id}">${t.nombre}</option>`).join("") : "");
}

// Render subtemas
function renderSubtemas(subtemas) {
  lista.innerHTML = "";

  if (!Array.isArray(subtemas) || subtemas.length === 0) {
    lista.innerHTML = `<div class="card"><div><h3>No hay subtemas</h3><p class="meta">Este tema no tiene subtemas.</p></div></div>`;
    return;
  }

  subtemas
    .sort((a, b) => (Number(a.orden || 0) - Number(b.orden || 0)))
    .forEach(st => {
      const habilitado = Number(st.habilitado || 0) === 1;
      const desde = st.disponible_desde ? String(st.disponible_desde) : null;

      const card = document.createElement("div");
      card.className = "card";

      const left = document.createElement("div");
      left.style.flex = "1";

      const h = document.createElement("h3");
      h.textContent = st.nombre || `Subtema ${st.id}`;

      const meta = document.createElement("p");
      meta.className = "meta";
      meta.textContent = `ID: ${st.id}` + (desde ? ` · Disponible desde: ${desde}` : "");

      const pill = document.createElement("span");
      pill.className = `pill ${habilitado ? "pill-ok" : "pill-off"}`;
      pill.textContent = habilitado ? "✅ Habilitado" : "🔒 Bloqueado";

      left.appendChild(h);
      left.appendChild(meta);
      left.appendChild(pill);

      const right = document.createElement("div");
      right.className = "switch";

      const toggle = document.createElement("div");
      toggle.className = `toggle ${habilitado ? "on" : ""}`;
      toggle.title = "Habilitar/Bloquear";

      toggle.addEventListener("click", async () => {
        try {
          toggle.style.pointerEvents = "none";
          setMsg(panelMsg, "Guardando...", true);

          const newVal = !toggle.classList.contains("on");
          const disponible_desde = toSqliteDatetimeFromLocal(inpDisponibleDesde.value);

          const res = await fetchTeacher(`/api/profesor/subtema/${st.id}/disponibilidad`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              habilitado: newVal,
              disponible_desde: disponible_desde, // puede ser null
            }),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || "No se pudo guardar");

          // actualizar UI
          if (newVal) toggle.classList.add("on");
          else toggle.classList.remove("on");

          pill.className = `pill ${newVal ? "pill-ok" : "pill-off"}`;
          pill.textContent = newVal ? "✅ Habilitado" : "🔒 Bloqueado";

          // meta fecha
          const desdeTxt = disponible_desde ? ` · Disponible desde: ${disponible_desde}` : "";
          meta.textContent = `ID: ${st.id}` + desdeTxt;

          setMsg(panelMsg, "✅ Guardado", true);
          setTimeout(() => setMsg(panelMsg, ""), 900);
        } catch (e) {
          setMsg(panelMsg, `❌ ${e.message}`, false);
        } finally {
          toggle.style.pointerEvents = "";
        }
      });

      right.appendChild(toggle);

      card.appendChild(left);
      card.appendChild(right);

      lista.appendChild(card);
    });
}

// Cargar subtemas (con habilitado/disponible_desde)
async function cargarSubtemas(temaId) {
  if (!temaId) {
    setMsg(panelMsg, "Selecciona un tema.", false);
    return;
  }

  setMsg(panelMsg, "Cargando subtemas...", true);
  lista.innerHTML = "";

  const res = await fetch(`/api/subtemas/${encodeURIComponent(temaId)}`);
  const subtemas = await res.json();

  renderSubtemas(subtemas);
  setMsg(panelMsg, "✅ Listo", true);
  setTimeout(() => setMsg(panelMsg, ""), 900);
}

// Acciones masivas
async function setTodos(temaId, habilitado) {
  if (!temaId) {
    setMsg(panelMsg, "Selecciona un tema.", false);
    return;
  }

  try {
    setMsg(panelMsg, "Aplicando cambios a todos...", true);

    const r = await fetch(`/api/subtemas/${encodeURIComponent(temaId)}`);
    const subtemas = await r.json();

    if (!Array.isArray(subtemas) || subtemas.length === 0) {
      setMsg(panelMsg, "No hay subtemas en este tema.", false);
      return;
    }

    const disponible_desde = toSqliteDatetimeFromLocal(inpDisponibleDesde.value);

    // aplicar uno por uno (simple y seguro para entorno local)
    for (const st of subtemas) {
      const res = await fetchTeacher(`/api/profesor/subtema/${st.id}/disponibilidad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habilitado, disponible_desde }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Fallo en subtema ${st.id}`);
    }

    await cargarSubtemas(temaId);
    setMsg(panelMsg, "✅ Cambios aplicados a todos", true);
    setTimeout(() => setMsg(panelMsg, ""), 900);
  } catch (e) {
    setMsg(panelMsg, `❌ ${e.message}`, false);
  }
}

// Eventos UI
btnLogin.addEventListener("click", async () => {
  try {
    setMsg(loginMsg, "");
    const pin = String(pinInp.value || "").trim();
    if (!pin) {
      setMsg(loginMsg, "Escribe el PIN del profesor.", false);
      return;
    }

    setMsg(loginMsg, "Entrando...", true);
    await loginTeacher(pin);

    showPanel();
    await cargarGrados();
    setMsg(panelMsg, "✅ Sesión iniciada", true);
    setTimeout(() => setMsg(panelMsg, ""), 900);
  } catch (e) {
    setMsg(loginMsg, `❌ ${e.message}`, false);
  }
});

btnLogout.addEventListener("click", () => {
  setTeacherToken(null);
  showLogin();
});

selGrado.addEventListener("change", async () => {
  const gradoId = selGrado.value;
  await cargarTemas(gradoId);
  lista.innerHTML = "";
});

btnCargar.addEventListener("click", async () => {
  await cargarSubtemas(selTema.value);
});

btnHabTodos.addEventListener("click", async () => {
  await setTodos(selTema.value, true);
});

btnBloqTodos.addEventListener("click", async () => {
  await setTodos(selTema.value, false);
});

// Init
(async function init() {
  const ok = await checkTeacherSession();
  if (ok) {
    showPanel();
    await cargarGrados();
  } else {
    showLogin();
  }
})();