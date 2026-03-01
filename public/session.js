// public/session.js

// -------------------------
// Storage helpers
// -------------------------
function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("estudianteId");
  localStorage.removeItem("grupoId");
  localStorage.removeItem("estudianteNombre");
  localStorage.removeItem("gradoId");
}

function getNextUrl() {
  return window.location.pathname + window.location.search;
}

function redirectToSeleccionar(gradoId) {
  const next = encodeURIComponent(getNextUrl());
  const g = gradoId ? `&gradoId=${encodeURIComponent(gradoId)}` : "";
  window.location.href = `seleccionar.html?next=${next}${g}`;
}

// -------------------------
// Guards
// -------------------------
function requireSession(gradoIdOpcional) {
  const token = localStorage.getItem("token");
  if (!token) {
    redirectToSeleccionar(gradoIdOpcional);
    return false;
  }
  return true;
}

function requireGrade(expectedGradoId) {
  const stored = localStorage.getItem("gradoId");
  if (!expectedGradoId) return true;
  if (!stored) return true;

  if (String(stored) !== String(expectedGradoId)) {
    toast("Grado incorrecto", "No puedes entrar a este grado con tu sesión actual.", "err");
    clearSession();
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
    // fallback
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
// uso:
//   fetchAuth("/api/...", { method:"POST", body: JSON.stringify(...) }, gradoId)
// si 401 => limpia y manda a seleccionar
async function fetchAuth(url, options = {}, gradoIdForRedirect = null) {
  const token = localStorage.getItem("token");

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
    clearSession();
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

  const token = localStorage.getItem("token");
  btn.style.display = token ? "inline-flex" : "none";

  if (btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";

  btn.addEventListener("click", () => {
    clearSession();
    window.location.href = "index.html";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupLogoutButton();
});

// Exporta a window (por si lo llamas desde otros scripts)
window.clearSession = clearSession;
window.requireSession = requireSession;
window.requireGrade = requireGrade;
window.fetchAuth = fetchAuth;
window.toast = toast;