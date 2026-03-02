// public/session.js
// Sesión unificada: estudiante (token) + profesor (teacherToken)
// ✅ Profesor NO debe ir a seleccionar.html
// ✅ fetchAuth usa teacherToken si teacher=1

// -------------------------
// Storage helpers
// -------------------------
function clearSession() {
  // estudiante
  localStorage.removeItem("token");
  localStorage.removeItem("estudianteId");
  localStorage.removeItem("grupoId");
  localStorage.removeItem("estudianteNombre");
  localStorage.removeItem("gradoId");

  // profesor
  localStorage.removeItem("teacherToken");
  localStorage.removeItem("teacher");
}

function clearStudentSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("estudianteId");
  localStorage.removeItem("grupoId");
  localStorage.removeItem("estudianteNombre");
  localStorage.removeItem("gradoId");
}

function clearTeacherSession() {
  localStorage.removeItem("teacherToken");
  localStorage.removeItem("teacher");
}

function isTeacher() {
  return localStorage.getItem("teacher") === "1" && !!localStorage.getItem("teacherToken");
}

function getAuthToken() {
  // ✅ si es profesor, usa su token
  if (isTeacher()) return localStorage.getItem("teacherToken");
  // ✅ si no, token estudiante
  return localStorage.getItem("token");
}

function getNextUrl() {
  return window.location.pathname + window.location.search;
}

function redirectToSeleccionar(gradoId) {
  // ✅ IMPORTANTE: profesor NUNCA va a seleccionar
  if (isTeacher()) return;

  const next = encodeURIComponent(getNextUrl());
  const g = gradoId ? `&gradoId=${encodeURIComponent(gradoId)}` : "";
  window.location.href = `seleccionar.html?next=${next}${g}`;
}

// -------------------------
// Guards
// -------------------------
function requireSession(gradoIdOpcional) {
  // ✅ profesor pasa sin pedir login alumno
  if (isTeacher()) return true;

  const token = localStorage.getItem("token");
  if (!token) {
    redirectToSeleccionar(gradoIdOpcional);
    return false;
  }
  return true;
}

function requireGrade(expectedGradoId) {
  // ✅ profesor puede ver TODOS los grados
  if (isTeacher()) return true;

  const stored = localStorage.getItem("gradoId");
  if (!expectedGradoId) return true;
  if (!stored) return true;

  if (String(stored) !== String(expectedGradoId)) {
    toast("Grado incorrecto", "No puedes entrar a este grado con tu sesión actual.", "err");
    clearStudentSession();
    window.location.href = "index.html";
    return false;
  }
  return true;
}

// -------------------------
// Toast UI
// -------------------------
function ensureToastWrap() {
  let wrap = document.querySelector(".toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  return wrap;
}

function toast(title, message = "", type = "ok", ms = 2600) {
  try {
    const wrap = ensureToastWrap();
    const el = document.createElement("div");
    el.className = `toast ${type === "err" ? "err" : "ok"}`;
    el.innerHTML = `<b>${escapeHtml(title)}</b><div>${escapeHtml(message)}</div>`;
    wrap.appendChild(el);

    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(-6px)";
      setTimeout(() => el.remove(), 180);
    }, ms);
  } catch {
    alert(`${title}\n${message}`);
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

// -------------------------
// fetchAuth global (ÚNICO)
// -------------------------
// ✅ usa teacherToken si teacher=1
async function fetchAuth(url, options = {}, gradoIdForRedirect = null) {
  const token = getAuthToken();

  // si NO hay token, solo redirige si es alumno
  if (!token) {
    redirectToSeleccionar(gradoIdForRedirect);
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
    // ✅ si era profesor, lo mandamos a profesor.html
    if (isTeacher()) {
      clearTeacherSession();
      window.location.href = "profesor.html";
      throw new Error("Sesión profesor vencida");
    }

    // ✅ alumno -> seleccionar
    clearStudentSession();
    redirectToSeleccionar(gradoIdForRedirect);
    throw new Error("No autorizado / token vencido");
  }

  return res;
}

// -------------------------
// Logout button global
// -------------------------
function setupLogoutButton() {
  const btn = document.getElementById("btn-logout");
  if (!btn) return;

  // En seleccionar.html lo escondemos siempre
  if (window.location.pathname.includes("seleccionar.html")) {
    btn.style.display = "none";
    return;
  }

  // ✅ Si es profesor, NO mostramos el logout de alumno (opcional)
  // (si quieres logout para profesor, lo manejas en profesor.html)
  if (isTeacher()) {
    btn.style.display = "none";
    return;
  }

  const token = localStorage.getItem("token");
  btn.style.display = token ? "inline-flex" : "none";

  if (btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";

  btn.addEventListener("click", () => {
    clearStudentSession();
    window.location.href = "index.html";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupLogoutButton();
});

// Exporta a window
window.clearSession = clearSession;
window.clearStudentSession = clearStudentSession;
window.clearTeacherSession = clearTeacherSession;
window.isTeacher = isTeacher;
window.requireSession = requireSession;
window.requireGrade = requireGrade;
window.fetchAuth = fetchAuth;
window.toast = toast;