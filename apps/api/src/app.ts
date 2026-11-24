import fs from "node:fs";
import path from "node:path";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { cargarSesion } from "./middleware/auth.js";
import { manejadorErrores, rutaNoEncontrada } from "./middleware/errores.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { catalogoRouter } from "./modules/catalogo/catalogo.routes.js";
import { docenteRouter } from "./modules/docente/docente.routes.js";
import { evaluacionesRouter } from "./modules/evaluaciones/evaluaciones.routes.js";
import { practicaRouter } from "./modules/practica/practica.routes.js";

export function crearApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", false);
  app.use(
    helmet({
      // La plataforma corre en HTTP dentro de la red del colegio
      strictTransportSecurity: false,
      contentSecurityPolicy: {
        directives: {
          "upgrade-insecure-requests": null,
          "img-src": ["'self'", "data:"],
          "frame-src": ["'self'", "https://www.youtube-nocookie.com", "https://www.youtube.com"],
        },
      },
    })
  );
  app.use(express.json({ limit: "200kb" }));
  app.use(cookieParser());
  app.use(cargarSesion);

  // ---------- API ----------
  const api = express.Router();
  api.use("/auth", authRouter);
  api.use("/docente", docenteRouter);
  api.use(catalogoRouter);
  api.use(practicaRouter);
  api.use(evaluacionesRouter);
  api.use(rutaNoEncontrada);
  app.use("/api", api);

  // ---------- Frontend compilado (cuando existe apps/web/dist) ----------
  if (fs.existsSync(env.WEB_DIST)) {
    app.use(express.static(env.WEB_DIST, { index: false, maxAge: "1h" }));
    // Cualquier ruta que no sea /api la resuelve React Router
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(env.WEB_DIST, "index.html"));
    });
  }

  app.use(manejadorErrores);
  return app;
}
