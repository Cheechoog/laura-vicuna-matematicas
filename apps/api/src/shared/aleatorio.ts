/** Utilidades de azar. Se pueden reemplazar por una semilla en las pruebas. */
let rnd: () => number = Math.random;

export function usarAzar(fn: () => number): void {
  rnd = fn;
}

export function entero(min: number, max: number): number {
  return Math.floor(rnd() * (max - min + 1)) + min;
}

/** Entero en [min, max] que no esté en `excluir`. */
export function enteroDistinto(min: number, max: number, excluir: number[]): number {
  for (let i = 0; i < 50; i++) {
    const n = entero(min, max);
    if (!excluir.includes(n)) return n;
  }
  return max + 1;
}

export function elegir<T>(arr: readonly T[]): T {
  if (arr.length === 0) throw new Error("elegir() recibió un arreglo vacío");
  return arr[Math.floor(rnd() * arr.length)] as T;
}

export function barajar<T>(arr: readonly T[]): T[] {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copia[i], copia[j]] = [copia[j] as T, copia[i] as T];
  }
  return copia;
}

/** Elige un elemento según su peso (más peso = más probable). */
export function elegirPonderado<T extends { peso: number }>(arr: readonly T[]): T {
  const total = arr.reduce((a, x) => a + Math.max(1, x.peso), 0);
  let r = rnd() * total;
  for (const x of arr) {
    r -= Math.max(1, x.peso);
    if (r <= 0) return x;
  }
  return arr[arr.length - 1] as T;
}
