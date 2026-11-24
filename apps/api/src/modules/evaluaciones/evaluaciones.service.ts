// =====================================================================
// EVALUACIONES (quiz y taller)
//  1. El estudiante abre la evaluación → el servidor arma las preguntas,
//     las guarda CON respuesta en `intentos` y envía solo los enunciados.
//  2. El estudiante entrega sus respuestas → el servidor califica.
//  Recargar la página devuelve el mismo intento (no se pueden "re-sortear").
// =====================================================================
import { and, eq } from "drizzle-orm";
import type { IntentoAbierto, PreguntaPublica, ResultadoEvaluacion, TipoEvaluacion } from "@lv/shared";
import { db, schema } from "../../db/client.js";
import type { PreguntaGuardada } from "../../db/schema.js";
import { aSeleccionMultiple, generarVarios } from "../../generadores/index.js";
import { barajar } from "../../shared/aleatorio.js";
import { calcularNota, esRespuestaCorrecta } from "../../shared/calificacion.js";
import { AppError, noEncontrado, prohibido } from "../../shared/errores.js";
import type { PayloadSesion } from "../auth/token.js";
import { verificarAcceso } from "../catalogo/acceso.js";

const { intentos, preguntas, generadores } = schema;

export const TAMANO: Record<TipoEvaluacion, number> = { quiz: 5, taller: 10 };

function desdeBanco(subtemaId: number): PreguntaGuardada[] {
  return db
    .select()
    .from(preguntas)
    .where(eq(preguntas.subtemaId, subtemaId))
    .all()
    .map((p) => ({
      tipo: p.tipo,
      enunciado: p.enunciado,
      opciones: p.opciones ? barajar(p.opciones) : undefined,
      respuesta: p.respuesta,
      explicacion: p.explicacion,
    }));
}

function desdeGeneradores(subtemaId: number, cantidad: number, comoOpcionMultiple: boolean): PreguntaGuardada[] {
  const filas = db.select().from(generadores).where(eq(generadores.subtemaId, subtemaId)).all();
  return generarVarios(filas, cantidad).map((e) => {
    const ej = comoOpcionMultiple ? aSeleccionMultiple(e) : e;
    return { tipo: ej.tipo, enunciado: ej.enunciado, opciones: ej.opciones, apoyo: ej.apoyo, respuesta: ej.respuesta, explicacion: ej.explicacion };
  });
}

/**
 * Arma las preguntas de una evaluación.
 *  - quiz: primero el banco del docente; si no alcanza, ejercicios generados en opción múltiple
 *  - taller: primero ejercicios generados (respuesta abierta); si no hay, el banco
 */
export function armarPreguntas(subtemaId: number, tipo: TipoEvaluacion): PreguntaGuardada[] {
  const n = TAMANO[tipo];
  if (tipo === "quiz") {
    const banco = barajar(desdeBanco(subtemaId)).slice(0, n);
    const faltan = n - banco.length;
    return faltan > 0 ? [...banco, ...desdeGeneradores(subtemaId, faltan, true)] : banco;
  }
  const generadas = desdeGeneradores(subtemaId, n, false);
  if (generadas.length >= n) return generadas;
  return [...generadas, ...barajar(desdeBanco(subtemaId)).slice(0, n - generadas.length)];
}

export function aPublica(p: PreguntaGuardada, indice: number): PreguntaPublica {
  return {
    indice,
    tipo: p.tipo,
    enunciado: p.enunciado,
    ...(p.opciones ? { opciones: p.opciones } : {}),
    ...(p.apoyo ? { apoyo: p.apoyo as PreguntaPublica["apoyo"] } : {}),
  };
}

function buscarIntento(estudianteId: number, subtemaId: number, tipo: TipoEvaluacion, estado: "abierto" | "entregado") {
  return db
    .select()
    .from(intentos)
    .where(
      and(
        eq(intentos.estudianteId, estudianteId),
        eq(intentos.subtemaId, subtemaId),
        eq(intentos.tipo, tipo),
        eq(intentos.estado, estado)
      )
    )
    .get();
}

export function abrirEvaluacion(sesion: PayloadSesion, subtemaId: number, tipo: TipoEvaluacion): IntentoAbierto {
  if (sesion.rol !== "estudiante") throw prohibido("Solo los estudiantes presentan evaluaciones");
  verificarAcceso(sesion, subtemaId);

  const entregado = buscarIntento(sesion.sub, subtemaId, tipo, "entregado");
  if (entregado) {
    throw new AppError(409, `Ya entregaste este ${tipo}.`, "YA_ENTREGADO", { nota: entregado.nota });
  }

  const abierto = buscarIntento(sesion.sub, subtemaId, tipo, "abierto");
  if (abierto) {
    return { intentoId: abierto.id, tipo, preguntas: abierto.preguntas.map(aPublica) };
  }

  const lista = armarPreguntas(subtemaId, tipo);
  if (lista.length === 0) {
    throw new AppError(404, `Este subtema todavía no tiene ${tipo}`, "SIN_CONTENIDO");
  }

  const creado = db
    .insert(intentos)
    .values({ estudianteId: sesion.sub, subtemaId, tipo, preguntas: lista, total: lista.length })
    .returning({ id: intentos.id })
    .get();

  return { intentoId: creado.id, tipo, preguntas: lista.map(aPublica) };
}

export function entregarEvaluacion(sesion: PayloadSesion, intentoId: number, respuestas: string[]): ResultadoEvaluacion {
  const intento = db.select().from(intentos).where(eq(intentos.id, intentoId)).get();
  if (!intento) throw noEncontrado("La evaluación");
  if (sesion.rol !== "estudiante" || intento.estudianteId !== sesion.sub) throw prohibido();
  if (intento.estado === "entregado") {
    throw new AppError(409, "Esta evaluación ya fue entregada.", "YA_ENTREGADO", { nota: intento.nota });
  }

  const detalle = intento.preguntas.map((p, i) => {
    const dada = String(respuestas[i] ?? "").slice(0, 200);
    return {
      indice: i,
      correcta: esRespuestaCorrecta(p.tipo, dada, p.respuesta),
      respuestaDada: dada,
      respuestaCorrecta: p.tipo === "vf" ? (p.respuesta === "V" ? "Verdadero" : "Falso") : p.respuesta,
      explicacion: p.explicacion ?? null,
    };
  });

  const correctas = detalle.filter((d) => d.correcta).length;
  const total = intento.preguntas.length;
  const nota = calcularNota(correctas, total);

  db.update(intentos)
    .set({
      estado: "entregado",
      respuestas: detalle.map((d) => d.respuestaDada),
      correctas,
      nota,
      entregadoEn: new Date().toISOString(),
    })
    .where(eq(intentos.id, intentoId))
    .run();

  return { nota, correctas, total, porcentaje: Math.round((correctas / total) * 100), detalle };
}
