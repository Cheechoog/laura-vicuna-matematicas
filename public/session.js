// public/session.js
// Sesión unificada: estudiante + profesor
// ✅ token SIEMPRE en localStorage.token
// ✅ profesor marcado con localStorage.teacher="1"
// ✅ navegación inteligente
// ✅ home para profesor = index
// ✅ home para estudiante = grado actual
// ✅ volver inteligente sin caer en seleccionar/login

function clearStudentSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("estudianteId");
  localStorage.removeItem("grupoId");
  localStorage.removeItem("estudianteNombre");
  localStorage.removeItem("gradoId");
}

function clearTeacherSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("teacher");
}

function clearSession() {
  clearStudentSession();
  localStorage.removeItem("teacher");
}

function isTeacher() {
  return localStorage.getItem("teacher") === "1";
}

function getAuthToken() {
  return localStorage.getItem("token");
}

function getStoredGradeId() {
  return localStorage.getItem("gradoId");
}

function getNextUrl() {
  return window.location.pathname + window.location.search;
}

function buildUrl(pathname, params = {}) {
  const url = new URL(pathname, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== "") {
      url.searchParams.set(k, String(v));
    }
  });
  return url.pathname + url.search;
}

function redirectToSeleccionar(gradoId) {
  if (isTeacher()) return;

  const next = encodeURIComponent(getNextUrl());
  const g = gradoId ? `&gradoId=${encodeURIComponent(gradoId)}` : "";
  window.location.href = `seleccionar.html?next=${next}${g}`;
}

function requireSession(gradoIdOpcional) {
  if (isTeacher()) return true;

  const token = localStorage.getItem("token");
  if (!token) {
    redirectToSeleccionar(gradoIdOpcional);
    return false;
  }
  return true;
}

function requireGrade(expectedGradoId) {
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

function getInitials(nombre) {
  const partes = String(nombre || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "US";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

async function fetchAuth(url, options = {}, gradoIdForRedirect = null) {
  const token = getAuthToken();

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
    if (isTeacher()) {
      clearTeacherSession();
      window.location.href = "profesor.html";
      throw new Error("Sesión profesor vencida");
    } else {
      clearStudentSession();
      redirectToSeleccionar(gradoIdForRedirect);
      throw new Error("No autorizado / token vencido");
    }
  }

  return res;
}

function getStudentAcademicHomeUrl() {
  const gradoId = getStoredGradeId();
  if (!gradoId) return "index.html";
  return buildUrl("grado.html", { gradoId });
}

function getTeacherHomeUrl() {
  return "index.html";
}

function getHomeUrl() {
  return isTeacher() ? getTeacherHomeUrl() : getStudentAcademicHomeUrl();
}

function getSmartBackUrl() {
  const pathname = window.location.pathname.toLowerCase();
  const params = new URLSearchParams(window.location.search);

  const gradoId = params.get("gradoId") || getStoredGradeId();
  const periodoId = params.get("periodoId");
  const periodo = params.get("periodo");
  const temaId = params.get("temaId");
  const tema = params.get("tema");

  if (isTeacher()) {
    if (pathname.endsWith("/grado.html")) {
      return "index.html";
    }

    if (pathname.endsWith("/periodo.html")) {
      return buildUrl("grado.html", { gradoId });
    }

    if (pathname.endsWith("/tema.html")) {
      if (gradoId && periodoId) {
        return buildUrl("periodo.html", { gradoId, periodoId, periodo });
      }
      return buildUrl("grado.html", { gradoId });
    }

    if (pathname.endsWith("/subtema.html")) {
      if (gradoId && temaId) {
        return buildUrl("tema.html", { gradoId, periodoId, periodo, temaId, tema });
      }
      if (gradoId && periodoId) {
        return buildUrl("periodo.html", { gradoId, periodoId, periodo });
      }
      return buildUrl("grado.html", { gradoId });
    }

    return "index.html";
  }

  if (pathname.endsWith("/grado.html")) {
    return getStudentAcademicHomeUrl();
  }

  if (pathname.endsWith("/periodo.html")) {
    return buildUrl("grado.html", { gradoId });
  }

  if (pathname.endsWith("/tema.html")) {
    return buildUrl("periodo.html", { gradoId, periodoId, periodo });
  }

  if (pathname.endsWith("/subtema.html")) {
    if (temaId) {
      return buildUrl("tema.html", { gradoId, periodoId, periodo, temaId, tema });
    }
    return buildUrl("periodo.html", { gradoId, periodoId, periodo });
  }

  return getStudentAcademicHomeUrl();
}

function isSamePageUrl(targetUrl) {
  try {
    const a = new URL(targetUrl, window.location.origin);
    const b = new URL(window.location.href);
    return a.pathname === b.pathname && a.search === b.search;
  } catch {
    return false;
  }
}

function setupNavigationButtons() {
  const btnBack = document.getElementById("btn-back");
  const btnHome = document.getElementById("btn-home");

  const token = getAuthToken();

  if (btnHome) {
    if (!token) {
      btnHome.style.display = "none";
    } else {
      const homeUrl = getHomeUrl();

      if (isSamePageUrl(homeUrl)) {
        btnHome.style.display = "none";
      } else {
        btnHome.style.display = "inline-flex";
        btnHome.setAttribute("href", homeUrl);
        btnHome.onclick = null;
      }
    }
  }

  if (btnBack) {
    if (!token) {
      if (window.location.pathname.toLowerCase().includes("seleccionar.html")) {
        btnBack.setAttribute("href", "index.html");
      }
      return;
    }

    const backUrl = getSmartBackUrl();

    if (isSamePageUrl(backUrl)) {
      btnBack.style.display = "none";
    } else {
      btnBack.style.display = "inline-flex";
      btnBack.setAttribute("href", backUrl);
      btnBack.onclick = null;
    }
  }
}

async function renderGlobalSessionArea() {
  const area =
    document.getElementById("global-session-area") ||
    document.getElementById("session-badge");

  if (!area) return;

  const token = getAuthToken();
  if (!token) {
    area.innerHTML = "";
    return;
  }

  if (isTeacher()) {
    area.innerHTML = `
      <div class="user-pill teacher-pill">
        <div class="user-pill-avatar">👩‍🏫</div>
        <div class="user-pill-text">
          <strong>Profesor</strong>
          <span>Acceso total</span>
        </div>
      </div>
    `;
    return;
  }

  try {
    const res = await fetch("/api/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      area.innerHTML = "";
      return;
    }

    const me = await res.json();
    const initials = getInitials(me?.nombre || "Estudiante");

    area.innerHTML = `
      <div class="user-pill student-pill">
        <div class="user-pill-avatar">${escapeHtml(initials)}</div>
        <div class="user-pill-text">
          <strong>${escapeHtml(me?.nombre || "Estudiante")}</strong>
          <span>${escapeHtml(me?.grado_nombre || "Sesión activa")}</span>
        </div>
      </div>
    `;
  } catch {
    area.innerHTML = "";
  }
}

function setupLogoutButton() {
  const btn = document.getElementById("btn-logout");
  if (!btn) return;

  const token = getAuthToken();

  if (!token) {
    btn.style.display = "none";
    return;
  }

  btn.style.display = "inline-flex";
  btn.textContent = "Cerrar sesión";

  if (btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";

  if (isTeacher()) {
    btn.addEventListener("click", () => {
      clearTeacherSession();
      window.location.href = "index.html";
    });
    return;
  }

  btn.addEventListener("click", () => {
    clearStudentSession();
    window.location.href = "index.html";
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  setupNavigationButtons();
  setupLogoutButton();
  await renderGlobalSessionArea();
});

window.clearSession = clearSession;
window.clearStudentSession = clearStudentSession;
window.clearTeacherSession = clearTeacherSession;
window.isTeacher = isTeacher;
window.requireSession = requireSession;
window.requireGrade = requireGrade;
window.fetchAuth = fetchAuth;
window.toast = toast;
window.getStudentAcademicHomeUrl = getStudentAcademicHomeUrl;
window.getHomeUrl = getHomeUrl;
window.getSmartBackUrl = getSmartBackUrl;