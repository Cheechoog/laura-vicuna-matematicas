  // public/main.js

  function isTeacherSession() {
    return localStorage.getItem("teacher") === "1";
  }

  function rewriteGradeLinksForRole() {
    const teacher = isTeacherSession();
    const cards = document.querySelectorAll(".grade-card[data-grado]");

    cards.forEach((a) => {
      const gradoId = a.getAttribute("data-grado");
      if (!gradoId) return;

      if (teacher) {
        a.setAttribute("href", `grado.html?gradoId=${encodeURIComponent(gradoId)}`);
      } else {
        a.setAttribute("href", `seleccionar.html?gradoId=${encodeURIComponent(gradoId)}`);
      }
    });
  }

  function setupHomeTeacherCards() {
    const teacher = isTeacherSession();

    const teacherLoginCard = document.getElementById("teacher-login-card");
    const teacherAdminCard = document.getElementById("teacher-admin-card");

    if (teacher) {
      if (teacherLoginCard) teacherLoginCard.style.display = "none";
      if (teacherAdminCard) teacherAdminCard.style.display = "flex";
    } else {
      if (teacherLoginCard) teacherLoginCard.style.display = "flex";
      if (teacherAdminCard) teacherAdminCard.style.display = "none";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname.toLowerCase();
    if (!path.endsWith("/index.html") && !path.endsWith("/")) return;

    rewriteGradeLinksForRole();
    setupHomeTeacherCards();
  });