// =====================================================================
// DATOS DE PRUEBA (solo desarrollo)
//   npm run db:demo
// Crea una docente y un grupo de prueba por grado con PINs conocidos.
// =====================================================================
import { and, eq } from "drizzle-orm";
import { env } from "../config/env.js";
import { aplicarMigraciones, db, schema, sqlite } from "../db/client.js";
import { hashPin } from "../modules/auth/pin.js";

if (env.esProduccion) {
  console.error("❌ db:demo no se puede usar en producción");
  process.exit(1);
}

aplicarMigraciones();

const grados = db.select().from(schema.grados).all();
if (grados.length === 0) {
  console.error("❌ Primero corre: npm run db:seed");
  process.exit(1);
}

const docente = { nombre: "Docente de prueba", usuario: "profe", pin: "2468" };
db.insert(schema.docentes)
  .values({ nombre: docente.nombre, usuario: docente.usuario, pinHash: hashPin(docente.pin) })
  .onConflictDoUpdate({ target: schema.docentes.usuario, set: { pinHash: hashPin(docente.pin), activo: true } })
  .run();

const filas: string[] = [];
for (const g of grados) {
  const nombreGrupo = `Prueba ${g.nombre}`;
  db.insert(schema.grupos).values({ gradoId: g.id, nombre: nombreGrupo }).onConflictDoNothing().run();
  const grupo = db
    .select()
    .from(schema.grupos)
    .where(and(eq(schema.grupos.gradoId, g.id), eq(schema.grupos.nombre, nombreGrupo)))
    .get()!;

  ["Ana Prueba", "Beto Prueba"].forEach((nombre, i) => {
    const usuario = `${nombre.split(" ")[0]!.toLowerCase()}.${g.id}`;
    const pin = `${g.id}${g.id}${i + 1}${i + 1}`.slice(0, 4).padEnd(4, "0");
    db.insert(schema.estudiantes)
      .values({ grupoId: grupo.id, nombre: `${nombre} (${g.nombre})`, usuario, pinHash: hashPin(pin) })
      .onConflictDoUpdate({ target: schema.estudiantes.usuario, set: { pinHash: hashPin(pin), activo: true } })
      .run();
    filas.push(`   ${grupo.nombre.padEnd(14)} ${`${nombre} (${g.nombre})`.padEnd(26)} PIN ${pin}`);
  });
}

console.log("✅ Datos de prueba listos\n");
console.log(`   DOCENTE  usuario: ${docente.usuario}   PIN: ${docente.pin}\n`);
console.log("   ESTUDIANTES");
filas.forEach((f) => console.log(f));
sqlite.close();
