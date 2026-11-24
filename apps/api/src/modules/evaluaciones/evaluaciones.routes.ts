import { Router } from "express";
import { z } from "zod";
import { requiereEstudiante, sesionDe } from "../../middleware/auth.js";
import { paramId, validar } from "../../shared/http.js";
import { abrirEvaluacion, entregarEvaluacion } from "./evaluaciones.service.js";

export const evaluacionesRouter = Router();

const tipoSchema = z.object({ tipo: z.enum(["quiz", "taller"]) });

evaluacionesRouter.post("/subtemas/:id/evaluaciones", requiereEstudiante, (req, res) => {
  const { tipo } = validar(tipoSchema, req.body);
  res.json(abrirEvaluacion(sesionDe(req), paramId(req), tipo));
});

evaluacionesRouter.post("/evaluaciones/:id/entregar", requiereEstudiante, (req, res) => {
  const { respuestas } = validar(z.object({ respuestas: z.array(z.string().max(200)).max(50) }), req.body);
  res.json(entregarEvaluacion(sesionDe(req), paramId(req), respuestas));
});
