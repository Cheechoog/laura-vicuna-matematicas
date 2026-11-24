import { eq } from "drizzle-orm";
import { db, schema } from "../../db/client.js";
import type { PayloadSesion } from "../auth/token.js";
import { gradoDeEstudiante } from "../auth/auth.service.js";
import { AppError, noEncontrado, prohibido } from "../../shared/errores.js";

const { subtemas, temas, grados, periodos } = schema;

export function estaDisponible(s: { habilitado: boolean; disponibleDesde: string | null }, ahora = new Date()): boolean {
  if (!s.habilitado) return false;
  if (!s.disponibleDesde) return true;
  const desde = new Date(s.disponibleDesde);
  return Number.isNaN(desde.getTime()) || ahora >= desde;
}

export function contextoSubtema(subtemaId: number) {
  const r = db
    .select({
      id: subtemas.id,
      nombre: subtemas.nombre,
      habilitado: subtemas.habilitado,
      disponibleDesde: subtemas.disponibleDesde,
      temaId: temas.id,
      tema: temas.nombre,
      gradoId: grados.id,
      grado: grados.nombre,
      periodoId: periodos.id,
      periodo: periodos.nombre,
    })
    .from(subtemas)
    .innerJoin(temas, eq(temas.id, subtemas.temaId))
    .innerJoin(grados, eq(grados.id, temas.gradoId))
    .innerJoin(periodos, eq(periodos.id, temas.periodoId))
    .where(eq(subtemas.id, subtemaId))
    .get();
  if (!r) throw noEncontrado("El subtema");
  return r;
}

export type ContextoSubtema = ReturnType<typeof contextoSubtema>;

/**
 * Verifica que quien consulta pueda ver el subtema:
 *  - docente: siempre
 *  - estudiante: debe ser de su grado y estar disponible
 */
export function verificarAcceso(sesion: PayloadSesion, subtemaId: number): ContextoSubtema {
  const ctx = contextoSubtema(subtemaId);
  if (sesion.rol === "docente") return ctx;

  if (gradoDeEstudiante(sesion.sub) !== ctx.gradoId) {
    throw prohibido("Este subtema no pertenece a tu grado");
  }
  if (!estaDisponible(ctx)) {
    throw new AppError(403, "Este subtema todavía no está abierto. Pregúntale a tu profe.", "SUBTEMA_BLOQUEADO");
  }
  return ctx;
}
