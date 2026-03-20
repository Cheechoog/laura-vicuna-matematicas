const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database.sqlite");

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function main() {

  console.log("Creando estructura de contenido para Séptimo...");

  const subtemas = await all(`
    SELECT s.id
    FROM subtemas s
    JOIN temas t ON t.id = s.tema_id
    WHERE t.grado_id = 2
  `);

  for (const s of subtemas) {

    const subtemaId = s.id;

    await run(`
      INSERT OR IGNORE INTO intro (subtema_id,titulo,html)
      VALUES (?, 'Introducción', '<p>Contenido en construcción.</p>')
    `,[subtemaId]);

    await run(`
      INSERT OR IGNORE INTO talleres (subtema_id,titulo,enunciado)
      VALUES (?, 'Taller', 'Actividad en construcción.')
    `,[subtemaId]);

    await run(`
      INSERT OR IGNORE INTO quiz (subtema_id,tipo,pregunta,respuesta)
      VALUES (?, 'vf', 'Pregunta en construcción', 'V')
    `,[subtemaId]);

    await run(`
      INSERT OR IGNORE INTO plantillas (subtema_id,tipo,config)
      VALUES (?, 'aritmetica','{}')
    `,[subtemaId]);

  }

  console.log("✔ Estructura creada para todos los subtemas de Séptimo");

  db.close();
}

main();