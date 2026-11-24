import { Router } from "express";
import { requiereEstudiante, requiereSesion, sesionDe } from "../../middleware/auth.js";
import { paramId } from "../../shared/http.js";
import { detalleSubtema, panelEstudiante } from "./catalogo.service.js";

export const catalogoRouter = Router();

/** Todo lo que el estudiante necesita para su pantalla principal, en una sola llamada. */
catalogoRouter.get("/panel", requiereEstudiante, (req, res) => {
  res.json(panelEstudiante(sesionDe(req).sub));
});

catalogoRouter.get("/subtemas/:id", requiereSesion, (req, res) => {
  res.json(detalleSubtema(sesionDe(req), paramId(req)));
});
