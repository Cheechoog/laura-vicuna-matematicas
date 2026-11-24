import { Router, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../../config/env.js";
import { requiereSesion, sesionDe } from "../../middleware/auth.js";
import { paramId, validar } from "../../shared/http.js";
import * as auth from "./auth.service.js";
import { COOKIE_SESION, firmarSesion, type PayloadSesion } from "./token.js";

export const authRouter = Router();

// Límite por dispositivo: frena a quien intente adivinar PINs en masa
const limiteIngreso = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Demasiados intentos desde este equipo. Espera unos minutos.", codigo: "LIMITE" },
});

function abrirSesion(res: Response, payload: PayloadSesion) {
  const { token, maxAgeMs } = firmarSesion(payload);
  res.cookie(COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // la plataforma corre en HTTP dentro de la red del colegio
    maxAge: maxAgeMs,
    path: "/",
  });
}

const pinSchema = z.string().trim().regex(/^\d{4,12}$/, "El PIN debe tener solo números (mínimo 4)");

authRouter.get("/grupos", (_req, res) => {
  res.json(auth.listarGrupos());
});

authRouter.get("/grupos/:id/estudiantes", (req, res) => {
  res.json(auth.listarEstudiantesDeGrupo(paramId(req)));
});

authRouter.post("/estudiante", limiteIngreso, (req, res) => {
  const body = validar(z.object({ estudianteId: z.number().int().positive(), pin: pinSchema }), req.body);
  const payload = auth.ingresarEstudiante(body.estudianteId, body.pin);
  abrirSesion(res, payload);
  res.json(auth.obtenerSesion(payload));
});

authRouter.post("/docente", limiteIngreso, (req, res) => {
  const body = validar(z.object({ usuario: z.string().trim().min(1), pin: pinSchema }), req.body);
  const payload = auth.ingresarDocente(body.usuario, body.pin);
  abrirSesion(res, payload);
  res.json(auth.obtenerSesion(payload));
});

authRouter.post("/salir", (_req, res) => {
  res.clearCookie(COOKIE_SESION, { path: "/" });
  res.status(204).end();
});

authRouter.get("/sesion", requiereSesion, (req, res) => {
  res.json(auth.obtenerSesion(sesionDe(req)));
});

if (!env.esProduccion) {
  authRouter.get("/_salud", (_req, res) => {
    res.json({ ok: true });
  });
}
