// =====================================================================
// PINs: hash con scrypt (lento a propósito para frenar fuerza bruta)
//   formato nuevo:  scrypt$<sal hex>$<hash hex>
//   formato viejo:  legacy$<sal>$<sha256(sal+pin) hex>   (app v1)
// Un PIN legacy correcto se re-hashea a scrypt en el siguiente ingreso.
// =====================================================================
import crypto from "node:crypto";

const LONGITUD = 32;

export function hashPin(pin: string): string {
  const sal = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, sal, LONGITUD).toString("hex");
  return `scrypt$${sal}$${hash}`;
}

export function verificarPin(pin: string, almacenado: string): { ok: boolean; requiereRehash: boolean } {
  const [formato, sal, hash] = almacenado.split("$");
  if (!formato || !sal || !hash) return { ok: false, requiereRehash: false };

  let calculado: Buffer;
  if (formato === "scrypt") {
    calculado = crypto.scryptSync(pin, sal, LONGITUD);
  } else if (formato === "legacy") {
    calculado = crypto.createHash("sha256").update(sal + pin).digest();
  } else {
    return { ok: false, requiereRehash: false };
  }

  const esperado = Buffer.from(hash, "hex");
  const ok = esperado.length === calculado.length && crypto.timingSafeEqual(esperado, calculado);
  return { ok, requiereRehash: ok && formato === "legacy" };
}

/** PIN aleatorio de 4 dígitos (sin patrones obvios como 1111 o 1234). */
export function generarPin(): string {
  const prohibidos = new Set(["0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999", "1234", "4321"]);
  for (;;) {
    const pin = String(crypto.randomInt(0, 10000)).padStart(4, "0");
    if (!prohibidos.has(pin)) return pin;
  }
}
