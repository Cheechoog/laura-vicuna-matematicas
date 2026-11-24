// =====================================================================
// IMPORTAR GRUPOS Y ESTUDIANTES DESDE LA VERSIÓN 1
//   npm run db:importar-legado -- "C:/ruta/a/database.sqlite"
//
// - Lee la base vieja SOLO en modo lectura (no la modifica).
// - Conserva los PINs actuales: se guardan en formato "legacy" y se
//   convierten a scrypt automáticamente cuando cada estudiante ingresa.
// - Es idempotente: si el estudiante ya existe (mismo usuario), lo actualiza.
// =====================================================================
import fs from "node:fs";
import { parseArgs } from "node:util";
import Database from "better-sqlite3";
import { and, eq } from "drizzle-orm";
import { aplicarMigraciones, db, schema, sqlite } from "../db/client.js";

const { values, positionals } = parseArgs({ options: { desde: { type: "string" } }, allowPositionals: true });
const desde = values.desde ?? positionals[0];

if (!desde || !fs.existsSync(desde)) {
  console.error('Uso: npm run db:importar-legado -- "ruta/a/database.sqlite"');
  process.exit(1);
}

aplicarMigraciones();
const gradosNuevos = new Set(db.select({ id: schema.grados.id }).from(schema.grados).all().map((g) => g.id));
if (gradosNuevos.size === 0) {
  console.error("❌ Primero corre: npm run db:seed");
  process.exit(1);
}

const viejo = new Database(desde, { readonly: true, fileMustExist: true });

interface GrupoViejo {
  id: number;
  grado_id: number;
  nombre: string;
}
interface EstudianteViejo {
  id: number;
  grupo_id: number;
  nombre: string;
  usuario: string | null;
  salt: string;
  pin_hash: string;
}

const gruposViejos = viejo.prepare("SELECT id, grado_id, nombre FROM grupos ORDER BY id").all() as GrupoViejo[];
const estudiantesViejos = viejo
  .prepare("SELECT id, grupo_id, nombre, usuario, salt, pin_hash FROM estudiantes ORDER BY id")
  .all() as EstudianteViejo[];
viejo.close();

const mapaGrupos = new Map<number, number>();
let creados = 0;
let actualizados = 0;
let omitidos = 0;

db.transaction((tx) => {
  for (const g of gruposViejos) {
    if (!gradosNuevos.has(g.grado_id)) {
      console.warn(`⚠️ Grupo ${g.nombre}: el grado ${g.grado_id} no existe en la nueva estructura, se omite`);
      continue;
    }
    tx.insert(schema.grupos).values({ gradoId: g.grado_id, nombre: g.nombre }).onConflictDoNothing().run();
    const nuevo = tx
      .select({ id: schema.grupos.id })
      .from(schema.grupos)
      .where(and(eq(schema.grupos.gradoId, g.grado_id), eq(schema.grupos.nombre, g.nombre)))
      .get()!;
    mapaGrupos.set(g.id, nuevo.id);
  }

  for (const e of estudiantesViejos) {
    const grupoId = mapaGrupos.get(e.grupo_id);
    if (!grupoId || !e.salt || !e.pin_hash) {
      omitidos++;
      continue;
    }
    const usuario = (e.usuario ?? `estudiante.${e.id}`).toLowerCase();
    const pinHash = `legacy$${e.salt}$${e.pin_hash}`;
    const existe = tx.select({ id: schema.estudiantes.id }).from(schema.estudiantes).where(eq(schema.estudiantes.usuario, usuario)).get();

    if (existe) {
      tx.update(schema.estudiantes).set({ grupoId, nombre: e.nombre }).where(eq(schema.estudiantes.id, existe.id)).run();
      actualizados++;
    } else {
      tx.insert(schema.estudiantes).values({ grupoId, nombre: e.nombre, usuario, pinHash }).run();
      creados++;
    }
  }
});

console.log("✅ Importación terminada");
console.log(`   grupos:       ${mapaGrupos.size}`);
console.log(`   estudiantes:  ${creados} nuevos, ${actualizados} actualizados, ${omitidos} omitidos`);
console.log("   Los estudiantes entran con su mismo PIN de antes.");
sqlite.close();
