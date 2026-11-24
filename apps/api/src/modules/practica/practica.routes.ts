import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { PracticaPregunta, PracticaVerificacion } from "@lv/shared";
import { db, schema } from "../../db/client.js";
import { generarEjercicio } from "../../generadores/index.js";
import { requiereSesion, sesionDe } from "../../middleware/auth.js";
import { esRespuestaCorrecta } from "../../shared/calificacion.js";
import { AppError } from "../../shared/errores.js";
import { paramId, validar } from "../../shared/http.js";
import { firmarPractica, leerPractica } from "../auth/token.js";
import { verificarAcceso } from "../catalogo/acceso.js";

export const practicaRouter = Router();

/** Ejercicio nuevo de práctica: la respuesta viaja firmada dentro del token, no visible. */
practicaRouter.get("/subtemas/:id/practica", requiereSesion, (req, res) => {
  const subtemaId = paramId(req);
  verificarAcceso(sesionDe(req), subtemaId);

  const filas = db.select().from(schema.generadores).where(eq(schema.generadores.subtemaId, subtemaId)).all();
  const ej = generarEjercicio(filas);
  if (!ej) throw new AppError(404, "Este subtema todavía no tiene ejercicios de práctica", "SIN_PRACTICA");

  const salida: PracticaPregunta = {
    pregunta: { indice: 0, tipo: ej.tipo, enunciado: ej.enunciado, opciones: ej.opciones, apoyo: ej.apoyo },
    token: firmarPractica({ r: ej.respuesta, t: ej.tipo, e: ej.explicacion ?? null, s: subtemaId }),
  };
  res.json(salida);
});

practicaRouter.post("/practica/verificar", requiereSesion, (req, res) => {
  const body = validar(z.object({ token: z.string().min(10), respuesta: z.string().max(200) }), req.body);
  const datos = leerPractica(body.token);
  if (!datos) throw new AppError(400, "Este ejercicio venció. Pide uno nuevo.", "PRACTICA_VENCIDA");

  const tipo = datos.t as "mcq" | "vf" | "abierta";
  const salida: PracticaVerificacion = {
    correcta: esRespuestaCorrecta(tipo, body.respuesta, datos.r),
    respuestaCorrecta: tipo === "vf" ? (datos.r === "V" ? "Verdadero" : "Falso") : datos.r,
    explicacion: datos.e ?? null,
  };
  res.json(salida);
});
