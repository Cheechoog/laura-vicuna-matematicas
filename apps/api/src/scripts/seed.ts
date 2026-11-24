// =====================================================================
// CARGA DE ESTRUCTURA Y CONTENIDO desde apps/api/seed
//   npm run db:seed
// Idempotente: se puede correr siempre. Inserta lo nuevo, actualiza lo
// existente y NUNCA cambia qué subtemas habilitó el docente.
// =====================================================================
import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { env } from "../config/env.js";
import { aplicarMigraciones, db, schema, sqlite } from "../db/client.js";
import { existeGenerador } from "../generadores/index.js";

const leer = <T extends z.ZodType>(archivo: string, esquema: T): z.infer<T> => {
  const ruta = path.join(env.SEED_DIR, archivo);
  const r = esquema.safeParse(JSON.parse(fs.readFileSync(ruta, "utf8")));
  if (!r.success) {
    throw new Error(`${archivo} tiene errores:\n${z.prettifyError(r.error)}`);
  }
  return r.data;
};

const id = z.number().int().positive();

const Estructura = z.object({
  areas: z.array(z.object({ id, nombre: z.string(), orden: z.number().int() })),
  grados: z.array(z.object({ id, nombre: z.string(), orden: z.number().int() })),
  periodos: z.array(z.object({ id, nombre: z.string(), orden: z.number().int() })),
  temas: z.array(
    z.object({ id, areaId: id, gradoId: id, periodoId: id, nombre: z.string(), orden: z.number().int() })
  ),
  subtemas: z.array(z.object({ id, temaId: id, nombre: z.string(), orden: z.number().int(), habilitado: z.boolean() })),
});

const Lecciones = z.array(z.object({ subtemaId: id, titulo: z.string(), html: z.string(), orden: z.number().int().default(1) }));
const Guias = z.array(
  z.object({
    subtemaId: id,
    titulo: z.string(),
    enunciadoHtml: z.string(),
    solucionHtml: z.string().nullable().optional(),
    orden: z.number().int().default(1),
  })
);
const Preguntas = z.array(
  z
    .object({
      subtemaId: id,
      tipo: z.enum(["mcq", "vf", "abierta"]),
      enunciado: z.string(),
      opciones: z.array(z.string()).nullable().optional(),
      respuesta: z.string(),
      explicacion: z.string().nullable().optional(),
    })
    .refine((p) => p.tipo !== "mcq" || (p.opciones ?? []).includes(p.respuesta), {
      message: "En una pregunta mcq la respuesta debe estar entre las opciones",
    })
    .refine((p) => p.tipo !== "vf" || ["V", "F"].includes(p.respuesta), {
      message: "En una pregunta vf la respuesta debe ser V o F",
    })
);
const Generadores = z.array(
  z
    .object({ subtemaId: id, tipo: z.string(), config: z.record(z.string(), z.unknown()), peso: z.number().int().default(1) })
    .refine((g) => existeGenerador(g.tipo), { message: "Tipo de generador desconocido" })
);
const Recursos = z.array(
  z.object({
    subtemaId: id,
    tipo: z.enum(["video", "juego", "enlace", "documento"]),
    titulo: z.string(),
    descripcion: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    datos: z.unknown().optional(),
  })
);

function main() {
  aplicarMigraciones();
  const e = leer("estructura.json", Estructura);
  const c = {
    lecciones: leer("contenido/lecciones.json", Lecciones),
    guias: leer("contenido/guias.json", Guias),
    preguntas: leer("contenido/preguntas.json", Preguntas),
    generadores: leer("contenido/generadores.json", Generadores),
    recursos: leer("contenido/recursos.json", Recursos),
  };

  const ex = (col: string) => sql.raw(`excluded.${col}`);

  db.transaction((tx) => {
    for (const a of e.areas) {
      tx.insert(schema.areas).values(a).onConflictDoUpdate({ target: schema.areas.id, set: { nombre: a.nombre, orden: a.orden } }).run();
    }
    for (const g of e.grados) {
      tx.insert(schema.grados).values(g).onConflictDoUpdate({ target: schema.grados.id, set: { nombre: g.nombre, orden: g.orden } }).run();
    }
    for (const p of e.periodos) {
      tx.insert(schema.periodos).values(p).onConflictDoUpdate({ target: schema.periodos.id, set: { nombre: p.nombre, orden: p.orden } }).run();
    }
    for (const t of e.temas) {
      tx.insert(schema.temas)
        .values(t)
        .onConflictDoUpdate({
          target: schema.temas.id,
          set: { areaId: t.areaId, gradoId: t.gradoId, periodoId: t.periodoId, nombre: t.nombre, orden: t.orden },
        })
        .run();
    }
    for (const s of e.subtemas) {
      // `habilitado` solo se usa al crear: después lo controla el docente
      tx.insert(schema.subtemas)
        .values(s)
        .onConflictDoUpdate({ target: schema.subtemas.id, set: { temaId: s.temaId, nombre: s.nombre, orden: s.orden } })
        .run();
    }

    for (const l of c.lecciones) {
      tx.insert(schema.lecciones)
        .values(l)
        .onConflictDoUpdate({ target: [schema.lecciones.subtemaId, schema.lecciones.titulo], set: { html: ex("html"), orden: ex("orden") } })
        .run();
    }
    for (const g of c.guias) {
      tx.insert(schema.guiasTaller)
        .values({ ...g, solucionHtml: g.solucionHtml ?? null })
        .onConflictDoUpdate({
          target: [schema.guiasTaller.subtemaId, schema.guiasTaller.titulo],
          set: { enunciadoHtml: ex("enunciado_html"), solucionHtml: ex("solucion_html"), orden: ex("orden") },
        })
        .run();
    }
    for (const p of c.preguntas) {
      tx.insert(schema.preguntas)
        .values({ ...p, opciones: p.opciones ?? null, explicacion: p.explicacion ?? null })
        .onConflictDoUpdate({
          target: [schema.preguntas.subtemaId, schema.preguntas.tipo, schema.preguntas.enunciado],
          set: { opciones: ex("opciones"), respuesta: ex("respuesta"), explicacion: ex("explicacion") },
        })
        .run();
    }
    for (const g of c.generadores) {
      tx.insert(schema.generadores)
        .values(g)
        .onConflictDoUpdate({
          target: [schema.generadores.subtemaId, schema.generadores.tipo, schema.generadores.config],
          set: { peso: ex("peso") },
        })
        .run();
    }
    c.recursos.forEach((r, i) => {
      tx.insert(schema.recursos)
        .values({ ...r, descripcion: r.descripcion ?? null, url: r.url ?? null, datos: r.datos ?? null, orden: i + 1 })
        .onConflictDoUpdate({
          target: [schema.recursos.subtemaId, schema.recursos.titulo],
          set: { tipo: ex("tipo"), descripcion: ex("descripcion"), url: ex("url"), datos: ex("datos") },
        })
        .run();
    });
  });

  console.log("✅ Semilla cargada");
  console.log(
    `   estructura: ${e.grados.length} grados, ${e.periodos.length} periodos, ${e.temas.length} temas, ${e.subtemas.length} subtemas`
  );
  console.log(
    `   contenido:  ${c.lecciones.length} lecciones, ${c.guias.length} guías, ${c.preguntas.length} preguntas, ${c.generadores.length} generadores, ${c.recursos.length} recursos`
  );
}

try {
  main();
} catch (err) {
  console.error("❌ La semilla falló:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  sqlite.close();
}
