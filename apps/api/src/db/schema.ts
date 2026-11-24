// =====================================================================
// ESQUEMA DE BASE DE DATOS (Drizzle ORM)
//
// Jerarquía académica:   área → (grado + periodo) → tema → subtema
// Contenido por subtema: lecciones, guías de taller, banco de preguntas,
//                        generadores de ejercicios y recursos
// Personas:              docentes, grupos, estudiantes
// Evaluación:            intentos (quiz/taller) calificados en el servidor
//
// Para cambiar el esquema: edita este archivo y corre `npm run db:generar`
// en apps/api; eso crea una nueva migración SQL en /drizzle.
// =====================================================================

import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const creadoEn = () =>
  text("creado_en")
    .notNull()
    .default(sql`(datetime('now'))`);

// ---------------------------------------------------------------------
// Estructura académica
// ---------------------------------------------------------------------
export const areas = sqliteTable("areas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre").notNull().unique(),
  orden: integer("orden").notNull().default(1),
});

export const grados = sqliteTable("grados", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre").notNull().unique(),
  orden: integer("orden").notNull().default(1),
});

/** Periodos académicos del año (trimestres). Son comunes a todos los grados. */
export const periodos = sqliteTable("periodos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre").notNull().unique(),
  orden: integer("orden").notNull(),
});

export const temas = sqliteTable(
  "temas",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    areaId: integer("area_id").notNull().references(() => areas.id),
    gradoId: integer("grado_id").notNull().references(() => grados.id),
    periodoId: integer("periodo_id").notNull().references(() => periodos.id),
    nombre: text("nombre").notNull(),
    orden: integer("orden").notNull().default(1),
  },
  (t) => [index("idx_temas_ubicacion").on(t.areaId, t.gradoId, t.periodoId)]
);

export const subtemas = sqliteTable(
  "subtemas",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    temaId: integer("tema_id")
      .notNull()
      .references(() => temas.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    orden: integer("orden").notNull().default(1),
    /** El docente decide qué subtemas ven los estudiantes. */
    habilitado: integer("habilitado", { mode: "boolean" }).notNull().default(false),
    /** Fecha ISO opcional: aunque esté habilitado, no se abre antes de esta fecha. */
    disponibleDesde: text("disponible_desde"),
  },
  (t) => [index("idx_subtemas_tema").on(t.temaId)]
);

// ---------------------------------------------------------------------
// Contenido
// ---------------------------------------------------------------------
const subtemaRef = () =>
  integer("subtema_id")
    .notNull()
    .references(() => subtemas.id, { onDelete: "cascade" });

/** Explicaciones (antes "intro"). HTML sanitizado en el frontend. */
export const lecciones = sqliteTable(
  "lecciones",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subtemaId: subtemaRef(),
    titulo: text("titulo").notNull(),
    html: text("html").notNull(),
    orden: integer("orden").notNull().default(1),
  },
  (t) => [uniqueIndex("uq_lecciones").on(t.subtemaId, t.titulo)]
);

/** Talleres para leer o imprimir (antes "talleres"). */
export const guiasTaller = sqliteTable(
  "guias_taller",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subtemaId: subtemaRef(),
    titulo: text("titulo").notNull(),
    enunciadoHtml: text("enunciado_html").notNull(),
    solucionHtml: text("solucion_html"),
    orden: integer("orden").notNull().default(1),
  },
  (t) => [uniqueIndex("uq_guias").on(t.subtemaId, t.titulo)]
);

/** Banco de preguntas fijas (antes "quiz"). */
export const preguntas = sqliteTable(
  "preguntas",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subtemaId: subtemaRef(),
    tipo: text("tipo", { enum: ["mcq", "vf", "abierta"] }).notNull(),
    enunciado: text("enunciado").notNull(),
    opciones: text("opciones", { mode: "json" }).$type<string[] | null>(),
    respuesta: text("respuesta").notNull(),
    explicacion: text("explicacion"),
  },
  (t) => [uniqueIndex("uq_preguntas").on(t.subtemaId, t.tipo, t.enunciado)]
);

/** Generadores de ejercicios aleatorios (antes "plantillas"). */
export const generadores = sqliteTable(
  "generadores",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subtemaId: subtemaRef(),
    tipo: text("tipo").notNull(),
    config: text("config", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    peso: integer("peso").notNull().default(1),
  },
  (t) => [uniqueIndex("uq_generadores").on(t.subtemaId, t.tipo, t.config)]
);

/** Videos, juegos, enlaces y documentos de apoyo. */
export const recursos = sqliteTable(
  "recursos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subtemaId: subtemaRef(),
    tipo: text("tipo", { enum: ["video", "juego", "enlace", "documento"] }).notNull(),
    titulo: text("titulo").notNull(),
    descripcion: text("descripcion"),
    url: text("url"),
    datos: text("datos", { mode: "json" }),
    orden: integer("orden").notNull().default(1),
  },
  (t) => [uniqueIndex("uq_recursos").on(t.subtemaId, t.titulo)]
);

// ---------------------------------------------------------------------
// Personas
// ---------------------------------------------------------------------
export const docentes = sqliteTable("docentes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre").notNull(),
  usuario: text("usuario").notNull().unique(),
  pinHash: text("pin_hash").notNull(),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  creadoEn: creadoEn(),
});

export const grupos = sqliteTable(
  "grupos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gradoId: integer("grado_id").notNull().references(() => grados.id),
    nombre: text("nombre").notNull(),
  },
  (t) => [uniqueIndex("uq_grupos").on(t.gradoId, t.nombre)]
);

export const estudiantes = sqliteTable(
  "estudiantes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    grupoId: integer("grupo_id").notNull().references(() => grupos.id),
    nombre: text("nombre").notNull(),
    usuario: text("usuario").notNull().unique(),
    /** "scrypt$sal$hash" o, para estudiantes migrados, "legacy$sal$hash". */
    pinHash: text("pin_hash").notNull(),
    activo: integer("activo", { mode: "boolean" }).notNull().default(true),
    creadoEn: creadoEn(),
  },
  (t) => [index("idx_estudiantes_grupo").on(t.grupoId)]
);

// ---------------------------------------------------------------------
// Evaluación
// ---------------------------------------------------------------------
export interface PreguntaGuardada {
  tipo: "mcq" | "vf" | "abierta";
  enunciado: string;
  opciones?: string[];
  apoyo?: unknown;
  respuesta: string;
  explicacion?: string | null;
}

export const intentos = sqliteTable(
  "intentos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    estudianteId: integer("estudiante_id")
      .notNull()
      .references(() => estudiantes.id, { onDelete: "cascade" }),
    subtemaId: integer("subtema_id")
      .notNull()
      .references(() => subtemas.id, { onDelete: "cascade" }),
    tipo: text("tipo", { enum: ["quiz", "taller"] }).notNull(),
    /** Las preguntas con su respuesta quedan SOLO en el servidor. */
    preguntas: text("preguntas", { mode: "json" }).$type<PreguntaGuardada[]>().notNull(),
    respuestas: text("respuestas", { mode: "json" }).$type<string[] | null>(),
    estado: text("estado", { enum: ["abierto", "entregado"] }).notNull().default("abierto"),
    correctas: integer("correctas"),
    total: integer("total").notNull(),
    nota: real("nota"),
    iniciadoEn: text("iniciado_en")
      .notNull()
      .default(sql`(datetime('now'))`),
    entregadoEn: text("entregado_en"),
  },
  (t) => [index("idx_intentos_estudiante").on(t.estudianteId, t.subtemaId, t.tipo)]
);
