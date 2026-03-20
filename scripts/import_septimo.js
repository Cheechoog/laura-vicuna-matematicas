  const sqlite3 = require("sqlite3").verbose();
  const db = new sqlite3.Database("./database.sqlite");

  function run(sql) {
    return new Promise((resolve, reject) => {
      db.run(sql, function (err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async function main() {

    console.log("Insertando subtemas de Séptimo...");

    // Sistema Numérico de los Enteros (tema_id = 5)
    await run(`
    INSERT INTO subtemas (nombre, tema_id, orden) VALUES
    ('Números enteros positivos y negativos',5,1),
    ('Recta numérica de enteros',5,2),
    ('Suma de números enteros',5,3),
    ('Resta de números enteros',5,4),
    ('Multiplicación de enteros',5,5),
    ('División de enteros',5,6)
    `);

    // Ecuaciones (tema_id = 6)
    await run(`
    INSERT INTO subtemas (nombre, tema_id, orden) VALUES
    ('Igualdades y ecuaciones',6,1),
    ('Resolución de ecuaciones simples',6,2),
    ('Ecuaciones con suma y resta',6,3),
    ('Ecuaciones con multiplicación y división',6,4)
    `);

    // Polígonos (tema_id = 7)
    await run(`
    INSERT INTO subtemas (nombre, tema_id, orden) VALUES
    ('Concepto de polígono',7,1),
    ('Clasificación de polígonos',7,2),
    ('Perímetro de polígonos',7,3),
    ('Área de polígonos',7,4)
    `);

    // Congruencia y semejanza (tema_id = 8)
    await run(`
    INSERT INTO subtemas (nombre, tema_id, orden) VALUES
    ('Concepto de congruencia',8,1),
    ('Figuras congruentes',8,2),
    ('Concepto de semejanza',8,3),
    ('Figuras semejantes',8,4)
    `);

    // Distribución de frecuencias (tema_id = 9)
    await run(`
    INSERT INTO subtemas (nombre, tema_id, orden) VALUES
    ('Recolección de datos',9,1),
    ('Tablas de frecuencia',9,2),
    ('Frecuencia absoluta y relativa',9,3),
    ('Gráficos estadísticos',9,4)
    `);

    console.log("✔ Subtemas de Séptimo periodo 1 agregados");

    db.close();
  }

  main();