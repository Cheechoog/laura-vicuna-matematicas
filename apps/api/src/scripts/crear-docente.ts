// Crea o actualiza una cuenta docente.
//   npm run docente:crear -- --nombre "María Azucena Gil" --usuario azucena --pin 123456
import { parseArgs } from "node:util";
import { aplicarMigraciones, db, schema, sqlite } from "../db/client.js";
import { hashPin } from "../modules/auth/pin.js";

const { values } = parseArgs({
  options: { nombre: { type: "string" }, usuario: { type: "string" }, pin: { type: "string" } },
});

if (!values.nombre || !values.usuario || !values.pin || !/^\d{4,12}$/.test(values.pin)) {
  console.error('Uso: npm run docente:crear -- --nombre "Nombre" --usuario usuario --pin 123456');
  console.error("     (el PIN debe tener entre 4 y 12 números)");
  process.exit(1);
}

aplicarMigraciones();
const usuario = values.usuario.trim().toLowerCase();
db.insert(schema.docentes)
  .values({ nombre: values.nombre.trim(), usuario, pinHash: hashPin(values.pin) })
  .onConflictDoUpdate({
    target: schema.docentes.usuario,
    set: { nombre: values.nombre.trim(), pinHash: hashPin(values.pin), activo: true },
  })
  .run();

console.log(`✅ Docente "${values.nombre}" lista. Usuario: ${usuario}`);
sqlite.close();
