// import.js
// Importa contenido desde /data/*.json a SQLite con UPSERT "inteligente"
// NO borra nada por defecto (solo inserta o actualiza si encuentra "mismo registro")

const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const DB_PATH = process.env.DB_PATH || "./database.sqlite";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");

// Cambia a true si quieres "limpiar" tablas antes de importar
const WIPE_BEFORE_IMPORT = String(process.env.WIPE || "0") === "1";

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

function readJson(file) {
  const full = path.join(DATA_DIR, file);
  if (!fs.existsSync(full)) return [];
  const raw = fs.readFileSync(full, "utf8");
  if (!raw.trim()) return [];
  return JSON.parse(raw);
}

// ---------- UPSERTS ----------

async function upsertIntro(item) {
  // clave "natural": (subtema_id, titulo)
  const row = await get(
    "SELECT id FROM intro WHERE subtema_id = ? AND titulo = ?",
    [item.subtema_id, item.titulo]
  );

  if (row?.id) {
    await run(
      "UPDATE intro SET html = ? WHERE id = ?",
      [item.html, row.id]
    );
    return { action: "update", id: row.id };
  } else {
    const ins = await run(
      "INSERT INTO intro (subtema_id, titulo, html) VALUES (?,?,?)",
      [item.subtema_id, item.titulo, item.html]
    );
    return { action: "insert", id: ins.lastID };
  }
}

async function upsertTaller(item) {
  // clave "natural": (subtema_id, titulo)
  const row = await get(
    "SELECT id FROM talleres WHERE subtema_id = ? AND titulo = ?",
    [item.subtema_id, item.titulo]
  );

  if (row?.id) {
    await run(
      "UPDATE talleres SET enunciado = ?, solucion = ? WHERE id = ?",
      [item.enunciado, item.solucion || null, row.id]
    );
    return { action: "update", id: row.id };
  } else {
    const ins = await run(
      "INSERT INTO talleres (subtema_id, titulo, enunciado, solucion) VALUES (?,?,?,?)",
      [item.subtema_id, item.titulo, item.enunciado, item.solucion || null]
    );
    return { action: "insert", id: ins.lastID };
  }
}

async function upsertQuiz(item) {
  // clave "natural": (subtema_id, tipo, pregunta)
  const row = await get(
    "SELECT id FROM quiz WHERE subtema_id = ? AND tipo = ? AND pregunta = ?",
    [item.subtema_id, item.tipo, item.pregunta]
  );

  const opciones_json = item.opciones ? JSON.stringify(item.opciones) : null;

  if (row?.id) {
    await run(
      "UPDATE quiz SET opciones_json = ?, respuesta = ?, explicacion = ? WHERE id = ?",
      [opciones_json, item.respuesta, item.explicacion || null, row.id]
    );
    return { action: "update", id: row.id };
  } else {
    const ins = await run(
      "INSERT INTO quiz (subtema_id, tipo, pregunta, opciones_json, respuesta, explicacion) VALUES (?,?,?,?,?,?)",
      [item.subtema_id, item.tipo, item.pregunta, opciones_json, item.respuesta, item.explicacion || null]
    );
    return { action: "insert", id: ins.lastID };
  }
}

async function upsertPlantilla(item) {
  // clave "natural": (subtema_id, tipo, config)
  const configStr = JSON.stringify(item.config || {});
  const row = await get(
    "SELECT id FROM plantillas WHERE subtema_id = ? AND tipo = ? AND config = ?",
    [item.subtema_id, item.tipo, configStr]
  );

  const peso = item.peso == null ? 1 : Number(item.peso);

  if (row?.id) {
    await run(
      "UPDATE plantillas SET peso = ? WHERE id = ?",
      [peso, row.id]
    );
    return { action: "update", id: row.id };
  } else {
    const ins = await run(
      "INSERT INTO plantillas (subtema_id, tipo, config, peso) VALUES (?,?,?,?)",
      [item.subtema_id, item.tipo, configStr, peso]
    );
    return { action: "insert", id: ins.lastID };
  }
}

// ---------- MAIN ----------
async function main() {
  try {
    console.log("🗄️ DB:", DB_PATH);
    console.log("📦 DATA:", DATA_DIR);

    if (WIPE_BEFORE_IMPORT) {
      console.log("⚠️ WIPE=1 -> limpiando tablas de contenido...");
      await run("DELETE FROM intro");
      await run("DELETE FROM talleres");
      await run("DELETE FROM quiz");
      await run("DELETE FROM plantillas");
    }

    const intro = readJson("intro.json");
    const talleres = readJson("talleres.json");
    const quiz = readJson("quiz.json");
    const plantillas = readJson("plantillas.json");

    console.log(`Intro: ${intro.length}, Talleres: ${talleres.length}, Quiz: ${quiz.length}, Plantillas: ${plantillas.length}`);

    let stats = { intro: { insert: 0, update: 0 }, talleres: { insert: 0, update: 0 }, quiz: { insert: 0, update: 0 }, plantillas: { insert: 0, update: 0 } };

    for (const it of intro) {
      if (!it?.subtema_id || !it?.titulo || !it?.html) continue;
      const r = await upsertIntro(it);
      stats.intro[r.action]++;
    }
    for (const it of talleres) {
      if (!it?.subtema_id || !it?.titulo || !it?.enunciado) continue;
      const r = await upsertTaller(it);
      stats.talleres[r.action]++;
    }
    for (const it of quiz) {
      if (!it?.subtema_id || !it?.tipo || !it?.pregunta || it?.respuesta == null) continue;
      const r = await upsertQuiz(it);
      stats.quiz[r.action]++;
    }
    for (const it of plantillas) {
      if (!it?.subtema_id || !it?.tipo || !it?.config) continue;
      const r = await upsertPlantilla(it);
      stats.plantillas[r.action]++;
    }

    console.log("✅ Import terminado:");
    console.log(stats);
  } catch (e) {
    console.error("❌ Error import:", e);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}



main();