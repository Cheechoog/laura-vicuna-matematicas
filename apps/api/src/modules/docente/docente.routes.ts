import { Router } from "express";
import { z } from "zod";
import { requiereDocente } from "../../middleware/auth.js";
import { idParam, paramId, validar } from "../../shared/http.js";
import * as docente from "./docente.service.js";
import { notasAExcel } from "./exportar.js";

export const docenteRouter = Router();
docenteRouter.use(requiereDocente);

const tipoEval = z.enum(["quiz", "taller"]);

docenteRouter.get("/arbol", (req, res) => {
  const { gradoId } = validar(z.object({ gradoId: idParam.optional() }), req.query);
  res.json(docente.arbolDocente(gradoId));
});

docenteRouter.patch("/subtemas/:id", (req, res) => {
  const cambios = validar(
    z.object({
      habilitado: z.boolean().optional(),
      disponibleDesde: z.iso.datetime({ offset: true }).or(z.iso.date()).nullable().optional(),
    }),
    req.body
  );
  docente.actualizarSubtema(paramId(req), cambios);
  res.status(204).end();
});

docenteRouter.patch("/temas/:id", (req, res) => {
  const { habilitado } = validar(z.object({ habilitado: z.boolean() }), req.body);
  res.json({ actualizados: docente.habilitarTema(paramId(req), habilitado) });
});

docenteRouter.get("/subtemas/:id/vista-previa", (req, res) => {
  const { tipo } = validar(z.object({ tipo: tipoEval }), req.query);
  res.json(docente.vistaPrevia(paramId(req), tipo));
});

const filtroNotas = z.object({
  gradoId: idParam,
  periodoId: idParam.optional(),
  grupoId: idParam.optional(),
});

docenteRouter.get("/notas", (req, res) => {
  res.json(docente.reporteNotas(validar(filtroNotas, req.query)));
});

docenteRouter.get("/notas/exportar", async (req, res) => {
  const filtro = validar(filtroNotas, req.query);
  const grado = docente.listarGrados().find((g) => g.id === filtro.gradoId)?.nombre ?? "grado";
  const buffer = await notasAExcel(docente.reporteNotas(filtro), `Notas de matemáticas — ${grado}`);
  const fecha = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="notas-${grado.toLowerCase()}-${fecha}.xlsx"`);
  res.send(buffer);
});

docenteRouter.post("/intentos/reabrir", (req, res) => {
  const b = validar(z.object({ estudianteId: idParam, subtemaId: idParam, tipo: tipoEval }), req.body);
  res.json({ eliminados: docente.reabrirEvaluacion(b.estudianteId, b.subtemaId, b.tipo) });
});

docenteRouter.get("/grados", (_req, res) => {
  res.json(docente.listarGrados());
});

docenteRouter.get("/grupos", (req, res) => {
  const { gradoId } = validar(z.object({ gradoId: idParam.optional() }), req.query);
  res.json(docente.listarGrupos(gradoId));
});

docenteRouter.get("/grupos/:id/estudiantes", (req, res) => {
  res.json(docente.estudiantesDeGrupo(paramId(req)));
});

docenteRouter.post("/estudiantes/:id/pin", (req, res) => {
  res.json({ pin: docente.nuevoPin(paramId(req)) });
});

docenteRouter.patch("/estudiantes/:id", (req, res) => {
  const { activo } = validar(z.object({ activo: z.boolean() }), req.body);
  docente.cambiarActivo(paramId(req), activo);
  res.status(204).end();
});
