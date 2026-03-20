function $(id) {
  return document.getElementById(id);
}

function setMsg(id, text, ok = true) {
  const el = $(id);
  if (!el) return;
  el.textContent = text || "";
  el.style.color = ok ? "#d9fbe7" : "#fecaca";
}

function clearTeacherSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("teacher");
}

function isTeacher() {
  return localStorage.getItem("teacher") === "1";
}

async function fetchTeacher(url, options = {}) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Sin token");

  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    clearTeacherSession();
    throw new Error("No autorizado (token inválido o vencido)");
  }

  return res;
}

function scoreClass(value) {
  if (value == null || value === "") return "empty";
  const n = Number(value);
  if (n >= 4.0) return "good";
  if (n >= 3.0) return "mid";
  return "low";
}

function toIsoOrNull(value) {
  if (!value) return null;
  try {
    return new Date(value).toISOString();
  } catch {
    return null;
  }
}

// refs
const loginBox = $("login-box");
const panelBox = $("panel-box");

const btnLogin = $("btn-login");
const pinInput = $("pin");
const btnLogout = $("btn-logout");

const gradoSel = $("grado");
const periodoSel = $("periodo");
const temaSel = $("tema");
const disponibleDesdeInput = $("disponible-desde");

const btnCargarPeriodos = $("btn-cargar-periodos");
const btnCargar = $("btn-cargar");
const btnHabilitarSeleccion = $("btn-habilitar-seleccion");
const btnBloquearSeleccion = $("btn-bloquear-seleccion");
const btnVerNotas = $("btn-ver-notas");

const lista = $("lista");

// modal notas
const notasModal = $("notas-modal");
const btnCerrarModal = $("btn-cerrar-modal");
const btnConsultarNotas = $("btn-consultar-notas");
const btnExportarNotas = $("btn-exportar-notas");

const notasGrado = $("notas-grado");
const notasPeriodo = $("notas-periodo");
const notasGrupo = $("notas-grupo");
const notasBody = $("notas-body");

let currentSubtemas = [];

async function teacherLogin(pin) {
  const res = await fetch("/api/profesor/sesion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Error de login");

  localStorage.setItem("token", data.token);
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
  const token = localStorage.getItem("token");
  if (!token || !isTeacher()) return false;

  try {
    const res = await fetchTeacher("/api/me");
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({}));
    return data?.role === "teacher";
  } catch {
    return false;
  }
}

async function cargarGradosEnSelect(selectEl, emptyText = "Selecciona grado") {
  if (!selectEl) return;

  const res = await fetch("/api/grados");
  const rows = await res.json();

  selectEl.innerHTML = `<option value="">${emptyText}</option>`;
  rows.forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.nombre;
    selectEl.appendChild(opt);
  });
}

async function cargarPeriodos(gradoId, targetSelect, includeAll = false) {
  if (!targetSelect) return;

  if (!gradoId) {
    targetSelect.innerHTML = includeAll
      ? `<option value="">Todos los periodos</option>`
      : `<option value="">Selecciona periodo</option>`;
    return;
  }

  const res = await fetch(`/api/periodos/${encodeURIComponent(gradoId)}`);
  const rows = await res.json();

  targetSelect.innerHTML = includeAll
    ? `<option value="">Todos los periodos</option>`
    : `<option value="">Selecciona periodo</option>`;

  rows.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.nombre;
    targetSelect.appendChild(opt);
  });
}

async function cargarTemas(gradoId, periodoId) {
  if (!temaSel) return;

  if (!gradoId || !periodoId) {
    temaSel.innerHTML = `<option value="">Selecciona tema</option>`;
    return;
  }

  const res = await fetch(
    `/api/temas/grado/${encodeURIComponent(gradoId)}/periodo/${encodeURIComponent(periodoId)}`
  );
  const rows = await res.json();

  temaSel.innerHTML = `<option value="">Selecciona tema</option>`;
  rows.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.nombre;
    temaSel.appendChild(opt);
  });
}

async function cargarGruposNotas(gradoId) {
  if (!notasGrupo) return;

  if (!gradoId) {
    notasGrupo.innerHTML = `<option value="">Todos los grupos</option>`;
    return;
  }

  const res = await fetch(`/api/grupos?gradoId=${encodeURIComponent(gradoId)}`);
  const rows = await res.json();

  notasGrupo.innerHTML = `<option value="">Todos los grupos</option>`;
  rows.forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.nombre;
    notasGrupo.appendChild(opt);
  });
}

function renderSubtemas(rows, resumenRows) {
  if (!lista) return;

  const map = {};
  if (Array.isArray(resumenRows)) {
    resumenRows.forEach((r) => {
      map[r.subtema_id] = r;
    });
  }

  currentSubtemas = Array.isArray(rows) ? rows : [];
  lista.innerHTML = "";

  if (!currentSubtemas.length) {
    lista.innerHTML = `<div class="teacher-empty">No hay subtemas para este tema.</div>`;
    return;
  }

  currentSubtemas.forEach((s) => {
    const r = map[s.id] || {};
    const habilitado = Number(r.habilitado || 0) === 1;
    const disponible = Number(r.disponible || 0) === 1;

    const card = document.createElement("div");
    card.className = "teacher-subtema-card";

    card.innerHTML = `
      <div class="teacher-subtema-left">
        <h4>${s.nombre}</h4>
        <p>${r.disponible_desde ? `Disponible desde: ${r.disponible_desde}` : "Disponible inmediatamente si está habilitado."}</p>
      </div>

      <div class="teacher-subtema-right">
        <span class="teacher-pill ${disponible ? "ok" : "off"}">
          ${disponible ? "Disponible" : "Bloqueado"}
        </span>

        <label class="teacher-switch" title="${habilitado ? "Deshabilitar" : "Habilitar"}">
          <input type="checkbox" ${habilitado ? "checked" : ""} data-subtema="${s.id}">
          <span class="teacher-switch-slider"></span>
        </label>
      </div>
    `;

    lista.appendChild(card);
  });

  lista.querySelectorAll('input[type="checkbox"][data-subtema]').forEach((input) => {
    input.addEventListener("change", async () => {
      const subtemaId = Number(input.getAttribute("data-subtema"));
      const habilitado = input.checked;
      const disponible_desde = toIsoOrNull(disponibleDesdeInput?.value || "");

      try {
        setMsg("panel-msg", "Guardando cambio...", true);

        const res = await fetchTeacher(`/api/profesor/subtema/${subtemaId}/disponibilidad`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ habilitado, disponible_desde }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "No se pudo guardar");

        setMsg("panel-msg", "✅ Cambio guardado correctamente", true);
        await recargarSubtemasActuales();
      } catch (e) {
        input.checked = !habilitado;
        setMsg("panel-msg", `❌ ${e.message}`, false);
      }
    });
  });
}

async function recargarSubtemasActuales() {
  const temaId = temaSel?.value;
  if (!temaId) return;

  const [resSubtemas, resResumen] = await Promise.all([
    fetch(`/api/subtemas/${encodeURIComponent(temaId)}`),
    fetch(`/api/tema/${encodeURIComponent(temaId)}/resumen`),
  ]);

  const rows = await resSubtemas.json();
  const resumen = await resResumen.json();

  renderSubtemas(rows, resumen);
}

async function aplicarSeleccion(habilitado) {
  const temaId = temaSel?.value;
  if (!temaId) {
    setMsg("panel-msg", "❌ Selecciona un tema", false);
    return;
  }

  try {
    setMsg("panel-msg", "Aplicando cambios...", true);

    const disponible_desde = toIsoOrNull(disponibleDesdeInput?.value || "");

    for (const s of currentSubtemas) {
      await fetchTeacher(`/api/profesor/subtema/${encodeURIComponent(s.id)}/disponibilidad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habilitado, disponible_desde }),
      });
    }

    setMsg("panel-msg", "✅ Cambios aplicados correctamente", true);
    await recargarSubtemasActuales();
  } catch (e) {
    setMsg("panel-msg", `❌ ${e.message}`, false);
  }
}

function formatScore(value) {
  if (value == null || value === "") {
    return `<span class="teacher-score empty">—</span>`;
  }
  const n = Number(value);
  return `<span class="teacher-score ${scoreClass(n)}">${n.toFixed(1)}</span>`;
}

function renderNotas(rows) {
  if (!notasBody) return;

  notasBody.innerHTML = "";

  if (!Array.isArray(rows) || rows.length === 0) {
    notasBody.innerHTML = `
      <tr>
        <td colspan="8">No hay notas registradas para este filtro.</td>
      </tr>
    `;
    return;
  }

  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.grupo_nombre || ""}</td>
      <td>${r.estudiante_nombre || ""}</td>
      <td>${r.periodo_nombre || ""}</td>
      <td>${r.tema_nombre || ""}</td>
      <td>${r.subtema_nombre || ""}</td>
      <td class="teacher-cell-center">${formatScore(r.nota_taller)}</td>
      <td class="teacher-cell-center">${formatScore(r.nota_quiz)}</td>
      <td class="teacher-cell-center">${formatScore(r.promedio)}</td>
    `;
    notasBody.appendChild(tr);
  });
}

function openNotasModal() {
  if (!notasModal) return;
  notasModal.classList.add("open");
  notasModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeNotasModal() {
  if (!notasModal) return;
  notasModal.classList.remove("open");
  notasModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

async function verNotas() {
  try {
    const gradoId = notasGrado?.value || "";
    const periodoId = notasPeriodo?.value || "";
    const grupoId = notasGrupo?.value || "";

    if (!gradoId) {
      setMsg("notas-msg", "❌ Selecciona un grado", false);
      return;
    }

    setMsg("notas-msg", "Cargando notas...", true);

    const params = new URLSearchParams();
    params.set("gradoId", gradoId);
    if (periodoId) params.set("periodoId", periodoId);
    if (grupoId) params.set("grupoId", grupoId);

    const res = await fetchTeacher(`/api/profesor/notas/resumen?${params.toString()}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data?.error || "No se pudieron cargar las notas");

    renderNotas(data);
    setMsg("notas-msg", "✅ Notas cargadas correctamente", true);
  } catch (e) {
    renderNotas([]);
    setMsg("notas-msg", `❌ ${e.message}`, false);
  }
}

async function exportarNotas() {
  try {
    const gradoId = notasGrado?.value || "";
    const periodoId = notasPeriodo?.value || "";
    const grupoId = notasGrupo?.value || "";

    if (!gradoId) {
      setMsg("notas-msg", "❌ Selecciona un grado para exportar", false);
      return;
    }

    setMsg("notas-msg", "Preparando Excel...", true);

    const params = new URLSearchParams();
    params.set("gradoId", gradoId);
    if (periodoId) params.set("periodoId", periodoId);
    if (grupoId) params.set("grupoId", grupoId);

    const token = localStorage.getItem("token");
    const res = await fetch(`/api/profesor/notas/exportar?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const maybeJson = await res.json().catch(() => ({}));
      throw new Error(maybeJson?.error || "No se pudo exportar el Excel");
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "notas.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setMsg("notas-msg", "✅ Excel descargado correctamente", true);
  } catch (e) {
    setMsg("notas-msg", `❌ ${e.message}`, false);
  }
}

// eventos
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
      window.location.href = "index.html";
    } catch (e) {
      setMsg("login-msg", `❌ ${e.message}`, false);
    }
  });
}

if (pinInput) {
  pinInput.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      btnLogin?.click();
    }
  });
}

if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    clearTeacherSession();
    window.location.href = "index.html";
  });
}

if (btnCargarPeriodos) {
  btnCargarPeriodos.addEventListener("click", async () => {
    const gradoId = gradoSel?.value;
    if (!gradoId) {
      setMsg("panel-msg", "❌ Selecciona primero un grado", false);
      return;
    }

    await cargarPeriodos(gradoId, periodoSel, false);
    temaSel.innerHTML = `<option value="">Selecciona tema</option>`;
    lista.innerHTML = `<div class="teacher-empty">Selecciona un tema y carga sus subtemas para administrarlos aquí.</div>`;
    setMsg("panel-msg", "✅ Periodos cargados", true);
  });
}

if (periodoSel) {
  periodoSel.addEventListener("change", async () => {
    const gradoId = gradoSel?.value;
    const periodoId = periodoSel?.value;

    if (!gradoId || !periodoId) {
      temaSel.innerHTML = `<option value="">Selecciona tema</option>`;
      return;
    }

    await cargarTemas(gradoId, periodoId);
  });
}

if (btnCargar) {
  btnCargar.addEventListener("click", async () => {
    const temaId = temaSel?.value;
    if (!temaId) {
      setMsg("panel-msg", "❌ Selecciona un tema", false);
      return;
    }

    try {
      setMsg("panel-msg", "Cargando subtemas...", true);
      await recargarSubtemasActuales();
      setMsg("panel-msg", "✅ Subtemas cargados", true);
    } catch (e) {
      setMsg("panel-msg", `❌ ${e.message}`, false);
    }
  });
}

if (btnHabilitarSeleccion) {
  btnHabilitarSeleccion.addEventListener("click", async () => {
    await aplicarSeleccion(true);
  });
}

if (btnBloquearSeleccion) {
  btnBloquearSeleccion.addEventListener("click", async () => {
    await aplicarSeleccion(false);
  });
}

if (btnVerNotas) {
  btnVerNotas.addEventListener("click", async () => {
    openNotasModal();

    if (!notasGrado.dataset.loaded) {
      await cargarGradosEnSelect(notasGrado);
      notasGrado.dataset.loaded = "1";
    }
  });
}

if (btnCerrarModal) {
  btnCerrarModal.addEventListener("click", closeNotasModal);
}

if (notasModal) {
  notasModal.addEventListener("click", (e) => {
    if (e.target === notasModal) closeNotasModal();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeNotasModal();
  }
});

if (notasGrado) {
  notasGrado.addEventListener("change", async () => {
    const gradoId = notasGrado.value;
    await cargarPeriodos(gradoId, notasPeriodo, true);
    await cargarGruposNotas(gradoId);
    renderNotas([]);
    setMsg("notas-msg", "", true);
  });
}

if (btnConsultarNotas) {
  btnConsultarNotas.addEventListener("click", async () => {
    await verNotas();
  });
}

if (btnExportarNotas) {
  btnExportarNotas.addEventListener("click", async () => {
    await exportarNotas();
  });
}

(async function init() {
  const ok = await validarSesionProfesor();
  if (!ok) {
    showLogin();
    return;
  }

  showPanel();
  await cargarGradosEnSelect(gradoSel);
})();
