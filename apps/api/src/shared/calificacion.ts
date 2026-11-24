// =====================================================================
// CALIFICACIÓN — compara respuestas y calcula la nota (escala 1.0 a 5.0)
// =====================================================================

export function normalizarTexto(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const VERDADERO = new Set(["v", "verdadero", "true", "si", "cierto"]);
const FALSO = new Set(["f", "falso", "false", "no"]);

function aVf(valor: string): "V" | "F" | null {
  const n = normalizarTexto(valor);
  if (VERDADERO.has(n)) return "V";
  if (FALSO.has(n)) return "F";
  return null;
}

/** Interpreta "3,5", "−4", "+7", "45%", "1/2" como número. */
function aNumero(valor: string): number | null {
  const limpio = normalizarTexto(valor)
    .replace(/\u2212/g, "-")
    .replace(/%$/, "")
    .replace(/\s/g, "")
    .replace(",", ".");
  if (/^[+-]?\d+\/\d+$/.test(limpio)) {
    const [a, b] = limpio.split("/").map(Number) as [number, number];
    return b === 0 ? null : a / b;
  }
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(limpio)) return null;
  return Number(limpio);
}

export function esRespuestaCorrecta(tipo: "mcq" | "vf" | "abierta", dada: unknown, correcta: string): boolean {
  const d = String(dada ?? "");
  if (!d.trim()) return false;

  if (tipo === "vf") {
    return aVf(d) !== null && aVf(d) === aVf(correcta);
  }

  const nd = aNumero(d);
  const nc = aNumero(correcta);
  if (nd !== null && nc !== null) {
    return Math.abs(nd - nc) < 1e-9;
  }

  return normalizarTexto(d) === normalizarTexto(correcta);
}

/** Nota colombiana: 1.0 si no acierta ninguna, 5.0 si acierta todas. */
export function calcularNota(correctas: number, total: number): number {
  if (total <= 0) return 1;
  return Math.round((1 + (correctas / total) * 4) * 10) / 10;
}

export function promedio(valores: (number | null | undefined)[]): number | null {
  const v = valores.filter((x): x is number => typeof x === "number");
  if (v.length === 0) return null;
  return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
}
