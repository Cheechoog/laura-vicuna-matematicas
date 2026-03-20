const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const crypto = require("crypto");
const XLSX = require("xlsx");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const SERVER_SECRET = process.env.SERVER_SECRET || "dev-secret-cambia-esto";
const TOKEN_HORAS = Number(process.env.TOKEN_HORAS || 6);
const TEACHER_PIN = String(process.env.TEACHER_PIN || "9999");
const TEACHER_TOKEN_HORAS = Number(process.env.TEACHER_TOKEN_HORAS || 12);
const DB_PATH = process.env.DB_PATH || "./database.sqlite";

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error("❌ Error al conectar DB:", err.message);
  else console.log("✅ Conectado a SQLite");
});

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

// =========================
// AUTH TOKEN
// =========================
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

  if (!data) {
    return res.status(401).json({ error: "No autorizado / sesión vencida" });
  }

  req.user = data;
  next();
}

function teacherRequired(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const data = verifyToken(token);

  if (!data || data.role !== "teacher") {
    return res.status(401).json({ error: "No autorizado (profesor)" });
  }

  req.teacher = data;
  next();
}

function getTokenDataFromRequest(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  return verifyToken(token);
}

function isTeacherRequest(req) {
  const data = getTokenDataFromRequest(req);
  return !!data && data.role === "teacher";
}

// =========================
// HASH PIN
// =========================
function hashPin(pin, salt) {
  return crypto
    .createHash("sha256")
    .update(String(salt) + String(pin))
    .digest("hex");
}

// =========================
// DISPONIBILIDAD
// =========================
async function isSubtemaDisponible(subtemaId) {
  const row = await get(
    "SELECT habilitado, disponible_desde FROM subtemas WHERE id = ?",
    [subtemaId]
  );
  if (!row) return false;

  const habilitado = Number(row.habilitado || 0) === 1;
  if (!habilitado) return false;

  if (row.disponible_desde) {
    const check = await get(
      "SELECT CASE WHEN datetime('now') >= datetime(?) THEN 1 ELSE 0 END AS ok",
      [row.disponible_desde]
    );
    return Number(check?.ok || 0) === 1;
  }

  return true;
}

function bloqueoMensaje() {
  return "🔒 Este subtema aún no está disponible. Pregunta al profesor.";
}

function requireSubtemaDisponible(paramName = "subtemaId") {
  return async (req, res, next) => {
    try {
      if (isTeacherRequest(req)) {
        return next();
      }

      const subtemaId = Number(req.params[paramName]);
      if (!subtemaId) return res.status(400).json({ error: "subtemaId inválido" });

      const ok = await isSubtemaDisponible(subtemaId);
      if (!ok) return res.status(403).json({ error: bloqueoMensaje() });

      next();
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  };
}

// =========================
// HELPERS
// =========================
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calcularNota(correctas, total) {
  if (!total || Number(total) <= 0) return 1.0;
  const porcentaje = Number(correctas) / Number(total);
  const nota = 1 + porcentaje * 4;
  return Number(nota.toFixed(1));
}

async function getSubtemaContext(subtemaId) {
  return await get(
    `
    SELECT
      s.id AS subtema_id,
      s.nombre AS subtema_nombre,
      t.id AS tema_id,
      t.nombre AS tema_nombre,
      g.id AS grado_id,
      g.nombre AS grado_nombre
    FROM subtemas s
    JOIN temas t ON t.id = s.tema_id
    JOIN grados g ON g.id = t.grado_id
    WHERE s.id = ?
    `,
    [subtemaId]
  );
}

function promedioDosNotas(a, b) {
  const n1 = a == null ? null : Number(a);
  const n2 = b == null ? null : Number(b);

  if (n1 == null && n2 == null) return null;
  if (n1 == null) return Number(n2.toFixed(1));
  if (n2 == null) return Number(n1.toFixed(1));
  return Number(((n1 + n2) / 2).toFixed(1));
}

function safeSheetName(name) {
  return String(name || "Hoja").replace(/[\\/*?:[\]]/g, "").slice(0, 31);
}

function pickOne(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function contarCategorias(arr) {
  const map = new Map();

  arr.forEach((item) => {
    const raw = String(item || "").trim();
    if (!raw) return;

    const key = normalizeText(raw);

    if (!map.has(key)) {
      map.set(key, { valor: raw, frecuencia: 0 });
    }

    map.get(key).frecuencia++;
  });

  return Array.from(map.values()).sort(
    (a, b) => b.frecuencia - a.frecuencia || a.valor.localeCompare(b.valor, "es")
  );
}

function construirListaControlada(categorias, frecuencias) {
  const out = [];
  categorias.forEach((cat, i) => {
    for (let n = 0; n < frecuencias[i]; n++) out.push(cat);
  });
  return shuffleArray(out);
}

function formatList(arr) {
  return arr.join(", ");
}

function formatGraphText(rows) {
  return rows.map((r) => `${r.valor}=${r.frecuencia}`).join(", ");
}

// =========================
// SÉPTIMO - ESTADÍSTICA
// =========================



// =========================
// LEER ARCHIVOS / RECURSOS
// =========================
function readJsonFileSafe(relativePath) {
  try {
    const fullPath = path.join(__dirname, relativePath);

    if (!fs.existsSync(fullPath)) {
      return [];
    }

    const raw = fs.readFileSync(fullPath, "utf8");
    if (!raw || !raw.trim()) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`Error leyendo ${relativePath}:`, error);
    return [];
  }
}



function findGameForSubtema(subtemaId) {
  const juegos = readJsonFileSafe(path.join("data", "juegos.json"));
  return juegos.find((j) => Number(j.subtema_id) === Number(subtemaId)) || null;
}


function findVideoForSubtema(subtemaId) {
  const videos = readJsonFileSafe(path.join("data", "videos.json"));
  return videos.find((v) => Number(v.subtema_id) === Number(subtemaId)) || null;
}

function pickOne(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function makeCategoricalDataset(total = randInt(12, 18)) {
  const bancos = [
    {
      contexto: "deporte favorito del salón",
      xLabel: "Deportes",
      yLabel: "Frecuencia",
      categorias: ["Fútbol", "Baloncesto", "Natación", "Voleibol"]
    },
    {
      contexto: "fruta favorita del curso",
      xLabel: "Frutas",
      yLabel: "Frecuencia",
      categorias: ["Manzana", "Banano", "Naranja", "Uva"]
    },
    {
      contexto: "medio de transporte para llegar al colegio",
      xLabel: "Medio de transporte",
      yLabel: "Cantidad de estudiantes",
      categorias: ["Bus", "Bicicleta", "Caminar", "Moto"]
    },
    {
      contexto: "color favorito",
      xLabel: "Colores",
      yLabel: "Frecuencia",
      categorias: ["Azul", "Rojo", "Verde", "Amarillo"]
    },
    {
      contexto: "tiempo recorrido para llegar al colegio",
      xLabel: "Tiempo",
      yLabel: "Frecuencia",
      categorias: ["10 min", "20 min", "30 min", "40 min"]
    }
  ];

  const banco = pickOne(bancos);
  const counts = {};
  banco.categorias.forEach((c) => (counts[c] = 1));

  let faltan = total - banco.categorias.length;
  while (faltan > 0) {
    const cat = pickOne(banco.categorias);
    counts[cat]++;
    faltan--;
  }

  let acumulada = 0;

  const rows = banco.categorias.map((categoria) => {
    const frecuencia = counts[categoria];
    acumulada += frecuencia;
    return {
      categoria,
      frecuencia,
      acumulada: 0,
      relativa: 0,
      porcentaje: 0
    };
  });

  const totalDatos = rows.reduce((acc, r) => acc + r.frecuencia, 0);

  let sumaAcumulada = 0;
  rows.forEach((r) => {
    sumaAcumulada += r.frecuencia;
    r.acumulada = sumaAcumulada;
    r.relativa = totalDatos ? r.frecuencia / totalDatos : 0;
    r.porcentaje = Math.round(r.relativa * 100);
  });

  const items = [];
  rows.forEach((r) => {
    for (let i = 0; i < r.frecuencia; i++) items.push(r.categoria);
  });

  return {
    contexto: banco.contexto,
    xLabel: banco.xLabel,
    yLabel: banco.yLabel,
    total: totalDatos,
    items: shuffleArray(items),
    rows
  };
}

function makeOrderedDataset() {
  const valores = [0, 1, 2, 3, 4, 5];
  const counts = {};

  valores.forEach((v, i) => {
    counts[v] = i === 0 ? randInt(1, 3) : randInt(2, 5);
  });

  const rows = [];
  let acumulada = 0;

  valores.forEach((v) => {
    const frecuencia = counts[v];
    acumulada += frecuencia;
    rows.push({
      categoria: String(v),
      frecuencia,
      acumulada,
      relativa: 0,
      porcentaje: 0
    });
  });

  const total = rows.reduce((acc, r) => acc + r.frecuencia, 0);

  rows.forEach((r) => {
    r.relativa = total ? r.frecuencia / total : 0;
    r.porcentaje = Math.round(r.relativa * 100);
  });

  const items = [];
  rows.forEach((r) => {
    for (let i = 0; i < r.frecuencia; i++) items.push(r.categoria);
  });

  return {
    contexto: "número de hermanos",
    xLabel: "Número de hermanos",
    yLabel: "Frecuencia",
    total,
    items: shuffleArray(items),
    rows
  };
}

function datasetToText(items) {
  return items.join(", ");
}

function datasetTableText(rows, mode = "simple") {
  if (mode === "relativa") {
    return rows
      .map((r) => `${r.categoria}: ${r.frecuencia} (${r.porcentaje}%)`)
      .join(" | ");
  }

  if (mode === "acumulada") {
    return rows
      .map((r) => `${r.categoria}: f=${r.frecuencia}, F=${r.acumulada}`)
      .join(" | ");
  }

  if (mode === "completa") {
    return rows
      .map((r) => `${r.categoria}: f=${r.frecuencia}, F=${r.acumulada}, fr=${r.relativa.toFixed(2)} (${r.porcentaje}%)`)
      .join(" | ");
  }

  return rows
    .map((r) => `${r.categoria}: ${r.frecuencia}`)
    .join(" | ");
}

function buildQuestionSet(factories, count, prefix) {
  return Array.from({ length: count }, (_, idx) => ({
    id: `${prefix}_${idx}_${Date.now()}`,
    ...pickOne(factories)()
  }));
}

function buildSeptimoStatsPractice(subtemaId) {
  const id = Number(subtemaId);

  if (id === 32) {
    const ds = makeCategoricalDataset();
    const row = pickOne(ds.rows);
    return {
      tipo: "abierta",
      pregunta: `Datos del tema "${ds.contexto}": ${datasetToText(ds.items)}. ¿Cuál es la frecuencia absoluta de ${row.categoria}?`,
      respuesta: String(row.frecuencia)
    };
  }

  if (id === 33) {
    const ds = makeCategoricalDataset();
    const row = pickOne(ds.rows);
    return {
      tipo: "abierta",
      pregunta: `Con estos datos: ${datasetToText(ds.items)}. Si construyes la tabla de frecuencia, ¿qué número debes escribir en la fila de ${row.categoria}?`,
      respuesta: String(row.frecuencia)
    };
  }

  if (id === 34) {
    const ds = makeOrderedDataset();
    const row = pickOne(ds.rows.slice(1));
    const modo = pickOne(["relativa", "acumulada"]);

    if (modo === "relativa") {
      return {
        tipo: "abierta",
        pregunta: `Tabla: ${datasetTableText(ds.rows, "relativa")}. ¿Qué porcentaje corresponde al valor ${row.categoria}? Escribe solo el número.`,
        respuesta: String(row.porcentaje)
      };
    }

    return {
      tipo: "abierta",
      pregunta: `Tabla: ${datasetTableText(ds.rows, "acumulada")}. ¿Cuál es la frecuencia absoluta acumulada del valor ${row.categoria}?`,
      respuesta: String(row.acumulada)
    };
  }

  if (id === 35) {
    const ds = makeCategoricalDataset();
    const mayor = [...ds.rows].sort((a, b) => b.frecuencia - a.frecuencia)[0];
    return {
      tipo: "abierta",
      pregunta: `En un diagrama de barras sobre "${ds.contexto}", construido con esta tabla: ${datasetTableText(ds.rows)}. ¿Qué categoría tendría la barra más alta?`,
      respuesta: String(mayor.categoria)
    };
  }

  return null;
}

function buildSeptimoStatsWorkshop(subtemaId, count = 10) {
  const id = Number(subtemaId);

  if (id === 32) {
    const factories = [
      () => {
        const ds = makeCategoricalDataset();
        const row = pickOne(ds.rows);
        return {
          tipo: "abierta",
          pregunta: `Datos: ${datasetToText(ds.items)}. ¿Cuál es la frecuencia absoluta de ${row.categoria}?`,
          respuesta: String(row.frecuencia)
        };
      },
      () => {
        const ds = makeCategoricalDataset();
        const mayor = [...ds.rows].sort((a, b) => b.frecuencia - a.frecuencia)[0];
        return {
          tipo: "abierta",
          pregunta: `Datos: ${datasetToText(ds.items)}. ¿Qué categoría tiene la frecuencia absoluta mayor?`,
          respuesta: String(mayor.categoria)
        };
      },
      () => {
        const ds = makeCategoricalDataset();
        const menor = [...ds.rows].sort((a, b) => a.frecuencia - b.frecuencia)[0];
        return {
          tipo: "abierta",
          pregunta: `Datos: ${datasetToText(ds.items)}. ¿Qué categoría aparece menos veces?`,
          respuesta: String(menor.categoria)
        };
      },
      () => {
        const ds = makeCategoricalDataset();
        return {
          tipo: "abierta",
          pregunta: `Tabla: ${datasetTableText(ds.rows)}. ¿Cuánto vale la suma de las frecuencias absolutas?`,
          respuesta: String(ds.total)
        };
      },
      () => {
        const ds = makeCategoricalDataset();
        const row = pickOne(ds.rows);
        return {
          tipo: "abierta",
          pregunta: `Tabla: ${datasetTableText(ds.rows)}. ¿Cuál es la frecuencia absoluta de ${row.categoria}?`,
          respuesta: String(row.frecuencia)
        };
      }
    ];

    return buildQuestionSet(factories, count, `tw_stats_${id}`);
  }

  if (id === 33) {
    const factories = [
      () => {
        const ds = makeCategoricalDataset();
        const row = pickOne(ds.rows);
        return {
          tipo: "abierta",
          pregunta: `Organiza estos datos en una tabla: ${datasetToText(ds.items)}. ¿Qué valor debe quedar en la columna de frecuencia para ${row.categoria}?`,
          respuesta: String(row.frecuencia)
        };
      },
      () => {
        const ds = makeCategoricalDataset();
        return {
          tipo: "abierta",
          pregunta: `Si construyes una tabla con estos datos: ${datasetToText(ds.items)}. ¿Cuántos datos hay en total?`,
          respuesta: String(ds.total)
        };
      },
      () => {
        const ds = makeCategoricalDataset();
        const mayor = [...ds.rows].sort((a, b) => b.frecuencia - a.frecuencia)[0];
        return {
          tipo: "abierta",
          pregunta: `Tabla: ${datasetTableText(ds.rows)}. ¿Qué categoría quedaría en la primera fila si ordenas de mayor a menor frecuencia?`,
          respuesta: String(mayor.categoria)
        };
      },
      () => {
        const ds = makeCategoricalDataset();
        const menor = [...ds.rows].sort((a, b) => a.frecuencia - b.frecuencia)[0];
        return {
          tipo: "abierta",
          pregunta: `Tabla: ${datasetTableText(ds.rows)}. ¿Qué categoría tiene la menor frecuencia?`,
          respuesta: String(menor.categoria)
        };
      },
      () => {
        const ds = makeCategoricalDataset();
        const orden = [...ds.rows].sort((a, b) => b.frecuencia - a.frecuencia);
        return {
          tipo: "abierta",
          pregunta: `Tabla: ${datasetTableText(ds.rows)}. ¿Cuál es la diferencia entre la frecuencia más alta y la más baja?`,
          respuesta: String(orden[0].frecuencia - orden[orden.length - 1].frecuencia)
        };
      }
    ];

    return buildQuestionSet(factories, count, `tw_stats_${id}`);
  }

  if (id === 34) {
    const factories = [
      () => {
        const ds = makeOrderedDataset();
        const row = pickOne(ds.rows.slice(1));
        return {
          tipo: "abierta",
          pregunta: `Tabla: ${datasetTableText(ds.rows, "acumulada")}. ¿Cuál es la frecuencia absoluta acumulada de ${row.categoria}?`,
          respuesta: String(row.acumulada)
        };
      },
      () => {
        const ds = makeOrderedDataset();
        const row = pickOne(ds.rows);
        return {
          tipo: "abierta",
          pregunta: `Tabla: ${datasetTableText(ds.rows, "relativa")}. ¿Qué porcentaje corresponde al valor ${row.categoria}? Escribe solo el número.`,
          respuesta: String(row.porcentaje)
        };
      },
      () => {
        const ds = makeOrderedDataset();
        const row = pickOne(ds.rows);
        return {
          tipo: "abierta",
          pregunta: `Tabla completa: ${datasetTableText(ds.rows, "completa")}. ¿Cuál es la frecuencia relativa decimal del valor ${row.categoria}? Escríbela con dos decimales.`,
          respuesta: row.relativa.toFixed(2)
        };
      },
      () => {
        const ds = makeOrderedDataset();
        const row = pickOne(ds.rows.slice(1));
        return {
          tipo: "abierta",
          pregunta: `Si en una tabla la frecuencia acumulada hasta el valor ${row.categoria} es ${row.acumulada}, ¿cuántos datos se han contado hasta ese punto?`,
          respuesta: String(row.acumulada)
        };
      },
      () => {
        const ds = makeOrderedDataset();
        const row = pickOne(ds.rows);
        return {
          tipo: "abierta",
          pregunta: `En la tabla ${datasetTableText(ds.rows, "relativa")}. ¿Qué porcentaje del total representa el valor ${row.categoria}?`,
          respuesta: String(row.porcentaje)
        };
      }
    ];

    return buildQuestionSet(factories, count, `tw_stats_${id}`);
  }

  if (id === 35) {
    const factories = [
      () => {
        const ds = makeCategoricalDataset();
        const mayor = [...ds.rows].sort((a, b) => b.frecuencia - a.frecuencia)[0];
        return {
          tipo: "abierta",
          pregunta: `Gráfico de barras construido a partir de esta tabla: ${datasetTableText(ds.rows)}. ¿Qué barra debe ser la más alta?`,
          respuesta: String(mayor.categoria)
        };
      },
      () => {
        const ds = makeCategoricalDataset();
        const menor = [...ds.rows].sort((a, b) => a.frecuencia - b.frecuencia)[0];
        return {
          tipo: "abierta",
          pregunta: `Gráfico de barras construido a partir de esta tabla: ${datasetTableText(ds.rows)}. ¿Qué barra debe ser la más baja?`,
          respuesta: String(menor.categoria)
        };
      },
      () => {
        const ds = makeCategoricalDataset();
        return {
          tipo: "abierta",
          pregunta: `Si el eje horizontal representa "${ds.xLabel}" y el eje vertical representa "${ds.yLabel}", ¿qué número debe marcar la altura de la barra de ${ds.rows[0].categoria}?`,
          respuesta: String(ds.rows[0].frecuencia)
        };
      },
      () => {
        const ds = makeCategoricalDataset();
        const orden = [...ds.rows].sort((a, b) => b.frecuencia - a.frecuencia);
        return {
          tipo: "abierta",
          pregunta: `En la tabla ${datasetTableText(ds.rows)}. ¿Cuál es la diferencia de altura entre la barra más alta y la más baja?`,
          respuesta: String(orden[0].frecuencia - orden[orden.length - 1].frecuencia)
        };
      },
      () => {
        const ds = makeCategoricalDataset();
        return {
          tipo: "abierta",
          pregunta: `En un gráfico de barras que representa ${datasetTableText(ds.rows)}, ¿cuántos datos hay en total?`,
          respuesta: String(ds.total)
        };
      }
    ];

    return buildQuestionSet(factories, count, `tw_stats_${id}`);
  }

  return [];
}

function buildSeptimoStatsQuiz(subtemaId, count = 5) {
  const id = Number(subtemaId);

  if (id === 32) {
    const ds = makeCategoricalDataset();
    const row = pickOne(ds.rows);
    const mayor = [...ds.rows].sort((a, b) => b.frecuencia - a.frecuencia)[0];

    const bank = [
      {
        tipo: "mcq",
        pregunta: `Datos: ${datasetToText(ds.items)}. ¿Cuál es la frecuencia absoluta de ${row.categoria}?`,
        opciones: shuffleArray([
          String(row.frecuencia),
          String(row.frecuencia + 1),
          String(Math.max(0, row.frecuencia - 1)),
          String(ds.total)
        ]),
        respuesta: String(row.frecuencia)
      },
      {
        tipo: "mcq",
        pregunta: `Tabla: ${datasetTableText(ds.rows)}. ¿Qué categoría tiene la mayor frecuencia absoluta?`,
        opciones: shuffleArray(ds.rows.map((r) => r.categoria)),
        respuesta: String(mayor.categoria)
      },
      {
        tipo: "vf",
        pregunta: `La frecuencia absoluta indica cuántas veces aparece un dato.`,
        respuesta: "V"
      }
    ];

    return shuffleArray(bank).slice(0, count);
  }

  if (id === 33) {
    const ds = makeCategoricalDataset();
    const row = pickOne(ds.rows);

    const bank = [
      {
        tipo: "mcq",
        pregunta: `Si construyes una tabla con estos datos: ${datasetToText(ds.items)}, ¿qué frecuencia lleva ${row.categoria}?`,
        opciones: shuffleArray([
          String(row.frecuencia),
          String(row.frecuencia + 2),
          String(Math.max(0, row.frecuencia - 2)),
          String(ds.total)
        ]),
        respuesta: String(row.frecuencia)
      },
      {
        tipo: "vf",
        pregunta: `La suma de todas las frecuencias de una tabla es igual al número total de datos.`,
        respuesta: "V"
      },
      {
        tipo: "mcq",
        pregunta: `Tabla: ${datasetTableText(ds.rows)}. ¿Cuántos datos hay en total?`,
        opciones: shuffleArray([
          String(ds.total),
          String(ds.total + 1),
          String(ds.total - 1),
          String(ds.rows.length)
        ]),
        respuesta: String(ds.total)
      }
    ];

    return shuffleArray(bank).slice(0, count);
  }

  if (id === 34) {
    const ds = makeOrderedDataset();
    const row = pickOne(ds.rows);

    const bank = [
      {
        tipo: "mcq",
        pregunta: `Tabla: ${datasetTableText(ds.rows, "relativa")}. ¿Qué porcentaje corresponde al valor ${row.categoria}?`,
        opciones: shuffleArray([
          String(row.porcentaje),
          String(row.porcentaje + 10),
          String(Math.max(0, row.porcentaje - 10)),
          String(row.frecuencia)
        ]),
        respuesta: String(row.porcentaje)
      },
      {
        tipo: "mcq",
        pregunta: `Tabla: ${datasetTableText(ds.rows, "acumulada")}. ¿Cuál es la frecuencia absoluta acumulada del valor ${row.categoria}?`,
        opciones: shuffleArray([
          String(row.acumulada),
          String(row.frecuencia),
          String(ds.total),
          String(Math.max(0, row.acumulada - 1))
        ]),
        respuesta: String(row.acumulada)
      },
      {
        tipo: "vf",
        pregunta: `La frecuencia absoluta acumulada se obtiene sumando frecuencias sucesivamente.`,
        respuesta: "V"
      }
    ];

    return shuffleArray(bank).slice(0, count);
  }

  if (id === 35) {
    const ds = makeCategoricalDataset();
    const mayor = [...ds.rows].sort((a, b) => b.frecuencia - a.frecuencia)[0];
    const menor = [...ds.rows].sort((a, b) => a.frecuencia - b.frecuencia)[0];

    const bank = [
      {
        tipo: "mcq",
        pregunta: `En un gráfico de barras construido con ${datasetTableText(ds.rows)}, ¿qué barra sería la más alta?`,
        opciones: shuffleArray(ds.rows.map((r) => r.categoria)),
        respuesta: String(mayor.categoria)
      },
      {
        tipo: "mcq",
        pregunta: `En ese mismo gráfico, ¿qué barra sería la más baja?`,
        opciones: shuffleArray(ds.rows.map((r) => r.categoria)),
        respuesta: String(menor.categoria)
      },
      {
        tipo: "vf",
        pregunta: `En un diagrama de barras, el eje horizontal muestra categorías y el vertical muestra frecuencias.`,
        respuesta: "V"
      }
    ];

    return shuffleArray(bank).slice(0, count);
  }

  return [];
}


// =====================================================
// SEXTO - OPERACIONES BÁSICAS
// =====================================================
function buildSextoOperacionesPractica() {
  const modelos = [
    () => {
      const a = randInt(120, 980);
      const b = randInt(130, 920);
      return {
        tipo: "abierta",
        pregunta: `En la biblioteca del colegio se recibieron ${a} libros en la primera semana y ${b} libros en la segunda. ¿Cuántos libros llegaron en total?`,
        respuesta: String(a + b),
      };
    },
    () => {
      const a = randInt(650, 1500);
      const b = randInt(120, a - 50);
      return {
        tipo: "abierta",
        pregunta: `La tienda escolar tenía ${a} jugos y vendió ${b} durante el descanso. ¿Cuántos jugos quedaron?`,
        respuesta: String(a - b),
      };
    },
    () => {
      const a = randInt(14, 48);
      const b = randInt(12, 36);
      return {
        tipo: "abierta",
        pregunta: `Para una actividad se organizaron ${a} filas con ${b} estudiantes en cada una. ¿Cuántos estudiantes hay en total?`,
        respuesta: String(a * b),
      };
    },
    () => {
      const b = randInt(4, 12);
      const m = randInt(18, 42);
      const a = b * m;
      return {
        tipo: "abierta",
        pregunta: `Se van a repartir ${a} lápices en ${b} cajas de forma equitativa. ¿Cuántos lápices van en cada caja?`,
        respuesta: String(m),
      };
    },
  ];

  return modelos[randInt(0, modelos.length - 1)]();
}

function buildSextoOperacionesTaller(count = 10) {
  const questions = [
    () => {
      const a = randInt(245, 980);
      const b = randInt(120, 930);
      return {
        tipo: "abierta",
        pregunta: `En una campaña de reciclaje, el grado sexto reunió ${a} botellas el lunes y ${b} el martes. ¿Cuántas botellas reunió en total?`,
        respuesta: String(a + b),
      };
    },
    () => {
      const a = randInt(600, 1400);
      const b = randInt(120, a - 50);
      return {
        tipo: "abierta",
        pregunta: `El colegio compró ${a} hojas de papel y usó ${b} en talleres. ¿Cuántas hojas quedaron disponibles?`,
        respuesta: String(a - b),
      };
    },
    () => {
      const a = randInt(18, 48);
      const b = randInt(12, 35);
      return {
        tipo: "abierta",
        pregunta: `En un evento deportivo se organizaron ${a} filas con ${b} estudiantes en cada fila. ¿Cuántos estudiantes participaron?`,
        respuesta: String(a * b),
      };
    },
    () => {
      const b = randInt(5, 12);
      const m = randInt(18, 42);
      const a = b * m;
      return {
        tipo: "abierta",
        pregunta: `Se repartieron ${a} galletas en ${b} mesas por partes iguales. ¿Cuántas galletas recibió cada mesa?`,
        respuesta: String(m),
      };
    },
    () => {
      const a = randInt(350, 850);
      const b = randInt(200, 700);
      const c = randInt(100, 500);
      return {
        tipo: "abierta",
        pregunta: `Una biblioteca recibió ${a} cuentos, ${b} novelas y ${c} libros de ciencias. ¿Cuántos libros recibió en total?`,
        respuesta: String(a + b + c),
      };
    },
  ];

  return shuffleArray(questions)
    .slice(0, count)
    .map((fn, idx) => ({
      id: `tw_op_${idx}_${Date.now()}`,
      ...fn(),
    }));
}

function buildSextoOperacionesQuiz(count = 5) {
  const bank = [
    () => {
      const a = randInt(230, 480);
      const b = randInt(150, 390);
      const r = a + b;
      return {
        tipo: "mcq",
        pregunta: `En una papelería se vendieron ${a} lápices en la mañana y ${b} en la tarde. ¿Cuántos lápices se vendieron en total?`,
        opciones: shuffleArray([String(r), String(r + 10), String(r - 10), String(r + 100)]),
        respuesta: String(r),
      };
    },
    () => ({
      tipo: "vf",
      pregunta: "En una operación como 8 + 2 × 5, primero se debe resolver la multiplicación.",
      respuesta: "V",
    }),
  ];

  return shuffleArray(bank).slice(0, count).map((fn) => fn());
}

// =====================================================
// SÉPTIMO - ENTEROS
// =====================================================
function buildSeptimoEnterosPractica() {
  const modelos = [
    () => {
      const baja = randInt(2, 12);
      return {
        tipo: "abierta",
        pregunta: `Un ascensor está en el piso 0 y baja ${baja} pisos al sótano. ¿En qué piso queda?`,
        respuesta: String(-baja),
      };
    },
    () => {
      const temp = randInt(-12, -2);
      return {
        tipo: "abierta",
        pregunta: `En la madrugada la temperatura fue de ${temp} °C. Escribe ese número entero.`,
        respuesta: String(temp),
      };
    },
  ];

  return modelos[randInt(0, modelos.length - 1)]();
}

function buildSeptimoEnterosTaller(count = 10) {
  const questions = [
    () => {
      const x = randInt(2, 12);
      return {
        tipo: "abierta",
        pregunta: `Un buzo desciende ${x} metros bajo el nivel del mar. ¿Con qué número entero se representa esa posición?`,
        respuesta: String(-x),
      };
    },
    () => {
      const a = randInt(-15, 15);
      return {
        tipo: "abierta",
        pregunta: `Escribe el opuesto de ${a}.`,
        respuesta: String(-a),
      };
    },
  ];

  return shuffleArray(questions)
    .slice(0, count)
    .map((fn, idx) => ({
      id: `tw_ent_${idx}_${Date.now()}`,
      ...fn(),
    }));
}

function buildSeptimoEnterosQuiz(count = 5) {
  const bank = [
    () => ({
      tipo: "mcq",
      pregunta: "¿Cuál número representa una temperatura de 6 grados bajo cero?",
      opciones: shuffleArray(["-6", "6", "0", "-12"]),
      respuesta: "-6",
    }),
    () => ({
      tipo: "vf",
      pregunta: "En la recta numérica, -3 está a la izquierda de 2.",
      respuesta: "V",
    }),
  ];

  return shuffleArray(bank).slice(0, count).map((fn) => fn());
}

async function buildSmartPracticeQuestion(subtemaId) {
  const ctx = await getSubtemaContext(subtemaId);

  if ([32, 33, 34, 35].includes(Number(subtemaId))) {
    return buildSeptimoStatsPractice(Number(subtemaId));
  }

  if (!ctx) return null;

  const nombre = String(ctx.subtema_nombre || "").toLowerCase();

  if (nombre.includes("operaciones básicas")) {
    return buildSextoOperacionesPractica();
  }

  if (
    nombre.includes("números enteros positivos y negativos") ||
    nombre.includes("numeros enteros positivos y negativos")
  ) {
    return buildSeptimoEnterosPractica();
  }

  const plantillas = await all("SELECT * FROM plantillas WHERE subtema_id = ?", [subtemaId]);
  if (!plantillas.length) return null;

  const totalPeso = plantillas.reduce((acc, p) => acc + (Number(p.peso) || 1), 0);
  let r = Math.random() * totalPeso;
  let elegida = plantillas[0];

  for (const p of plantillas) {
    r -= Number(p.peso) || 1;
    if (r <= 0) {
      elegida = p;
      break;
    }
  }

  const config = JSON.parse(elegida.config || "{}");

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
      pregunta = `¿Cuánto es ${a} + ${b}?`;
      respuesta = a + b;
    } else if (op === "sub") {
      if (noNeg && b > a) [a, b] = [b, a];
      pregunta = `¿Cuánto es ${a} - ${b}?`;
      respuesta = a - b;
    } else if (op === "mul") {
      pregunta = `¿Cuánto es ${a} × ${b}?`;
      respuesta = a * b;
    } else if (op === "div") {
      b = randInt(Math.max(2, min), max);
      const m = randInt(min, max);
      a = b * m;
      pregunta = `¿Cuánto es ${a} ÷ ${b}?`;
      respuesta = m;
    }

    return { tipo: "abierta", pregunta, respuesta: String(respuesta) };
  }

  if (elegida.tipo === "potencia") {
    const base = randInt(Number(config.baseMin ?? 2), Number(config.baseMax ?? 10));
    const exp = randInt(Number(config.expMin ?? 2), Number(config.expMax ?? 4));
    return {
      tipo: "abierta",
      pregunta: `Calcula: ${base}^${exp}`,
      respuesta: String(Math.pow(base, exp)),
    };
  }

  if (elegida.tipo === "raiz") {
    const n = randInt(Number(config.nMin ?? 2), Number(config.nMax ?? 15));
    return {
      tipo: "abierta",
      pregunta: `Calcula: √${n * n}`,
      respuesta: String(n),
    };
  }

  if (elegida.tipo === "log") {
    const base = Number(config.base ?? 10);
    const exp = randInt(Number(config.expMin ?? 1), Number(config.expMax ?? 4));
    return {
      tipo: "abierta",
      pregunta: `Calcula: log_${base}(${Math.pow(base, exp)})`,
      respuesta: String(exp),
    };
  }

  return null;
}

async function buildSmartWorkshop(subtemaId, count = 10) {
  if ([32, 33, 34, 35].includes(Number(subtemaId))) {
    return buildSeptimoStatsWorkshop(Number(subtemaId), count);
  }

  const ctx = await getSubtemaContext(subtemaId);
  if (!ctx) return [];

  const nombre = String(ctx.subtema_nombre || "").toLowerCase();

  if (nombre.includes("operaciones básicas")) {
    return buildSextoOperacionesTaller(count);
  }

  if (
    nombre.includes("números enteros positivos y negativos") ||
    nombre.includes("numeros enteros positivos y negativos")
  ) {
    return buildSeptimoEnterosTaller(count);
  }

  return [];
}

async function buildSmartQuiz(subtemaId, count = 5) {
  if ([32, 33, 34, 35].includes(Number(subtemaId))) {
    return buildSeptimoStatsQuiz(Number(subtemaId), count);
  }

  const ctx = await getSubtemaContext(subtemaId);
  if (!ctx) return [];

  const nombre = String(ctx.subtema_nombre || "").toLowerCase();

  if (nombre.includes("operaciones básicas")) {
    return buildSextoOperacionesQuiz(count);
  }

  if (
    nombre.includes("números enteros positivos y negativos") ||
    nombre.includes("numeros enteros positivos y negativos")
  ) {
    return buildSeptimoEnterosQuiz(count);
  }

  const rows = await all(
    "SELECT * FROM quiz WHERE subtema_id = ? ORDER BY RANDOM() LIMIT ?",
    [subtemaId, count]
  );

  return rows.map((q) => ({
    ...q,
    opciones: q.opciones_json ? shuffleArray(JSON.parse(q.opciones_json)) : null,
  }));
}

// =========================
// INIT DB
// =========================
db.serialize(async () => {
  try {
    await run(`
      CREATE TABLE IF NOT EXISTS grados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS periodos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grado_id INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        orden INTEGER NOT NULL DEFAULT 1,
        UNIQUE(grado_id, nombre),
        FOREIGN KEY (grado_id) REFERENCES grados(id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS temas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        grado_id INTEGER,
        periodo_id INTEGER,
        orden INTEGER,
        FOREIGN KEY (grado_id) REFERENCES grados(id),
        FOREIGN KEY (periodo_id) REFERENCES periodos(id)
      )
    `);

    try {
      await run("ALTER TABLE temas ADD COLUMN periodo_id INTEGER");
    } catch {}

    await run(`
      CREATE TABLE IF NOT EXISTS subtemas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        tema_id INTEGER,
        orden INTEGER,
        habilitado INTEGER NOT NULL DEFAULT 0,
        disponible_desde TEXT,
        FOREIGN KEY (tema_id) REFERENCES temas(id)
      )
    `);

    try {
      await run("ALTER TABLE subtemas ADD COLUMN habilitado INTEGER NOT NULL DEFAULT 0");
    } catch {}
    try {
      await run("ALTER TABLE subtemas ADD COLUMN disponible_desde TEXT");
    } catch {}

    await run(`
      CREATE TABLE IF NOT EXISTS grupos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grado_id INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        UNIQUE(grado_id, nombre),
        FOREIGN KEY (grado_id) REFERENCES grados(id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS estudiantes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grado_id INTEGER NOT NULL,
        grupo_id INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        usuario TEXT,
        salt TEXT NOT NULL,
        pin_hash TEXT NOT NULL,
        FOREIGN KEY (grupo_id) REFERENCES grupos(id),
        FOREIGN KEY (grado_id) REFERENCES grados(id)
      )
    `);

    try {
      await run("CREATE UNIQUE INDEX IF NOT EXISTS idx_estudiantes_usuario ON estudiantes(usuario)");
    } catch {}

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

    await run(`
      CREATE TABLE IF NOT EXISTS evaluaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        estudiante_id INTEGER NOT NULL,
        subtema_id INTEGER NOT NULL,
        tipo TEXT NOT NULL,
        correctas INTEGER NOT NULL,
        total INTEGER NOT NULL,
        nota REAL NOT NULL,
        detalle_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id),
        FOREIGN KEY (subtema_id) REFERENCES subtemas(id)
      )
    `);

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
  } catch (e) {
    console.error("❌ Error init DB:", e.message);
  }
});

// =========================
// RUTAS BASE
// =========================
app.get("/api/grados", async (req, res) => {
  try {
    const rows = await all("SELECT * FROM grados ORDER BY id ASC");
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/periodos/:gradoId", async (req, res) => {
  try {
    const rows = await all(
      "SELECT * FROM periodos WHERE grado_id = ? ORDER BY orden ASC, id ASC",
      [req.params.gradoId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/temas/:gradoId", async (req, res) => {
  try {
    const rows = await all(
      "SELECT * FROM temas WHERE grado_id = ? ORDER BY orden ASC, id ASC",
      [req.params.gradoId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/temas/grado/:gradoId/periodo/:periodoId", async (req, res) => {
  try {
    const rows = await all(
      `
      SELECT *
      FROM temas
      WHERE grado_id = ? AND periodo_id = ?
      ORDER BY orden ASC, id ASC
      `,
      [req.params.gradoId, req.params.periodoId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/subtemas/:temaId", async (req, res) => {
  try {
    const rows = await all(
      "SELECT * FROM subtemas WHERE tema_id = ? ORDER BY orden ASC",
      [req.params.temaId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/tema/:temaId/resumen", async (req, res) => {
  try {
    const temaId = Number(req.params.temaId);
    if (!temaId) return res.status(400).json({ error: "temaId inválido" });

    const rows = await all(
      `
      SELECT
        s.id AS subtema_id,
        s.nombre AS subtema_nombre,
        s.orden AS subtema_orden,
        s.habilitado AS habilitado,
        s.disponible_desde AS disponible_desde,

        (SELECT COUNT(*) FROM intro i WHERE i.subtema_id = s.id) AS intro_count,
        (SELECT COUNT(*) FROM talleres t WHERE t.subtema_id = s.id) AS talleres_count,
        (SELECT COUNT(*) FROM quiz q WHERE q.subtema_id = s.id) AS quiz_count,
        (SELECT COUNT(*) FROM plantillas p WHERE p.subtema_id = s.id) AS plantillas_count,

        CASE
          WHEN s.habilitado = 1 AND (s.disponible_desde IS NULL OR datetime('now') >= datetime(s.disponible_desde))
          THEN 1 ELSE 0
        END AS disponible

      FROM subtemas s
      WHERE s.tema_id = ?
      ORDER BY s.orden ASC
      `,
      [temaId]
    );

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =========================
// GRUPOS / ESTUDIANTES
// =========================
app.get("/api/grupos", async (req, res) => {
  try {
    const gradoId = Number(req.query.gradoId || 0);

    if (gradoId) {
      const rows = await all(
        "SELECT * FROM grupos WHERE grado_id = ? ORDER BY nombre ASC",
        [gradoId]
      );
      return res.json(rows);
    }

    const rows = await all("SELECT * FROM grupos ORDER BY nombre ASC");
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/estudiantes/:grupoId", async (req, res) => {
  try {
    const grupoId = Number(req.params.grupoId);
    const gradoId = Number(req.query.gradoId || 0);

    if (!grupoId) return res.status(400).json({ error: "grupoId inválido" });

    let rows;
    if (gradoId) {
      rows = await all(
        `
        SELECT id, grado_id, grupo_id, nombre
        FROM estudiantes
        WHERE grupo_id = ? AND grado_id = ?
        ORDER BY nombre ASC
        `,
        [grupoId, gradoId]
      );
    } else {
      rows = await all(
        `
        SELECT id, grado_id, grupo_id, nombre
        FROM estudiantes
        WHERE grupo_id = ?
        ORDER BY nombre ASC
        `,
        [grupoId]
      );
    }

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/sesion", async (req, res) => {
  try {
    const { estudiante_id, pin } = req.body || {};
    if (!estudiante_id || !pin) {
      return res.status(400).json({ error: "Falta estudiante_id o pin" });
    }

    const est = await get("SELECT * FROM estudiantes WHERE id = ?", [estudiante_id]);
    if (!est) return res.status(404).json({ error: "Estudiante no existe" });

    const h = hashPin(pin, est.salt);
    if (h !== est.pin_hash) {
      return res.status(401).json({ error: "PIN incorrecto" });
    }

    const token = signToken({
      role: "student",
      estudiante_id: est.id,
      grupo_id: est.grupo_id,
      grado_id: est.grado_id,
      exp: Date.now() + TOKEN_HORAS * 60 * 60 * 1000,
    });

    res.json({
      ok: true,
      token,
      estudiante_id: est.id,
      grupo_id: est.grupo_id,
      grado_id: est.grado_id,
      nombre: est.nombre,
      exp_horas: TOKEN_HORAS,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/me", authRequired, async (req, res) => {
  try {
    if (req.user.role === "teacher") {
      return res.json({ ok: true, role: "teacher" });
    }

    const est = await get(
      `
      SELECT
        e.id,
        e.grupo_id,
        e.grado_id,
        e.nombre,
        g.nombre AS grupo_nombre,
        gr.nombre AS grado_nombre
      FROM estudiantes e
      LEFT JOIN grupos g ON g.id = e.grupo_id
      LEFT JOIN grados gr ON gr.id = e.grado_id
      WHERE e.id = ?
      `,
      [req.user.estudiante_id]
    );

    if (!est) return res.status(404).json({ error: "Estudiante no existe" });

    res.json({ ok: true, role: "student", ...est });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =========================
// PROFESOR
// =========================
app.post("/api/profesor/sesion", async (req, res) => {
  try {
    const { pin } = req.body || {};
    if (String(pin || "") !== TEACHER_PIN) {
      return res.status(401).json({ error: "PIN profesor incorrecto" });
    }

    const token = signToken({
      role: "teacher",
      exp: Date.now() + TEACHER_TOKEN_HORAS * 60 * 60 * 1000,
    });

    res.json({
      ok: true,
      token,
      role: "teacher",
      exp_horas: TEACHER_TOKEN_HORAS,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/profesor/subtema/:subtemaId/disponibilidad", teacherRequired, async (req, res) => {
  try {
    const subtemaId = Number(req.params.subtemaId);
    if (!subtemaId) return res.status(400).json({ error: "subtemaId inválido" });

    const { habilitado, disponible_desde } = req.body || {};
    const hab = habilitado ? 1 : 0;
    const dd = disponible_desde ? String(disponible_desde) : null;

    await run(
      "UPDATE subtemas SET habilitado = ?, disponible_desde = ? WHERE id = ?",
      [hab, dd, subtemaId]
    );

    res.json({
      ok: true,
      subtema_id: subtemaId,
      habilitado: hab,
      disponible_desde: dd,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =========================
// API VIDEOS
// =========================
app.get("/api/videos/:subtemaId", async (req, res) => {
  try {
    const subtemaId = Number(req.params.subtemaId);
    if (!subtemaId) {
      return res.status(400).json({ error: "subtemaId inválido" });
    }

    const ctx = await getSubtemaContext(subtemaId);
    if (!ctx) {
      return res.status(404).json({ error: "Subtema no encontrado" });
    }

    const video = findVideoForSubtema(subtemaId);

    return res.json({
      ok: true,
      subtema_id: subtemaId,
      video: video || null,
    });
  } catch (error) {
    console.error("Error cargando video:", error);
    return res.status(500).json({ error: "Error cargando video" });
  }
});

// =========================
// API JUEGOS
// =========================
app.get("/api/juegos/:subtemaId", async (req, res) => {
  try {
    const subtemaId = Number(req.params.subtemaId);
    if (!subtemaId) {
      return res.status(400).json({ error: "subtemaId inválido" });
    }

    const ctx = await getSubtemaContext(subtemaId);
    if (!ctx) {
      return res.status(404).json({ error: "Subtema no encontrado" });
    }

    const juego = findGameForSubtema(subtemaId);

    return res.json(juego || null);
  } catch (error) {
    console.error("Error cargando juego:", error);
    return res.status(500).json({ error: "Error cargando juego" });
  }
});
// =========================
// PANEL DOCENTE - NOTAS
// =========================
app.get("/api/profesor/notas/resumen", teacherRequired, async (req, res) => {
  try {
    const gradoId = Number(req.query.gradoId || 0);
    const periodoId = Number(req.query.periodoId || 0);
    const grupoId = Number(req.query.grupoId || 0);

    if (!gradoId) {
      return res.status(400).json({ error: "gradoId es obligatorio" });
    }

    let filtroPeriodo = "";
    const params = [gradoId];

    if (periodoId) {
      filtroPeriodo = " AND t.periodo_id = ? ";
      params.push(periodoId);
    }

    let filtroGrupo = "";
    if (grupoId) {
      filtroGrupo = " AND g.id = ? ";
      params.push(grupoId);
    }

    const rows = await all(
      `
      SELECT
        e.id AS estudiante_id,
        e.nombre AS estudiante_nombre,
        g.nombre AS grupo_nombre,
        gr.nombre AS grado_nombre,
        t.id AS tema_id,
        t.nombre AS tema_nombre,
        s.id AS subtema_id,
        s.nombre AS subtema_nombre,
        p.nombre AS periodo_nombre,

        (
          SELECT ev.nota
          FROM evaluaciones ev
          WHERE ev.estudiante_id = e.id
            AND ev.subtema_id = s.id
            AND ev.tipo = 'taller'
          ORDER BY ev.id DESC
          LIMIT 1
        ) AS nota_taller,

        (
          SELECT ev.nota
          FROM evaluaciones ev
          WHERE ev.estudiante_id = e.id
            AND ev.subtema_id = s.id
            AND ev.tipo = 'quiz'
          ORDER BY ev.id DESC
          LIMIT 1
        ) AS nota_quiz

      FROM estudiantes e
      JOIN grupos g ON g.id = e.grupo_id
      JOIN grados gr ON gr.id = e.grado_id
      JOIN temas t ON t.grado_id = gr.id
      LEFT JOIN periodos p ON p.id = t.periodo_id
      JOIN subtemas s ON s.tema_id = t.id

      WHERE e.grado_id = ?
      ${filtroPeriodo}
      ${filtroGrupo}

      ORDER BY g.nombre ASC, e.nombre ASC, t.orden ASC, s.orden ASC
      `,
      params
    );

    const salida = rows.map((r) => {
      const promedio = promedioDosNotas(r.nota_taller, r.nota_quiz);
      return {
        estudiante_id: r.estudiante_id,
        estudiante_nombre: r.estudiante_nombre,
        grupo_nombre: r.grupo_nombre,
        grado_nombre: r.grado_nombre,
        periodo_nombre: r.periodo_nombre || "",
        tema_id: r.tema_id,
        tema_nombre: r.tema_nombre,
        subtema_id: r.subtema_id,
        subtema_nombre: r.subtema_nombre,
        nota_taller: r.nota_taller == null ? null : Number(r.nota_taller),
        nota_quiz: r.nota_quiz == null ? null : Number(r.nota_quiz),
        promedio,
      };
    });

    res.json(salida);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/profesor/notas/exportar", teacherRequired, async (req, res) => {
  try {
    const gradoId = Number(req.query.gradoId || 0);
    const periodoId = Number(req.query.periodoId || 0);
    const grupoId = Number(req.query.grupoId || 0);

    if (!gradoId) {
      return res.status(400).json({ error: "gradoId es obligatorio" });
    }

    let filtroPeriodo = "";
    const params = [gradoId];

    if (periodoId) {
      filtroPeriodo = " AND t.periodo_id = ? ";
      params.push(periodoId);
    }

    let filtroGrupo = "";
    if (grupoId) {
      filtroGrupo = " AND g.id = ? ";
      params.push(grupoId);
    }

    const rows = await all(
      `
      SELECT
        e.id AS estudiante_id,
        e.nombre AS estudiante_nombre,
        g.nombre AS grupo_nombre,
        gr.nombre AS grado_nombre,
        t.nombre AS tema_nombre,
        s.nombre AS subtema_nombre,
        p.nombre AS periodo_nombre,

        (
          SELECT ev.nota
          FROM evaluaciones ev
          WHERE ev.estudiante_id = e.id
            AND ev.subtema_id = s.id
            AND ev.tipo = 'taller'
          ORDER BY ev.id DESC
          LIMIT 1
        ) AS nota_taller,

        (
          SELECT ev.nota
          FROM evaluaciones ev
          WHERE ev.estudiante_id = e.id
            AND ev.subtema_id = s.id
            AND ev.tipo = 'quiz'
          ORDER BY ev.id DESC
          LIMIT 1
        ) AS nota_quiz

      FROM estudiantes e
      JOIN grupos g ON g.id = e.grupo_id
      JOIN grados gr ON gr.id = e.grado_id
      JOIN temas t ON t.grado_id = gr.id
      LEFT JOIN periodos p ON p.id = t.periodo_id
      JOIN subtemas s ON s.tema_id = t.id

      WHERE e.grado_id = ?
      ${filtroPeriodo}
      ${filtroGrupo}

      ORDER BY g.nombre ASC, e.nombre ASC, t.orden ASC, s.orden ASC
      `,
      params
    );

    const exportRows = rows.map((r) => ({
      Grado: r.grado_nombre,
      Grupo: r.grupo_nombre,
      Estudiante: r.estudiante_nombre,
      Periodo: r.periodo_nombre || "",
      Tema: r.tema_nombre,
      Subtema: r.subtema_nombre,
      "Nota taller": r.nota_taller == null ? "" : Number(r.nota_taller).toFixed(1),
      "Nota quiz": r.nota_quiz == null ? "" : Number(r.nota_quiz).toFixed(1),
      Promedio:
        promedioDosNotas(r.nota_taller, r.nota_quiz) == null
          ? ""
          : promedioDosNotas(r.nota_taller, r.nota_quiz).toFixed(1),
    }));

    const wb = XLSX.utils.book_new();
    const wsResumen = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(wb, wsResumen, safeSheetName("Resumen"));

    const gruposUnicos = [...new Set(rows.map((r) => r.grupo_nombre))];
    for (const grupo of gruposUnicos) {
      const filasGrupo = exportRows.filter((x) => x.Grupo === grupo);
      const wsGrupo = XLSX.utils.json_to_sheet(filasGrupo);
      XLSX.utils.book_append_sheet(wb, wsGrupo, safeSheetName(grupo));
    }

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    const nombreArchivo = `notas_grado_${gradoId}${periodoId ? `_periodo_${periodoId}` : ""}${grupoId ? `_grupo_${grupoId}` : ""}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo}"`);
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =========================
// CONTENIDO
// =========================
app.get("/api/intro/:subtemaId", requireSubtemaDisponible("subtemaId"), async (req, res) => {
  try {
    const rows = await all(
      "SELECT * FROM intro WHERE subtema_id = ? ORDER BY id ASC",
      [req.params.subtemaId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/talleres/:subtemaId", requireSubtemaDisponible("subtemaId"), async (req, res) => {
  try {
    const rows = await all(
      "SELECT * FROM talleres WHERE subtema_id = ? ORDER BY id ASC",
      [req.params.subtemaId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/taller/generar/:subtemaId", authRequired, requireSubtemaDisponible("subtemaId"), async (req, res) => {
  try {
    const isStudent = req.user.role === "student";
    const isTeacher = req.user.role === "teacher";

    if (!isStudent && !isTeacher) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const subtemaId = Number(req.params.subtemaId);
    const count = Math.max(5, Math.min(20, Number(req.query.count || 10)));

    if (isStudent) {
      const yaEntregado = await get(
        `
        SELECT id
        FROM evaluaciones
        WHERE estudiante_id = ? AND subtema_id = ? AND tipo = 'taller'
        ORDER BY id DESC
        LIMIT 1
        `,
        [req.user.estudiante_id, subtemaId]
      );

      if (yaEntregado) {
        return res.status(409).json({
          error: "Ya entregaste el taller de este subtema.",
          locked: true,
        });
      }
    }

    const preguntas = await buildSmartWorkshop(subtemaId, count);
    if (!preguntas.length) {
      return res.status(404).json({ error: "No hay contenido suficiente para generar taller" });
    }

    res.json({
      subtema_id: subtemaId,
      total: preguntas.length,
      preview_only: isTeacher,
      preguntas,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/quiz/:subtemaId", authRequired, requireSubtemaDisponible("subtemaId"), async (req, res) => {
  try {
    const isStudent = req.user.role === "student";
    const isTeacher = req.user.role === "teacher";

    if (!isStudent && !isTeacher) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const subtemaId = Number(req.params.subtemaId);
    const limit = Math.max(1, Math.min(10, Number(req.query.limit || 5)));

    if (isStudent) {
      const yaEntregado = await get(
        `
        SELECT id
        FROM evaluaciones
        WHERE estudiante_id = ? AND subtema_id = ? AND tipo = 'quiz'
        ORDER BY id DESC
        LIMIT 1
        `,
        [req.user.estudiante_id, subtemaId]
      );

      if (yaEntregado) {
        return res.status(409).json({
          error: "Ya entregaste el quiz de este subtema.",
          locked: true,
        });
      }
    }

    const preguntas = await buildSmartQuiz(subtemaId, limit);
    if (!preguntas.length) {
      return res.status(404).json({ error: "No hay preguntas de quiz para este subtema" });
    }

    res.json(preguntas);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/subtema/:subtemaId/status", async (req, res) => {
  try {
    const subtemaId = Number(req.params.subtemaId);
    if (!subtemaId) return res.status(400).json({ error: "subtemaId inválido" });

    const disponible = await isSubtemaDisponible(subtemaId);

    if (!disponible) {
      return res.json({
        subtema_id: subtemaId,
        bloqueado: true,
        mensaje: bloqueoMensaje(),
        intro: false,
        talleres: false,
        quiz: false,
        practica: false,
        counts: { intro: 0, talleres: 0, quiz: 0, plantillas: 0 },
      });
    }

    const introRow = await get("SELECT COUNT(*) as c FROM intro WHERE subtema_id = ?", [subtemaId]);
    const talleresRow = await get("SELECT COUNT(*) as c FROM talleres WHERE subtema_id = ?", [subtemaId]);
    const quizRow = await get("SELECT COUNT(*) as c FROM quiz WHERE subtema_id = ?", [subtemaId]);
    const plantillasRow = await get("SELECT COUNT(*) as c FROM plantillas WHERE subtema_id = ?", [subtemaId]);

    res.json({
      subtema_id: subtemaId,
      bloqueado: false,
      intro: (introRow?.c ?? 0) > 0,
      talleres: (talleresRow?.c ?? 0) > 0 || (plantillasRow?.c ?? 0) > 0,
      quiz: (quizRow?.c ?? 0) > 0 || (plantillasRow?.c ?? 0) > 0,
      practica: (plantillasRow?.c ?? 0) > 0,
      counts: {
        intro: introRow?.c ?? 0,
        talleres: talleresRow?.c ?? 0,
        quiz: quizRow?.c ?? 0,
        plantillas: plantillasRow?.c ?? 0,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =========================
// RESULTADOS PRÁCTICA
// =========================
app.post("/api/resultados", authRequired, async (req, res) => {
  try {
    const { subtema_id, tipo, puntaje, total } = req.body || {};
    if (!subtema_id || !tipo || puntaje == null || total == null) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    if (req.user.role !== "student") {
      return res.status(403).json({ error: "Solo estudiantes pueden guardar resultados" });
    }

    const ok = await isSubtemaDisponible(Number(subtema_id));
    if (!ok) return res.status(403).json({ error: bloqueoMensaje() });

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

// =========================
// EVALUACIONES
// =========================
app.post("/api/evaluaciones", authRequired, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ error: "Solo estudiantes" });
    }

    const { subtema_id, tipo, correctas, total, detalle } = req.body || {};
    if (!subtema_id || !tipo || correctas == null || total == null) {
      return res.status(400).json({ error: "Faltan datos de evaluación" });
    }

    const tiposValidos = ["quiz", "taller"];
    if (!tiposValidos.includes(String(tipo))) {
      return res.status(400).json({ error: "Tipo de evaluación inválido" });
    }

    const existente = await get(
      `
      SELECT id
      FROM evaluaciones
      WHERE estudiante_id = ? AND subtema_id = ? AND tipo = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [req.user.estudiante_id, Number(subtema_id), String(tipo)]
    );

    if (existente) {
      return res.status(409).json({
        error: `Ya entregaste este ${tipo}.`,
        locked: true,
      });
    }

    const nota = calcularNota(correctas, total);

    await run(
      `
      INSERT INTO evaluaciones
      (estudiante_id, subtema_id, tipo, correctas, total, nota, detalle_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        req.user.estudiante_id,
        Number(subtema_id),
        String(tipo),
        Number(correctas),
        Number(total),
        Number(nota),
        JSON.stringify(detalle || []),
      ]
    );

    res.json({
      ok: true,
      nota,
      correctas: Number(correctas),
      total: Number(total),
      porcentaje: total > 0 ? Number(((Number(correctas) / Number(total)) * 100).toFixed(0)) : 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/evaluaciones/mis/:subtemaId", authRequired, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ error: "Solo estudiantes" });
    }

    const rows = await all(
      `
      SELECT *
      FROM evaluaciones
      WHERE estudiante_id = ? AND subtema_id = ?
      ORDER BY created_at DESC, id DESC
      `,
      [req.user.estudiante_id, Number(req.params.subtemaId)]
    );

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/evaluaciones/estado/:subtemaId", authRequired, async (req, res) => {
  try {
    if (req.user.role === "teacher") {
      return res.json({
        subtema_id: Number(req.params.subtemaId),
        quiz_entregado: false,
        taller_entregado: false,
        quiz: null,
        taller: null,
      });
    }

    if (req.user.role !== "student") {
      return res.status(403).json({ error: "Solo estudiantes" });
    }

    const subtemaId = Number(req.params.subtemaId);
    if (!subtemaId) return res.status(400).json({ error: "subtemaId inválido" });

    const quiz = await get(
      `
      SELECT id, correctas, total, nota, created_at
      FROM evaluaciones
      WHERE estudiante_id = ? AND subtema_id = ? AND tipo = 'quiz'
      ORDER BY id DESC
      LIMIT 1
      `,
      [req.user.estudiante_id, subtemaId]
    );

    const taller = await get(
      `
      SELECT id, correctas, total, nota, created_at
      FROM evaluaciones
      WHERE estudiante_id = ? AND subtema_id = ? AND tipo = 'taller'
      ORDER BY id DESC
      LIMIT 1
      `,
      [req.user.estudiante_id, subtemaId]
    );

    res.json({
      subtema_id: subtemaId,
      quiz_entregado: !!quiz,
      taller_entregado: !!taller,
      quiz: quiz || null,
      taller: taller || null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =========================
// PROGRESO
// =========================
app.get("/api/progreso/tema/:temaId", authRequired, async (req, res) => {
  try {
    const temaId = Number(req.params.temaId);
    if (!temaId) return res.status(400).json({ error: "temaId inválido" });

    if (req.user.role === "teacher") {
      const rows = await all(
        `
        SELECT
          s.id AS subtema_id,
          s.tema_id AS tema_id,
          s.nombre AS subtema_nombre
        FROM subtemas s
        WHERE s.tema_id = ?
        ORDER BY s.orden ASC
        `,
        [temaId]
      );

      return res.json(
        rows.map((x) => ({
          subtema_id: x.subtema_id,
          tema_id: x.tema_id,
          subtema_nombre: x.subtema_nombre,
          estado: "vista_docente",
          intentos: 0,
          mejor_puntaje_practica: null,
          ultimo_intento: null,
        }))
      );
    }

    if (req.user.role !== "student") {
      return res.status(403).json({ error: "Solo estudiantes" });
    }

    const estudianteId = Number(req.user.estudiante_id);

    const rows = await all(
      `
      SELECT
        s.id AS subtema_id,
        s.tema_id AS tema_id,
        s.nombre AS subtema_nombre,
        COUNT(r.id) AS intentos_total,
        SUM(CASE WHEN r.tipo = 'practica' THEN 1 ELSE 0 END) AS intentos_practica,
        MAX(CASE WHEN r.tipo = 'practica' THEN r.puntaje ELSE NULL END) AS mejor_puntaje_practica,
        MAX(CASE WHEN r.tipo = 'practica' THEN r.total ELSE NULL END) AS total_practica,
        MAX(r.created_at) AS ultimo_intento
      FROM subtemas s
      LEFT JOIN resultados r
        ON r.subtema_id = s.id
       AND r.estudiante_id = ?
      WHERE s.tema_id = ?
      GROUP BY s.id
      ORDER BY s.orden ASC
      `,
      [estudianteId, temaId]
    );

    const out = rows.map((x) => {
      const intentos = Number(x.intentos_total || 0);
      const completado =
        Number(x.intentos_practica || 0) > 0 && Number(x.total_practica || 0) === 10;

      const estado = completado
        ? "completado"
        : intentos > 0
          ? "en_progreso"
          : "no_iniciado";

      return {
        subtema_id: x.subtema_id,
        tema_id: x.tema_id,
        subtema_nombre: x.subtema_nombre,
        estado,
        intentos,
        mejor_puntaje_practica:
          x.mejor_puntaje_practica == null ? null : Number(x.mejor_puntaje_practica),
        ultimo_intento: x.ultimo_intento || null,
      };
    });

    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =========================
// PRÁCTICA RANDOM
// =========================
app.get("/api/ejercicio/random/:subtemaId", requireSubtemaDisponible("subtemaId"), async (req, res) => {
  try {
    const subtemaId = Number(req.params.subtemaId);
    if (!subtemaId) return res.status(400).json({ error: "subtemaId inválido" });

    const q = await buildSmartPracticeQuestion(subtemaId);
    if (!q) {
      return res.status(404).json({ error: "No hay práctica disponible para este subtema" });
    }

    return res.json({
      tipo: "practica",
      subtema_id: subtemaId,
      pregunta: q.pregunta,
      respuesta: q.respuesta,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error generando ejercicio", detail: e.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Servidor corriendo en:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   http://<TU_IP_LOCAL>:${PORT}`);
});