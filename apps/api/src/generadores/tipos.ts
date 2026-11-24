import type { Apoyo, TipoPregunta } from "@lv/shared";

/** Ejercicio producido por un generador (incluye la respuesta: solo vive en el servidor). */
export interface Ejercicio {
  tipo: TipoPregunta;
  enunciado: string;
  opciones?: string[];
  apoyo?: Apoyo;
  respuesta: string;
  explicacion?: string;
}

export type Config = Record<string, unknown>;
export type Generador = (config: Config) => Ejercicio;

/** Lee un número de la configuración con valor por defecto. */
export function num(config: Config, clave: string, defecto: number): number {
  const v = Number(config[clave]);
  return Number.isFinite(v) ? v : defecto;
}

/** Escribe un entero con paréntesis si es negativo: -5 → (−5). */
export function ent(n: number): string {
  return n < 0 ? `(−${Math.abs(n)})` : String(n);
}

/** Escribe un entero con signo menos tipográfico: -5 → −5. */
export function signo(n: number): string {
  return n < 0 ? `−${Math.abs(n)}` : String(n);
}

/** 10 → ₁₀ (para escribir la base de un logaritmo). */
export function subindice(n: number): string {
  return String(n).replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)] ?? d);
}
