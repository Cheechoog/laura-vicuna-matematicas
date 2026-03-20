const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database.sqlite");

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
    db.get(sql, params, function (err, row) {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function getPeriodoId(gradoId, orden) {
  const row = await get(
    "SELECT id, nombre FROM periodos WHERE grado_id = ? AND orden = ? LIMIT 1",
    [gradoId, orden]
  );
  if (!row) {
    throw new Error(`No existe periodo para grado_id=${gradoId}, orden=${orden}`);
  }
  return row.id;
}

async function getOrCreateTema({ nombre, grado_id, periodo_id, orden }) {
  const existing = await get(
    `
    SELECT id
    FROM temas
    WHERE nombre = ? AND grado_id = ? AND periodo_id = ?
    LIMIT 1
    `,
    [nombre, grado_id, periodo_id]
  );

  if (existing?.id) {
    await run(
      `
      UPDATE temas
      SET orden = ?
      WHERE id = ?
      `,
      [orden, existing.id]
    );
    return existing.id;
  }

  const result = await run(
    `
    INSERT INTO temas (nombre, grado_id, periodo_id, orden)
    VALUES (?, ?, ?, ?)
    `,
    [nombre, grado_id, periodo_id, orden]
  );

  return result.lastID;
}

async function getOrCreateSubtema({ nombre, tema_id, orden }) {
  const existing = await get(
    `
    SELECT id
    FROM subtemas
    WHERE nombre = ? AND tema_id = ?
    LIMIT 1
    `,
    [nombre, tema_id]
  );

  if (existing?.id) {
    await run(
      `
      UPDATE subtemas
      SET orden = ?
      WHERE id = ?
      `,
      [orden, existing.id]
    );
    return existing.id;
  }

  const result = await run(
    `
    INSERT INTO subtemas (nombre, tema_id, orden)
    VALUES (?, ?, ?)
    `,
    [nombre, tema_id, orden]
  );

  return result.lastID;
}

async function insertTemaConSubtemas({ grado_id, periodo_id, ordenTema, nombreTema, subtemas }) {
  const temaId = await getOrCreateTema({
    nombre: nombreTema,
    grado_id,
    periodo_id,
    orden: ordenTema,
  });

  console.log(`Tema OK: ${nombreTema} (id=${temaId})`);

  for (let i = 0; i < subtemas.length; i++) {
    const nombreSubtema = subtemas[i];
    const subtemaId = await getOrCreateSubtema({
      nombre: nombreSubtema,
      tema_id: temaId,
      orden: i + 1,
    });
    console.log(`   └─ Subtema OK: ${nombreSubtema} (id=${subtemaId})`);
  }
}

async function main() {
  try {
    console.log("=== IMPORTANDO SÉPTIMO PERIODOS 2 Y 3 ===");

    const gradoSeptimo = 2;
    const periodo2Id = await getPeriodoId(gradoSeptimo, 2);
    const periodo3Id = await getPeriodoId(gradoSeptimo, 3);

    console.log(`Periodo 2 ID: ${periodo2Id}`);
    console.log(`Periodo 3 ID: ${periodo3Id}`);

    // =========================
    // SÉPTIMO - PERIODO 2
    // =========================
    await insertTemaConSubtemas({
      grado_id: gradoSeptimo,
      periodo_id: periodo2Id,
      ordenTema: 1,
      nombreTema: "Números racionales",
      subtemas: [
        "Representación de números racionales",
        "Orden de números racionales",
        "Suma y resta de números racionales",
        "Multiplicación de números racionales",
        "División de números racionales",
      ],
    });

    await insertTemaConSubtemas({
      grado_id: gradoSeptimo,
      periodo_id: periodo2Id,
      ordenTema: 2,
      nombreTema: "Ecuaciones",
      subtemas: [
        "Ecuaciones con números racionales",
        "Resolución de ecuaciones con suma y resta",
        "Resolución de ecuaciones con multiplicación y división",
      ],
    });

    await insertTemaConSubtemas({
      grado_id: gradoSeptimo,
      periodo_id: periodo2Id,
      ordenTema: 3,
      nombreTema: "Poliedros",
      subtemas: [
        "Concepto de poliedro",
        "Poliedros convexos y cóncavos",
        "Prismas",
        "Pirámides",
      ],
    });

    await insertTemaConSubtemas({
      grado_id: gradoSeptimo,
      periodo_id: periodo2Id,
      ordenTema: 4,
      nombreTema: "Cuerpos redondos",
      subtemas: [
        "Cilindro",
        "Cono",
        "Tronco de cono",
        "Esfera",
        "Casquete esférico",
      ],
    });

    await insertTemaConSubtemas({
      grado_id: gradoSeptimo,
      periodo_id: periodo2Id,
      ordenTema: 5,
      nombreTema: "Volumen",
      subtemas: [
        "Unidades de volumen",
        "Conversión de unidades de volumen",
        "Volumen de prismas",
        "Volumen de cilindros",
      ],
    });

    await insertTemaConSubtemas({
      grado_id: gradoSeptimo,
      periodo_id: periodo2Id,
      ordenTema: 6,
      nombreTema: "Conceptos básicos de probabilidad",
      subtemas: [
        "Experimento aleatorio",
        "Espacio muestral",
        "Suceso o evento",
        "Probabilidad simple",
      ],
    });

    // =========================
    // SÉPTIMO - PERIODO 3
    // =========================
    await insertTemaConSubtemas({
      grado_id: gradoSeptimo,
      periodo_id: periodo3Id,
      ordenTema: 1,
      nombreTema: "Razones y proporciones",
      subtemas: [
        "Razones",
        "Proporciones",
        "Magnitudes correlacionadas",
        "Proporcionalidad directa",
        "Proporcionalidad inversa",
        "Regla de tres simple",
      ],
    });

    await insertTemaConSubtemas({
      grado_id: gradoSeptimo,
      periodo_id: periodo3Id,
      ordenTema: 2,
      nombreTema: "Circunferencia",
      subtemas: [
        "Elementos de la circunferencia",
        "Longitud de la circunferencia",
        "Perímetro de la circunferencia",
      ],
    });

    await insertTemaConSubtemas({
      grado_id: gradoSeptimo,
      periodo_id: periodo3Id,
      ordenTema: 3,
      nombreTema: "Unidades de capacidad",
      subtemas: [
        "Unidades de capacidad",
        "Conversión de unidades de capacidad",
        "Aplicaciones de capacidad",
      ],
    });

    await insertTemaConSubtemas({
      grado_id: gradoSeptimo,
      periodo_id: periodo3Id,
      ordenTema: 4,
      nombreTema: "Técnicas de conteo",
      subtemas: [
        "Diagrama de árbol",
        "Principio de multiplicación",
        "Conteo de posibilidades",
      ],
    });

    console.log("✔ Séptimo periodo 2 y 3 importados correctamente");
  } catch (err) {
    console.error("❌ Error importando Séptimo periodo 2 y 3:", err.message);
  } finally {
    db.close();
  }
}

main();