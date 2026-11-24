import { and, asc, eq } from "drizzle-orm";
import type { EstudianteOpcion, GrupoOpcion, Sesion } from "@lv/shared";
import { db, schema } from "../../db/client.js";
import { AppError, noAutenticado } from "../../shared/errores.js";
import { hashPin, verificarPin } from "./pin.js";
import type { PayloadSesion } from "./token.js";

const { docentes, estudiantes, grados, grupos } = schema;

// ---------------------------------------------------------------------
// Bloqueo temporal tras varios PIN incorrectos (por cuenta)
// ---------------------------------------------------------------------
const MAX_FALLOS = 5;
const BLOQUEO_MS = 5 * 60 * 1000;
const fallos = new Map<string, { n: number; hasta: number }>();

function revisarBloqueo(clave: string): void {
  const f = fallos.get(clave);
  if (f && f.hasta > Date.now()) {
    const min = Math.ceil((f.hasta - Date.now()) / 60000);
    throw new AppError(429, `Demasiados intentos. Espera ${min} minuto(s) e inténtalo otra vez.`, "BLOQUEADO");
  }
}

function registrarFallo(clave: string): void {
  const f = fallos.get(clave) ?? { n: 0, hasta: 0 };
  f.n += 1;
  if (f.n >= MAX_FALLOS) {
    f.hasta = Date.now() + BLOQUEO_MS;
    f.n = 0;
  }
  fallos.set(clave, f);
}

const pinIncorrecto = () => new AppError(401, "El PIN no es correcto", "PIN_INCORRECTO");

// ---------------------------------------------------------------------
// Datos para la pantalla de ingreso
// ---------------------------------------------------------------------
export function listarGrupos(): GrupoOpcion[] {
  return db
    .select({ id: grupos.id, nombre: grupos.nombre, grado: grados.nombre })
    .from(grupos)
    .innerJoin(grados, eq(grados.id, grupos.gradoId))
    .orderBy(asc(grados.orden), asc(grupos.nombre))
    .all();
}

export function listarEstudiantesDeGrupo(grupoId: number): EstudianteOpcion[] {
  return db
    .select({ id: estudiantes.id, nombre: estudiantes.nombre })
    .from(estudiantes)
    .where(and(eq(estudiantes.grupoId, grupoId), eq(estudiantes.activo, true)))
    .orderBy(asc(estudiantes.nombre))
    .all();
}

// ---------------------------------------------------------------------
// Ingreso
// ---------------------------------------------------------------------
export function ingresarEstudiante(estudianteId: number, pin: string): PayloadSesion {
  const clave = `e:${estudianteId}`;
  revisarBloqueo(clave);

  const est = db.select().from(estudiantes).where(eq(estudiantes.id, estudianteId)).get();
  if (!est || !est.activo) throw pinIncorrecto();

  const v = verificarPin(pin, est.pinHash);
  if (!v.ok) {
    registrarFallo(clave);
    throw pinIncorrecto();
  }
  fallos.delete(clave);
  if (v.requiereRehash) {
    db.update(estudiantes).set({ pinHash: hashPin(pin) }).where(eq(estudiantes.id, est.id)).run();
  }
  return { sub: est.id, rol: "estudiante" };
}

export function ingresarDocente(usuario: string, pin: string): PayloadSesion {
  const clave = `d:${usuario.toLowerCase()}`;
  revisarBloqueo(clave);

  const doc = db.select().from(docentes).where(eq(docentes.usuario, usuario.toLowerCase())).get();
  const v = doc && doc.activo ? verificarPin(pin, doc.pinHash) : { ok: false, requiereRehash: false };
  if (!doc || !v.ok) {
    registrarFallo(clave);
    throw new AppError(401, "Usuario o PIN incorrectos", "CREDENCIALES_INCORRECTAS");
  }
  fallos.delete(clave);
  return { sub: doc.id, rol: "docente" };
}

// ---------------------------------------------------------------------
// Sesión actual
// ---------------------------------------------------------------------
export function obtenerSesion(p: PayloadSesion): Sesion {
  if (p.rol === "docente") {
    const d = db.select().from(docentes).where(eq(docentes.id, p.sub)).get();
    if (!d || !d.activo) throw noAutenticado();
    return { rol: "docente", id: d.id, nombre: d.nombre };
  }

  const e = db
    .select({
      id: estudiantes.id,
      nombre: estudiantes.nombre,
      activo: estudiantes.activo,
      grupoId: grupos.id,
      grupo: grupos.nombre,
      gradoId: grados.id,
      grado: grados.nombre,
    })
    .from(estudiantes)
    .innerJoin(grupos, eq(grupos.id, estudiantes.grupoId))
    .innerJoin(grados, eq(grados.id, grupos.gradoId))
    .where(eq(estudiantes.id, p.sub))
    .get();
  if (!e || !e.activo) throw noAutenticado();

  return {
    rol: "estudiante",
    id: e.id,
    nombre: e.nombre,
    grado: { id: e.gradoId, nombre: e.grado },
    grupo: { id: e.grupoId, nombre: e.grupo },
  };
}

/** Grado del estudiante (para filtrar lo que puede ver). */
export function gradoDeEstudiante(estudianteId: number): number {
  const r = db
    .select({ gradoId: grupos.gradoId })
    .from(estudiantes)
    .innerJoin(grupos, eq(grupos.id, estudiantes.grupoId))
    .where(eq(estudiantes.id, estudianteId))
    .get();
  if (!r) throw noAutenticado();
  return r.gradoId;
}
