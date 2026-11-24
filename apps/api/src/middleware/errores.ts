import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../shared/errores.js";
import { env } from "../config/env.js";

export const rutaNoEncontrada: RequestHandler = (req, res) => {
  res.status(404).json({ error: `La ruta ${req.method} ${req.path} no existe`, codigo: "RUTA_NO_ENCONTRADA" });
};

export const manejadorErrores: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message, codigo: err.codigo, datos: err.datos });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "El cuerpo de la petición no es JSON válido", codigo: "JSON_INVALIDO" });
    return;
  }
  console.error("❌ Error no controlado:", err);
  res.status(500).json({
    error: "Ocurrió un error en el servidor",
    codigo: "ERROR_INTERNO",
    ...(env.esProduccion ? {} : { detalle: String(err?.message ?? err) }),
  });
};
