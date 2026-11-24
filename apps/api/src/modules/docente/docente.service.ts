import { and, asc, eq, inArray } from "drizzle-orm";
import type { ArbolDocente, EstudianteDocente, ReporteNotas, TipoEvaluacion } from "@lv/shared";
import { db, schema } from "../../db/client.js";
import { promedio } from "../../shared/calificacion.js";
import { noEncontrado } from "../../shared/errores.js";
import { generarPin, hashPin } from "../auth/pin.js";
import { contextoSubtema, estaDisponible } from "../catalogo/acceso.js";
import { arbol, areaPrincipal, capacidades, conteosPorSubtema } from "../catalogo/catalogo.service.js";
import { armarPreguntas } from "../evaluaciones/evaluaciones.service.js";

const { grados, grupos, estudiantes, subtemas, temas, periodos, intentos } = schema;

export function listarGrados() {
  return db.select({ id: grados.id, nombre: grados.nombre }).from(grados).orderBy(asc(grados.orden)).all();
}

// ---------------------------------------------------------------------
// Contenido
// ---------------------------------------------------------------------
export function arbolDocente(gradoId?: number): ArbolDocente {
  const lista = listarGrados();
  const grado = lista.find((g) => g.id === gradoId) ?? lista[0];
  if (!grado) throw noEncontrado("El grado");

  const area = areaPrincipal();
  const { listaPeriodos, listaTemas, listaSubtemas } = arbol(area.id, grado.id);
  const conteos = conteosPorSubtema(listaSubtemas.map((s) => s.id));

  return {
    grados: lista,
    grado,
    periodos: listaPeriodos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      orden: p.orden,
      temas: listaTemas
        .filter((t) => t.periodoId === p.id)
        .map((t) => ({
          id: t.id,
          nombre: t.nombre,
          orden: t.orden,
          subtemas: listaSubtemas
            .filter((s) => s.temaId === t.id)
            .map((s) => {
              const c = conteos.get(s.id)!;
              return {
                id: s.id,
                nombre: s.nombre,
                orden: s.orden,
                habilitado: s.habilitado,
                disponibleDesde: s.disponibleDesde,
                disponible: estaDisponible(s),
                capacidades: capacidades(c),
                conteos: c,
              };
            }),
        })),
    })),
  };
}

export function actualizarSubtema(id: number, cambios: { habilitado?: boolean; disponibleDesde?: string | null }) {
  contextoSubtema(id);
  db.update(subtemas).set(cambios).where(eq(subtemas.id, id)).run();
}

export function habilitarTema(temaId: number, habilitado: boolean): number {
  const r = db.update(subtemas).set({ habilitado }).where(eq(subtemas.temaId, temaId)).run();
  return r.changes;
}

export function vistaPrevia(subtemaId: number, tipo: TipoEvaluacion) {
  contextoSubtema(subtemaId);
  return armarPreguntas(subtemaId, tipo);
}

// ---------------------------------------------------------------------
// Notas
// ---------------------------------------------------------------------
export function reporteNotas(filtro: { gradoId: number; periodoId?: number; grupoId?: number }): ReporteNotas {
  const area = areaPrincipal();
  const condTema = [eq(temas.areaId, area.id), eq(temas.gradoId, filtro.gradoId)];
  if (filtro.periodoId) condTema.push(eq(temas.periodoId, filtro.periodoId));

  const columnas = db
    .select({ subtemaId: subtemas.id, subtema: subtemas.nombre, tema: temas.nombre })
    .from(subtemas)
    .innerJoin(temas, eq(temas.id, subtemas.temaId))
    .innerJoin(periodos, eq(periodos.id, temas.periodoId))
    .where(and(...condTema))
    .orderBy(asc(periodos.orden), asc(temas.orden), asc(subtemas.orden), asc(subtemas.id))
    .all();

  const condEst = [eq(grupos.gradoId, filtro.gradoId)];
  if (filtro.grupoId) condEst.push(eq(grupos.id, filtro.grupoId));
  const listaEst = db
    .select({ id: estudiantes.id, nombre: estudiantes.nombre, grupo: grupos.nombre })
    .from(estudiantes)
    .innerJoin(grupos, eq(grupos.id, estudiantes.grupoId))
    .where(and(...condEst))
    .orderBy(asc(grupos.nombre), asc(estudiantes.nombre))
    .all();

  const subIds = columnas.map((c) => c.subtemaId);
  const estIds = listaEst.map((e) => e.id);
  const entregados =
    subIds.length && estIds.length
      ? db
          .select({ e: intentos.estudianteId, s: intentos.subtemaId, tipo: intentos.tipo, nota: intentos.nota })
          .from(intentos)
          .where(and(eq(intentos.estado, "entregado"), inArray(intentos.subtemaId, subIds), inArray(intentos.estudianteId, estIds)))
          .all()
      : [];

  const indice = new Map<string, { quiz: number | null; taller: number | null }>();
  for (const r of entregados) {
    const k = `${r.e}:${r.s}`;
    const v = indice.get(k) ?? { quiz: null, taller: null };
    v[r.tipo] = r.nota;
    indice.set(k, v);
  }

  // Solo mostramos columnas con al menos una nota, o todas si no hay ninguna aún
  const conNotas = new Set(entregados.map((r) => r.s));
  const columnasVisibles = conNotas.size ? columnas.filter((c) => conNotas.has(c.subtemaId)) : columnas;

  return {
    columnas: columnasVisibles,
    filas: listaEst.map((e) => {
      const notas: ReporteNotas["filas"][number]["notas"] = {};
      const promedios: (number | null)[] = [];
      for (const c of columnasVisibles) {
        const v = indice.get(`${e.id}:${c.subtemaId}`) ?? { quiz: null, taller: null };
        const p = promedio([v.quiz, v.taller]);
        notas[c.subtemaId] = { ...v, promedio: p };
        promedios.push(p);
      }
      return { estudianteId: e.id, estudiante: e.nombre, grupo: e.grupo, notas, promedio: promedio(promedios) };
    }),
  };
}

/** Permite que un estudiante vuelva a presentar un quiz o taller. */
export function reabrirEvaluacion(estudianteId: number, subtemaId: number, tipo: TipoEvaluacion): number {
  const r = db
    .delete(intentos)
    .where(and(eq(intentos.estudianteId, estudianteId), eq(intentos.subtemaId, subtemaId), eq(intentos.tipo, tipo)))
    .run();
  return r.changes;
}

// ---------------------------------------------------------------------
// Estudiantes
// ---------------------------------------------------------------------
export function listarGrupos(gradoId?: number) {
  const q = db
    .select({ id: grupos.id, nombre: grupos.nombre, gradoId: grupos.gradoId, grado: grados.nombre })
    .from(grupos)
    .innerJoin(grados, eq(grados.id, grupos.gradoId));
  return (gradoId ? q.where(eq(grupos.gradoId, gradoId)) : q).orderBy(asc(grados.orden), asc(grupos.nombre)).all();
}

export function estudiantesDeGrupo(grupoId: number): EstudianteDocente[] {
  return db
    .select({ id: estudiantes.id, nombre: estudiantes.nombre, usuario: estudiantes.usuario, activo: estudiantes.activo })
    .from(estudiantes)
    .where(eq(estudiantes.grupoId, grupoId))
    .orderBy(asc(estudiantes.nombre))
    .all();
}

export function nuevoPin(estudianteId: number): string {
  const e = db.select({ id: estudiantes.id }).from(estudiantes).where(eq(estudiantes.id, estudianteId)).get();
  if (!e) throw noEncontrado("El estudiante");
  const pin = generarPin();
  db.update(estudiantes).set({ pinHash: hashPin(pin) }).where(eq(estudiantes.id, estudianteId)).run();
  return pin;
}

export function cambiarActivo(estudianteId: number, activo: boolean) {
  const r = db.update(estudiantes).set({ activo }).where(eq(estudiantes.id, estudianteId)).run();
  if (r.changes === 0) throw noEncontrado("El estudiante");
}
