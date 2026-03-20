// scripts/import_students.js
// Importa estudiantes desde data/estudiantes.xlsx o data/estudiantes.xls a SQLite
// ✅ compatible con server.js
// ✅ guarda grado_id, grupo_id, nombre, usuario, salt, pin_hash
// ✅ genera CSV de credenciales con PIN visible para entregar
// ✅ PIN fáciles:
//    6-A -> 6101, 6102, 6103...
//    6-B -> 6201, 6202, 6203...
//    7-A -> 7101, 7102, 7103...
//    7-B -> 7201, 7202, 7203...

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("xlsx");
const sqlite3 = require("sqlite3").verbose();

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.join(PROJECT_ROOT, "database.sqlite");

const XLSX_PATH = path.join(PROJECT_ROOT, "data", "estudiantes.xlsx");
const XLS_PATH = path.join(PROJECT_ROOT, "data", "estudiantes.xls");

const INPUT_PATH = fs.existsSync(XLSX_PATH)
  ? XLSX_PATH
  : fs.existsSync(XLS_PATH)
    ? XLS_PATH
    : null;

const OUT_CSV = path.join(PROJECT_ROOT, "data", "credenciales_estudiantes.csv");

const GRADO_ID_SEXTO = 1;
const GRADO_ID_SEPTIMO = 2;

const ALLOWED_SHEETS = [
  { pattern: /6\s*-\s*A/i, grado_id: GRADO_ID_SEXTO, grupo_nombre: "6-A", pin_prefix: "61" },
  { pattern: /6\s*-\s*B/i, grado_id: GRADO_ID_SEXTO, grupo_nombre: "6-B", pin_prefix: "62" },
  { pattern: /7\s*-\s*A/i, grado_id: GRADO_ID_SEPTIMO, grupo_nombre: "7-A", pin_prefix: "71" },
  { pattern: /7\s*-\s*B/i, grado_id: GRADO_ID_SEPTIMO, grupo_nombre: "7-B", pin_prefix: "72" },
];

const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => (err ? reject(err) : resolve()));
  });
}

function normalizeText(s) {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'");
}

function stripAccents(s) {
  return normalizeText(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/Ñ/g, "N");
}

function makeUsername(fullname, idx) {
  const clean = stripAccents(fullname).toLowerCase();
  const parts = clean.split(" ").filter(Boolean);

  const lastName = parts[0] || "lv";
  const firstName = parts[parts.length - 1] || "est";

  let u = `${firstName}${lastName}`.replace(/[^a-z0-9]/g, "");
  u = `${u}${String(idx).padStart(2, "0")}`;
  return u;
}

// ✅ PIN fáciles por grupo:
// 6-A -> 6101, 6102...
// 6-B -> 6201...
// 7-A -> 7101...
// 7-B -> 7201...
function makeEasyPin(pinPrefix, indexInGroup) {
  const nn = String(indexInGroup).padStart(2, "0");
  return `${pinPrefix}${nn}`;
}

function makeSalt() {
  return crypto.randomBytes(8).toString("hex");
}

function hashPin(pin, salt) {
  return crypto
    .createHash("sha256")
    .update(String(salt) + String(pin))
    .digest("hex");
}

function extractNamesFromSheet(aoa) {
  let headerRow = -1;

  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const hit = row.some((c) => String(c ?? "").toLowerCase().includes("apellidos"));
    if (hit) {
      headerRow = r;
      break;
    }
  }

  if (headerRow === -1) return [];

  const header = aoa[headerRow] || [];
  let col = 1;

  for (let i = 0; i < header.length; i++) {
    if (String(header[i] ?? "").toLowerCase().includes("apellidos")) {
      col = i;
      break;
    }
  }

  const names = [];
  for (let r = headerRow + 1; r < aoa.length; r++) {
    const val = aoa[r]?.[col];
    const s = normalizeText(val);
    if (!s) continue;

    const low = s.toLowerCase();
    if (low.includes("nit")) continue;
    if (low.includes("dane")) continue;
    if (low.includes("listado")) continue;
    if (low.startsWith("total")) continue;

    if (/[a-záéíóúñ]/i.test(s)) names.push(s);
  }

  return Array.from(new Set(names));
}

async function ensureSchema() {
  await exec(`
    CREATE TABLE IF NOT EXISTS grupos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grado_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      UNIQUE(grado_id, nombre)
    );

    CREATE TABLE IF NOT EXISTS estudiantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grado_id INTEGER NOT NULL,
      grupo_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      usuario TEXT,
      salt TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      UNIQUE(usuario)
    );
  `);
}

async function getOrCreateGrupo(grado_id, nombre) {
  const existing = await get(
    "SELECT id FROM grupos WHERE grado_id = ? AND nombre = ?",
    [grado_id, nombre]
  );
  if (existing?.id) return existing.id;

  const r = await run(
    "INSERT INTO grupos (grado_id, nombre) VALUES (?, ?)",
    [grado_id, nombre]
  );
  return r.lastID;
}

async function findEstudianteByGrupoAndNombre(grado_id, grupo_id, nombre) {
  return await get(
    `
    SELECT id, usuario
    FROM estudiantes
    WHERE grado_id = ? AND grupo_id = ? AND nombre = ?
    `,
    [grado_id, grupo_id, nombre]
  );
}

async function findEstudianteByUsuario(usuario) {
  return await get(
    "SELECT id FROM estudiantes WHERE usuario = ?",
    [usuario]
  );
}

async function generateUniqueUsername(base) {
  let candidate = base;
  let n = 2;

  while (true) {
    const exists = await findEstudianteByUsuario(candidate);
    if (!exists) return candidate;
    candidate = `${base}${n}`;
    n++;
  }
}

async function upsertEstudiante(row) {
  const existing = await findEstudianteByGrupoAndNombre(
    row.grado_id,
    row.grupo_id,
    row.nombre
  );

  if (existing?.id) {
    await run(
      `
      UPDATE estudiantes
      SET usuario = ?, salt = ?, pin_hash = ?
      WHERE id = ?
      `,
      [row.usuario, row.salt, row.pin_hash, existing.id]
    );
    return { op: "update" };
  }

  await run(
    `
    INSERT INTO estudiantes (grado_id, grupo_id, nombre, usuario, salt, pin_hash)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [row.grado_id, row.grupo_id, row.nombre, row.usuario, row.salt, row.pin_hash]
  );

  return { op: "insert" };
}

function toCsv(rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["grado", "grupo", "nombre", "usuario", "pin"].map(esc).join(",");
  const lines = rows.map((r) =>
    [r.grado, r.grupo, r.nombre, r.usuario, r.pin].map(esc).join(",")
  );
  return [header, ...lines].join("\n");
}

(async function main() {
  console.log("=== IMPORT ESTUDIANTES ===");

  if (!fs.existsSync(DB_PATH)) {
    console.error("❌ No existe database.sqlite en:", DB_PATH);
    process.exit(1);
  }

  if (!INPUT_PATH) {
    console.error("❌ No existe estudiantes.xlsx ni estudiantes.xls en la carpeta data");
    process.exit(1);
  }

  console.log("📄 Archivo detectado:", INPUT_PATH);

  try {
    await ensureSchema();

    const wb = XLSX.readFile(INPUT_PATH);
    const sheetNames = wb.SheetNames;

    const selected = [];
    for (const sh of sheetNames) {
      const match = ALLOWED_SHEETS.find((x) => x.pattern.test(sh));
      if (match) selected.push({ sheet: sh, ...match });
    }

    if (selected.length === 0) {
      console.error("❌ No encontré hojas 6-A/6-B/7-A/7-B.");
      console.error("Hojas detectadas:", sheetNames);
      process.exit(1);
    }

    let inserts = 0;
    let updates = 0;
    const credRows = [];

    for (const s of selected) {
      const ws = wb.Sheets[s.sheet];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
      const names = extractNamesFromSheet(aoa);

      console.log(
        `[${s.sheet}] grupo=${s.grupo_nombre} gradoId=${s.grado_id} estudiantes=${names.length}`
      );

      const grupo_id = await getOrCreateGrupo(s.grado_id, s.grupo_nombre);

      for (let i = 0; i < names.length; i++) {
        const nombre = normalizeText(names[i]);

        // ✅ el PIN depende solo del grupo y la posición en la lista
        const pin = makeEasyPin(s.pin_prefix, i + 1);

        const salt = makeSalt();
        const pin_hash = hashPin(pin, salt);

        const baseUsuario = makeUsername(nombre, i + 1);
        const usuario = await generateUniqueUsername(baseUsuario);

        const r = await upsertEstudiante({
          grado_id: s.grado_id,
          grupo_id,
          nombre,
          usuario,
          salt,
          pin_hash,
        });

        if (r.op === "insert") inserts++;
        else updates++;

        credRows.push({
          grado: s.grado_id === GRADO_ID_SEXTO ? "Sexto" : "Séptimo",
          grupo: s.grupo_nombre,
          nombre,
          usuario,
          pin,
        });
      }
    }

    fs.writeFileSync(OUT_CSV, toCsv(credRows), "utf8");

    const totalGrupos = await get("SELECT COUNT(*) AS c FROM grupos");
    const totalEstudiantes = await get("SELECT COUNT(*) AS c FROM estudiantes");

    console.log("✅ Import estudiantes terminado");
    console.log("   inserts:", inserts);
    console.log("   updates:", updates);
    console.log("   grupos en DB:", totalGrupos?.c || 0);
    console.log("   estudiantes en DB:", totalEstudiantes?.c || 0);
    console.log("   credenciales:", OUT_CSV);
  } catch (e) {
    console.error("❌ Error importando estudiantes:", e);
    process.exit(1);
  } finally {
    db.close();
  }
})();