import ExcelJS from "exceljs";
import type { ReporteNotas } from "@lv/shared";

const fmt = (n: number | null | undefined) => (typeof n === "number" ? n : "");

/** Excel con una fila por estudiante: quiz, taller y promedio de cada subtema. */
export async function notasAExcel(reporte: ReporteNotas, titulo: string): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Plataforma Laura Vicuña";
  const hoja = libro.addWorksheet("Notas", { views: [{ state: "frozen", xSplit: 2, ySplit: 3 }] });

  hoja.addRow([titulo]).font = { bold: true, size: 14 };

  const fila1: (string | null)[] = ["Grupo", "Estudiante"];
  const fila2: string[] = ["", ""];
  for (const c of reporte.columnas) {
    fila1.push(`${c.tema} — ${c.subtema}`, null, null);
    fila2.push("Quiz", "Taller", "Prom.");
  }
  fila1.push("Promedio final");
  fila2.push("");
  hoja.addRow(fila1).font = { bold: true };
  hoja.addRow(fila2).font = { bold: true };

  reporte.columnas.forEach((_, i) => {
    const col = 3 + i * 3;
    hoja.mergeCells(2, col, 2, col + 2);
  });

  for (const f of reporte.filas) {
    const valores: (string | number)[] = [f.grupo, f.estudiante];
    for (const c of reporte.columnas) {
      const n = f.notas[c.subtemaId];
      valores.push(fmt(n?.quiz), fmt(n?.taller), fmt(n?.promedio));
    }
    valores.push(fmt(f.promedio));
    hoja.addRow(valores);
  }

  hoja.getColumn(1).width = 8;
  hoja.getColumn(2).width = 38;
  for (let c = 3; c <= 3 + reporte.columnas.length * 3; c++) hoja.getColumn(c).width = 9;
  hoja.getRow(2).alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
  hoja.getRow(2).height = 45;

  return Buffer.from(await libro.xlsx.writeBuffer());
}
