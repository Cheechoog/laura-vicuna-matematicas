# 📚 Plataforma Educativa – Matemáticas (Laura Vicuña)

Plataforma web interactiva para la enseñanza de matemáticas en grados Sexto y Séptimo.

Desarrollada con arquitectura full-stack utilizando Node.js, Express y SQLite.

---

## 🚀 Características

- 🔐 Autenticación por PIN (sin usuario/contraseña tradicional)
- 🎓 Control por grado (Sexto / Séptimo)
- 📂 Navegación jerárquica:
  - Grado → Tema → Subtema
- 📖 Sistema de contenido por subtema:
  - Intro (HTML dinámico)
  - Talleres
  - Quiz (preguntas aleatorias)
  - Práctica dinámica generada por plantillas
- 🧠 Generador automático de ejercicios matemáticos
- 📊 Registro de resultados por estudiante
- ⏳ Token con expiración real (seguridad básica)
- 🗃 Base de datos relacional (SQLite)

---

## 🏗 Arquitectura

Backend:
- Node.js
- Express
- SQLite
- Token firmado con HMAC SHA256

Frontend:
- HTML5
- CSS3
- JavaScript Vanilla
- Fetch API

---

## 📂 Estructura del Proyecto
