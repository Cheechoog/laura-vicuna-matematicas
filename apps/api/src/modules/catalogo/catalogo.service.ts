import { and, asc, eq, inArray } from "drizzle-orm";
import type {
  CapacidadesSubtema,
  NotaEstado,
  PanelEstudiante,
  PeriodoResumen,
  SubtemaDetalle,
  TemaResumen,
} from "@lv/shared";
import { db, schema, sqlite } from "../../db/client.js";
import { existeGenerador } from "../../generadores/index.js";
import { noEncontrado } from "../../shared/errores.js";
import { gradoDeEstudiante } from "../auth/auth.service.js";
import type { PayloadSesion } from "../auth/token.js";
import { estaDisponible, verificarAcceso } from "./acceso.js";

const { areas, grados, periodos, temas, subtemas, lecciones, guiasTaller, recursos, intentos } = schema;

// ---------------------------------------------------------------------
// Conteos de contenido por subtema (una consulta por tabla)
// ---------------------------------------------------------------------
export interface Conteos {
  lecciones: number;
  guias: number;
  preguntas: number;
  generadores: number;
  recursos: number;
}

export function conteosPorSubtema(ids: number[]): Map<number, Conteos> {
  const mapa = new Map<number, Conteos>();
  for (const id of ids) mapa.set(id, { lecciones: 0, guias: 0, preguntas: 0, generadores: 0, recursos: 0 });
  if (ids.length === 0) return mapa;

  const marcas = ids.map(() => "?").join(",");
  const contar = (tabla: string, campo: keyof Conteos) => {
    const filas = sqlite
      .prepare(`SELECT subtema_id AS id, COUNT(*) AS n FROM ${tabla} WHERE subtema_id IN (${marcas}) GROUP BY subtema_id`)
      .all(...ids) as { id: number; n: number }[];
    for (const f of filas) {
      const c = mapa.get(f.id);
      if (c) c[campo] = f.n;
    }
  };
  contar("lecciones", "lecciones");
  contar("guias_taller", "guias");
  contar("preguntas", "preguntas");
  contar("recursos", "recursos");

  // Generadores: solo cuentan los tipos que el motor sabe ejecutar
  const gens = sqlite
    .prepare(`SELECT subtema_id AS id, tipo FROM generadores WHERE subtema_id IN (${marcas})`)
    .all(...ids) as { id: number; tipo: string }[];
  for (const g of gens) {
    const c = mapa.get(g.id);
    if (c && existeGenerador(g.tipo)) c.generadores++;
  }
  return mapa;
}

export function capacidades(c: Conteos): CapacidadesSubtema {
  return {
    leccion: c.lecciones > 0,
    practica: c.generadores > 0,
    taller: c.generadores > 0 || c.preguntas > 0,
    quiz: c.preguntas > 0 || c.generadores > 0,
    recursos: c.recursos > 0,
    guias: c.guias > 0,
  };
}

// ---------------------------------------------------------------------
// Árbol periodo → tema → subtema
// ---------------------------------------------------------------------
export function areaPrincipal() {
  const a = db.select().from(areas).orderBy(asc(areas.orden)).get();
  if (!a) throw noEncontrado("El área");
  return a;
}

export function arbol(areaId: number, gradoId: number) {
  const listaPeriodos = db.select().from(periodos).orderBy(asc(periodos.orden)).all();
  const listaTemas = db
    .select()
    .from(temas)
    .where(and(eq(temas.areaId, areaId), eq(temas.gradoId, gradoId)))
    .orderBy(asc(temas.orden))
    .all();
  const temaIds = listaTemas.map((t) => t.id);
  const listaSubtemas = temaIds.length
    ? db.select().from(subtemas).where(inArray(subtemas.temaId, temaIds)).orderBy(asc(subtemas.orden), asc(subtemas.id)).all()
    : [];
  return { listaPeriodos, listaTemas, listaSubtemas };
}

function notasEntregadas(estudianteId: number, subtemaIds: number[]) {
  const mapa = new Map<number, { quiz: number | null; taller: number | null }>();
  if (subtemaIds.length === 0) return mapa;
  const filas = db
    .select({ subtemaId: intentos.subtemaId, tipo: intentos.tipo, nota: intentos.nota })
    .from(intentos)
    .where(
      and(eq(intentos.estudianteId, estudianteId), eq(intentos.estado, "entregado"), inArray(intentos.subtemaId, subtemaIds))
    )
    .all();
  for (const f of filas) {
    const p = mapa.get(f.subtemaId) ?? { quiz: null, taller: null };
    p[f.tipo] = f.nota;
    mapa.set(f.subtemaId, p);
  }
  return mapa;
}

export function panelEstudiante(estudianteId: number): PanelEstudiante {
  const gradoId = gradoDeEstudiante(estudianteId);
  const grado = db.select().from(grados).where(eq(grados.id, gradoId)).get();
  if (!grado) throw noEncontrado("El grado");
  const area = areaPrincipal();

  const { listaPeriodos, listaTemas, listaSubtemas } = arbol(area.id, gradoId);
  const ids = listaSubtemas.map((s) => s.id);
  const conteos = conteosPorSubtema(ids);
  const notas = notasEntregadas(estudianteId, ids);
  const ahora = new Date();

  const periodosSalida: PeriodoResumen[] = listaPeriodos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    orden: p.orden,
    temas: listaTemas
      .filter((t) => t.periodoId === p.id)
      .map(
        (t): TemaResumen => ({
          id: t.id,
          nombre: t.nombre,
          orden: t.orden,
          subtemas: listaSubtemas
            .filter((s) => s.temaId === t.id)
            .map((s) => ({
              id: s.id,
              nombre: s.nombre,
              orden: s.orden,
              disponible: estaDisponible(s, ahora),
              capacidades: capacidades(conteos.get(s.id)!),
              progreso: notas.get(s.id) ?? { quiz: null, taller: null },
            })),
        })
      ),
  }));

  return {
    area: { id: area.id, nombre: area.nombre },
    grado: { id: grado.id, nombre: grado.nombre },
    periodos: periodosSalida,
  };
}

// ---------------------------------------------------------------------
// Detalle de un subtema
// ---------------------------------------------------------------------
function estadoEvaluacion(estudianteId: number, subtemaId: number, tipo: "quiz" | "taller"): NotaEstado {
  const i = db
    .select()
    .from(intentos)
    .where(
      and(
        eq(intentos.estudianteId, estudianteId),
        eq(intentos.subtemaId, subtemaId),
        eq(intentos.tipo, tipo),
        eq(intentos.estado, "entregado")
      )
    )
    .get();
  if (!i) return { entregado: false, nota: null };
  return { entregado: true, nota: i.nota, correctas: i.correctas ?? 0, total: i.total, entregadoEn: i.entregadoEn };
}

export function detalleSubtema(sesion: PayloadSesion, subtemaId: number): SubtemaDetalle {
  const ctx = verificarAcceso(sesion, subtemaId);
  const esDocente = sesion.rol === "docente";
  const c = conteosPorSubtema([subtemaId]).get(subtemaId)!;

  const listaLecciones = db
    .select({ id: lecciones.id, titulo: lecciones.titulo, html: lecciones.html })
    .from(lecciones)
    .where(eq(lecciones.subtemaId, subtemaId))
    .orderBy(asc(lecciones.orden), asc(lecciones.id))
    .all();

  const listaGuias = db
    .select()
    .from(guiasTaller)
    .where(eq(guiasTaller.subtemaId, subtemaId))
    .orderBy(asc(guiasTaller.orden), asc(guiasTaller.id))
    .all()
    .map((g) => ({
      id: g.id,
      titulo: g.titulo,
      enunciadoHtml: g.enunciadoHtml,
      ...(esDocente ? { solucionHtml: g.solucionHtml } : {}),
    }));

  const listaRecursos = db
    .select()
    .from(recursos)
    .where(eq(recursos.subtemaId, subtemaId))
    .orderBy(asc(recursos.orden), asc(recursos.id))
    .all()
    .map((r) => ({ id: r.id, tipo: r.tipo, titulo: r.titulo, descripcion: r.descripcion, url: r.url, datos: r.datos }));

  const vacio: NotaEstado = { entregado: false, nota: null };

  return {
    id: ctx.id,
    nombre: ctx.nombre,
    tema: { id: ctx.temaId, nombre: ctx.tema },
    periodo: { id: ctx.periodoId, nombre: ctx.periodo },
    grado: { id: ctx.gradoId, nombre: ctx.grado },
    disponible: estaDisponible(ctx),
    capacidades: capacidades(c),
    lecciones: listaLecciones,
    guias: listaGuias,
    recursos: listaRecursos,
    estado: esDocente
      ? { quiz: vacio, taller: vacio }
      : {
          quiz: estadoEvaluacion(sesion.sub, subtemaId, "quiz"),
          taller: estadoEvaluacion(sesion.sub, subtemaId, "taller"),
        },
  };
}
