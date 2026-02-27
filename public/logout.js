function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("estudianteId");
  localStorage.removeItem("grupoId");
  localStorage.removeItem("estudianteNombre");
  localStorage.removeItem("gradoId");
  window.location.href = "index.html";
}

// Para usarlo en botones:
window.logout = logout;