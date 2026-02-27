// server.js — PRO (SQLite) con:
// ✅ grupos/estudiantes + PIN (sin login)
// ✅ token con caducidad REAL (server valida exp)
// ✅ endpoint /api/me para validar sesión desde el front
// ✅ resultados guardados (requiere token)
// ✅ intro / talleres / quiz (PÚBLICOS)
// ✅ plantillas + generador aleatorio (PÚBLICO)
// ✅ mantiene tus rutas grados/temas/subtemas/actividades

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const cors = require("cors");
const crypto = require("crypto");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const SERVER_SECRET = process.env.SERVER_SECRET || "dev-secret-cambia-esto";
const TOKEN_HORAS = Number(process.env.TOKEN_HORAS || 6);
const DB_PATH = process.env.DB_PATH || "./database.sqlite";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// DB
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error("❌ Error al conectar DB:", err.message);
  else console.log("✅ Conectado a SQLite");
});

// Promesas helpers
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
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

// --- Auth “suave” (token firmado) ---
function signToken(payloadObj) {
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", SERVER_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = crypto
    .createHmac("sha256", SERVER_SECRET)
    .update(payload)
    .digest("base64url");
  if (sig !== expected) return null;

  try {
    const obj = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    // ✅ Caducidad REAL
    if (obj.exp && Date.now() > obj.exp) return null;
    return obj;
  } catch {
    return null;
  }
}

function authRequired(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: "No autorizado / sesión vencida" });

  req.user = data; // { estudiante_id, grupo_id, exp }
  next();
}

// Hash PIN por estudiante (salt + sha256)
function makeSalt() {
  return crypto.randomBytes(8).toString("hex");
}
function hashPin(pin, salt) {
  return crypto
    .createHash("sha256")
    .update(String(salt) + String(pin))
    .digest("hex");
}

// -------------------------
// INIT DB + SEED
// -------------------------
db.serialize(async () => {
  try {
    // Core
    await run(`
      CREATE TABLE IF NOT EXISTS grados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS temas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        grado_id INTEGER,
        orden INTEGER,
        FOREIGN KEY (grado_id) REFERENCES grados(id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS subtemas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        tema_id INTEGER,
        orden INTEGER,
        FOREIGN KEY (tema_id) REFERENCES temas(id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS actividades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        subtema_id INTEGER,
        tipo TEXT,
        orden INTEGER,
        pregunta TEXT,
        respuesta TEXT,
        FOREIGN KEY (subtema_id) REFERENCES subtemas(id)
      )
    `);

    // grupos / estudiantes
    await run(`
      CREATE TABLE IF NOT EXISTS grupos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS estudiantes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grupo_id INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        salt TEXT NOT NULL,
        pin_hash TEXT NOT NULL,
        FOREIGN KEY (grupo_id) REFERENCES grupos(id)
      )
    `);

    // resultados
    await run(`
      CREATE TABLE IF NOT EXISTS resultados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        estudiante_id INTEGER NOT NULL,
        subtema_id INTEGER NOT NULL,
        tipo TEXT NOT NULL,
        puntaje INTEGER NOT NULL,
        total INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id),
        FOREIGN KEY (subtema_id) REFERENCES subtemas(id)
      )
    `);

    // contenido
    await run(`
      CREATE TABLE IF NOT EXISTS intro (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subtema_id INTEGER NOT NULL,
        titulo TEXT NOT NULL,
        html TEXT NOT NULL,
        FOREIGN KEY (subtema_id) REFERENCES subtemas(id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS talleres (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subtema_id INTEGER NOT NULL,
        titulo TEXT NOT NULL,
        enunciado TEXT NOT NULL,
        solucion TEXT,
        FOREIGN KEY (subtema_id) REFERENCES subtemas(id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS quiz (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subtema_id INTEGER NOT NULL,
        tipo TEXT NOT NULL,
        pregunta TEXT NOT NULL,
        opciones_json TEXT,
        respuesta TEXT NOT NULL,
        explicacion TEXT,
        FOREIGN KEY (subtema_id) REFERENCES subtemas(id)
      )
    `);

    // plantillas
    await run(`
      CREATE TABLE IF NOT EXISTS plantillas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subtema_id INTEGER NOT NULL,
        tipo TEXT NOT NULL,
        config TEXT NOT NULL,
        peso INTEGER DEFAULT 1,
        FOREIGN KEY (subtema_id) REFERENCES subtemas(id)
      )
    `);

    // ---------------- SEED ----------------
    const g = await get("SELECT COUNT(*) as count FROM grados");
    if ((g?.count ?? 0) === 0) {
      await run("INSERT INTO grados (nombre) VALUES ('Sexto')");
      await run("INSERT INTO grados (nombre) VALUES ('Séptimo')");
      console.log("✅ Seed: grados");
    }

    const t = await get("SELECT COUNT(*) as count FROM temas");
    if ((t?.count ?? 0) === 0) {
      await run("INSERT INTO temas (nombre, grado_id, orden) VALUES ('Sistema de Números Naturales', 1, 1)");
      await run("INSERT INTO temas (nombre, grado_id, orden) VALUES ('Sistema de Números Racionales', 1, 2)");
      await run("INSERT INTO temas (nombre, grado_id, orden) VALUES ('Ángulos y Polígonos', 1, 3)");
      await run("INSERT INTO temas (nombre, grado_id, orden) VALUES ('Estadística', 1, 4)");

      await run("INSERT INTO temas (nombre, grado_id, orden) VALUES ('Sistema Numérico de los Enteros', 2, 1)");
      await run("INSERT INTO temas (nombre, grado_id, orden) VALUES ('Ecuaciones', 2, 2)");
      await run("INSERT INTO temas (nombre, grado_id, orden) VALUES ('Polígonos', 2, 3)");
      await run("INSERT INTO temas (nombre, grado_id, orden) VALUES ('Congruencia y Semejanza', 2, 4)");
      await run("INSERT INTO temas (nombre, grado_id, orden) VALUES ('Distribución de Frecuencias', 2, 5)");
      console.log("✅ Seed: temas");
    }

    const s = await get("SELECT COUNT(*) as count FROM subtemas");
    if ((s?.count ?? 0) === 0) {
      await run("INSERT INTO subtemas (nombre, tema_id, orden) VALUES ('Operaciones básicas', 1, 1)");
      await run("INSERT INTO subtemas (nombre, tema_id, orden) VALUES ('Potenciación', 1, 2)");
      await run("INSERT INTO subtemas (nombre, tema_id, orden) VALUES ('Radicación', 1, 3)");
      await run("INSERT INTO subtemas (nombre, tema_id, orden) VALUES ('Logaritmación', 1, 4)");

      await run("INSERT INTO subtemas (nombre, tema_id, orden) VALUES ('Suma y resta de fracciones', 2, 1)");
      await run("INSERT INTO subtemas (nombre, tema_id, orden) VALUES ('Multiplicación y división de fracciones', 2, 2)");
      await run("INSERT INTO subtemas (nombre, tema_id, orden) VALUES ('Potencia y raíz de fracción', 2, 3)");

      await run("INSERT INTO subtemas (nombre, tema_id, orden) VALUES ('Construcción de ángulos', 3, 1)");
      await run("INSERT INTO subtemas (nombre, tema_id, orden) VALUES ('Polígonos regulares', 3, 2)");
      await run("INSERT INTO subtemas (nombre, tema_id, orden) VALUES ('Triángulos', 3, 3)");

      await run("INSERT INTO subtemas (nombre, tema_id, orden) VALUES ('Población y muestra', 4, 1)");
      await run("INSERT INTO subtemas (nombre, tema_id, orden) VALUES ('Variables', 4, 2)");
      await run("INSERT INTO subtemas (nombre, tema_id, orden) VALUES ('Recolección de datos', 4, 3)");
      console.log("✅ Seed: subtemas");
    }

    const gr = await get("SELECT COUNT(*) as count FROM grupos");
    if ((gr?.count ?? 0) === 0) {
      await run("INSERT INTO grupos (nombre) VALUES ('6A')");
      await run("INSERT INTO grupos (nombre) VALUES ('7A')");
      console.log("✅ Seed: grupos");
    }

    const es = await get("SELECT COUNT(*) as count FROM estudiantes");
    if ((es?.count ?? 0) === 0) {
      const salt1 = makeSalt();
      const salt2 = makeSalt();
      await run("INSERT INTO estudiantes (grupo_id, nombre, salt, pin_hash) VALUES (?,?,?,?)",
        [1, "Juan Pérez", salt1, hashPin("1234", salt1)]
      );
      await run("INSERT INTO estudiantes (grupo_id, nombre, salt, pin_hash) VALUES (?,?,?,?)",
        [1, "María Gómez", salt2, hashPin("1111", salt2)]
      );
      console.log("✅ Seed: estudiantes (demo)");
    }

    const ic = await get("SELECT COUNT(*) as count FROM intro");
    if ((ic?.count ?? 0) === 0) {
      await run("INSERT INTO intro (subtema_id, titulo, html) VALUES (?,?,?)",
        [3, "¿Qué es una raíz?", "<p>La <b>radicación</b> es la operación inversa de la potenciación.</p><p>Ej: √25 = 5 porque 5² = 25.</p>"]
      );
      console.log("✅ Seed: intro (demo)");
    }

    const tc = await get("SELECT COUNT(*) as count FROM talleres");
    if ((tc?.count ?? 0) === 0) {
      await run("INSERT INTO talleres (subtema_id, titulo, enunciado, solucion) VALUES (?,?,?,?)",
        [3, "Taller 1 - Raíces", "<p>Calcula: √36, √49, √64</p>", "<p>√36=6, √49=7, √64=8</p>"]
      );
      console.log("✅ Seed: talleres (demo)");
    }

    const qc = await get("SELECT COUNT(*) as count FROM quiz");
    if ((qc?.count ?? 0) === 0) {
      await run("INSERT INTO quiz (subtema_id, tipo, pregunta, opciones_json, respuesta, explicacion) VALUES (?,?,?,?,?,?)",
        [3, "mcq", "¿Cuál es √81?", JSON.stringify(["7","8","9","10"]), "9", "Porque 9×9=81."]
      );
      await run("INSERT INTO quiz (subtema_id, tipo, pregunta, opciones_json, respuesta, explicacion) VALUES (?,?,?,?,?,?)",
        [3, "vf", "√16 = 8", null, "F", "√16=4."]
      );
      console.log("✅ Seed: quiz (demo)");
    }

    const pc = await get("SELECT COUNT(*) as count FROM plantillas");
    if ((pc?.count ?? 0) === 0) {
      await run("INSERT INTO plantillas (subtema_id,tipo,config,peso) VALUES (?,?,?,?)",
        [1, "aritmetica", JSON.stringify({ op: "add", min: 1, max: 30 }), 4]
      );
      await run("INSERT INTO plantillas (subtema_id,tipo,config,peso) VALUES (?,?,?,?)",
        [1, "aritmetica", JSON.stringify({ op: "sub", min: 1, max: 30, noNegativos: true }), 3]
      );
      await run("INSERT INTO plantillas (subtema_id,tipo,config,peso) VALUES (?,?,?,?)",
        [1, "aritmetica", JSON.stringify({ op: "mul", min: 2, max: 12 }), 2]
      );

      await run("INSERT INTO plantillas (subtema_id,tipo,config,peso) VALUES (?,?,?,?)",
        [2, "potencia", JSON.stringify({ baseMin: 2, baseMax: 12, expMin: 2, expMax: 3 }), 1]
      );

      await run("INSERT INTO plantillas (subtema_id,tipo,config,peso) VALUES (?,?,?,?)",
        [3, "raiz", JSON.stringify({ nMin: 2, nMax: 15 }), 1]
      );

      await run("INSERT INTO plantillas (subtema_id,tipo,config,peso) VALUES (?,?,?,?)",
        [4, "log", JSON.stringify({ base: 10, expMin: 1, expMax: 4 }), 1]
      );

      console.log("✅ Seed: plantillas");
    }
  } catch (e) {
    console.error("❌ Error init DB:", e.message);
  }
});

// -------------------------
// RUTAS (las tuyas)
// -------------------------
app.get("/api/grados", (req, res) => {
  db.all("SELECT * FROM grados", (err, rows) => (err ? res.status(500).json(err) : res.json(rows)));
});

app.get("/api/temas/:gradoId", (req, res) => {
  db.all(
    "SELECT * FROM temas WHERE grado_id = ? ORDER BY orden ASC",
    [req.params.gradoId],
    (err, rows) => (err ? res.status(500).json(err) : res.json(rows)))
});

app.get("/api/subtemas/:temaId", (req, res) => {
  db.all(
    "SELECT * FROM subtemas WHERE tema_id = ? ORDER BY orden ASC",
    [req.params.temaId],
    (err, rows) => (err ? res.status(500).json(err) : res.json(rows)))
});

app.get("/api/actividades/:subtemaId", (req, res) => {
  db.all(
    "SELECT * FROM actividades WHERE subtema_id = ? ORDER BY orden ASC",
    [req.params.subtemaId],
    (err, rows) => (err ? res.status(500).json(err) : res.json(rows)))
});

// -------------------------
// grupos/estudiantes + sesión PIN
// -------------------------
app.get("/api/grupos", async (req, res) => {
  try {
    const rows = await all("SELECT * FROM grupos ORDER BY nombre ASC");
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/estudiantes/:grupoId", async (req, res) => {
  try {
    const rows = await all(
      "SELECT id, grupo_id, nombre FROM estudiantes WHERE grupo_id = ? ORDER BY nombre ASC",
      [req.params.grupoId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ✅ Valida PIN y devuelve token con expiración REAL
app.post("/api/sesion", async (req, res) => {
  try {
    const { estudiante_id, pin } = req.body || {};
    if (!estudiante_id || !pin) return res.status(400).json({ error: "Falta estudiante_id o pin" });

    const est = await get("SELECT * FROM estudiantes WHERE id = ?", [estudiante_id]);
    if (!est) return res.status(404).json({ error: "Estudiante no existe" });

    const h = hashPin(pin, est.salt);
    if (h !== est.pin_hash) return res.status(401).json({ error: "PIN incorrecto" });

    const token = signToken({
      estudiante_id: est.id,
      grupo_id: est.grupo_id,
      exp: Date.now() + TOKEN_HORAS * 60 * 60 * 1000,
    });

    res.json({ ok: true, token, estudiante_id: est.id, grupo_id: est.grupo_id, nombre: est.nombre, exp_horas: TOKEN_HORAS });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ✅ para que el FRONT pueda validar si la sesión sigue viva
app.get("/api/me", authRequired, async (req, res) => {
  try {
    const est = await get("SELECT id, grupo_id, nombre FROM estudiantes WHERE id = ?", [req.user.estudiante_id]);
    if (!est) return res.status(404).json({ error: "Estudiante no existe" });
    res.json({ ok: true, ...est });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// logout “soft”
app.post("/api/logout", (req, res) => {
  res.json({ ok: true });
});

// -------------------------
// Contenido (TABS) — ✅ PÚBLICO (SIN authRequired)
// -------------------------
app.get("/api/intro/:subtemaId", async (req, res) => {
  try {
    const rows = await all("SELECT * FROM intro WHERE subtema_id = ? ORDER BY id ASC", [req.params.subtemaId]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/talleres/:subtemaId", async (req, res) => {
  try {
    const rows = await all("SELECT * FROM talleres WHERE subtema_id = ? ORDER BY id ASC", [req.params.subtemaId]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/quiz/:subtemaId", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 10)));
    const rows = await all(
      "SELECT * FROM quiz WHERE subtema_id = ? ORDER BY RANDOM() LIMIT ?",
      [req.params.subtemaId, limit]
    );

    const out = rows.map((q) => ({
      ...q,
      opciones: q.opciones_json ? JSON.parse(q.opciones_json) : null,
    }));

    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// -------------------------
// Resultados (PROTEGIDO)
// -------------------------
app.post("/api/resultados", authRequired, async (req, res) => {
  try {
    const { subtema_id, tipo, puntaje, total } = req.body || {};
    if (!subtema_id || !tipo || puntaje == null || total == null) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    const estudiante_id = req.user.estudiante_id;

    await run(
      "INSERT INTO resultados (estudiante_id, subtema_id, tipo, puntaje, total) VALUES (?,?,?,?,?)",
      [estudiante_id, subtema_id, tipo, puntaje, total]
    );

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// historial (déjalo así por ahora)
app.get("/api/resultados/estudiante/:id", async (req, res) => {
  try {
    const rows = await all(
      `SELECT r.*, s.nombre as subtema
       FROM resultados r
       JOIN subtemas s ON s.id = r.subtema_id
       WHERE r.estudiante_id = ?
       ORDER BY r.created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// -------------------------
// EJERCICIO RANDOM (plantillas) — ✅ PÚBLICO (SIN authRequired)
// -------------------------
app.get("/api/ejercicio/random/:subtemaId", async (req, res) => {
  try {
    const subtemaId = Number(req.params.subtemaId);
    if (!subtemaId) return res.status(400).json({ error: "subtemaId inválido" });

    const plantillas = await all("SELECT * FROM plantillas WHERE subtema_id = ?", [subtemaId]);
    if (!plantillas.length) return res.status(404).json({ error: "No hay plantillas para este subtema" });

    const total = plantillas.reduce((acc, p) => acc + (p.peso || 1), 0);
    let r = Math.random() * total;
    let elegida = plantillas[0];
    for (const p of plantillas) {
      r -= (p.peso || 1);
      if (r <= 0) { elegida = p; break; }
    }

    const config = JSON.parse(elegida.config);
    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    if (elegida.tipo === "aritmetica") {
      const op = config.op || "add";
      const min = Number(config.min ?? 1);
      const max = Number(config.max ?? 10);
      const noNeg = Boolean(config.noNegativos);

      let a = randInt(min, max);
      let b = randInt(min, max);

      let pregunta = "";
      let respuesta = 0;

      if (op === "add") {
        pregunta = `¿Cuánto es ${a} + ${b}?`; respuesta = a + b;
      } else if (op === "sub") {
        if (noNeg && b > a) [a, b] = [b, a];
        pregunta = `¿Cuánto es ${a} - ${b}?`; respuesta = a - b;
      } else if (op === "mul") {
        pregunta = `¿Cuánto es ${a} × ${b}?`; respuesta = a * b;
      } else if (op === "div") {
        b = randInt(min, max);
        const m = randInt(min, max);
        a = b * m;
        pregunta = `¿Cuánto es ${a} ÷ ${b}?`; respuesta = m;
      } else {
        return res.status(400).json({ error: "Operación no soportada", config });
      }

      return res.json({ tipo: "quiz", subtema_id: subtemaId, plantilla_id: elegida.id, pregunta, respuesta: String(respuesta) });
    }

    if (elegida.tipo === "potencia") {
      const baseMin = Number(config.baseMin ?? 2);
      const baseMax = Number(config.baseMax ?? 10);
      const expMin = Number(config.expMin ?? 2);
      const expMax = Number(config.expMax ?? 3);
      const base = randInt(baseMin, baseMax);
      const exp = randInt(expMin, expMax);
      return res.json({
        tipo: "quiz",
        subtema_id: subtemaId,
        plantilla_id: elegida.id,
        pregunta: `Calcula: ${base}^${exp}`,
        respuesta: String(Math.pow(base, exp)),
      });
    }

    if (elegida.tipo === "raiz") {
      const nMin = Number(config.nMin ?? 2);
      const nMax = Number(config.nMax ?? 15);
      const n = randInt(nMin, nMax);
      return res.json({
        tipo: "quiz",
        subtema_id: subtemaId,
        plantilla_id: elegida.id,
        pregunta: `Calcula: √${n * n}`,
        respuesta: String(n),
      });
    }

    if (elegida.tipo === "log") {
      const base = Number(config.base ?? 10);
      const expMin = Number(config.expMin ?? 1);
      const expMax = Number(config.expMax ?? 4);
      const exp = randInt(expMin, expMax);
      return res.json({
        tipo: "quiz",
        subtema_id: subtemaId,
        plantilla_id: elegida.id,
        pregunta: `Calcula: log_${base}(${Math.pow(base, exp)})`,
        respuesta: String(exp),
      });
    }

    return res.status(400).json({ error: "Tipo de plantilla no soportado", tipo: elegida.tipo });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error generando ejercicio", detail: e.message });
  }
});

app.listen(PORT, () => console.log(`✅ Servidor corriendo en http://localhost:${PORT}`));