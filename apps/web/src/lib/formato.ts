/** Nota con un decimal (3.5) o guion si no hay. */
export const nota = (n: number | null | undefined) => (typeof n === "number" ? n.toFixed(1) : "—");

/** "APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2" → "Nombre1 Nombre2" para saludar. */
export function nombreAmigable(nombre: string): string {
  if (nombre !== nombre.toUpperCase()) return nombre;
  const partes = nombre
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  if (partes.length >= 3) {
    return partes.slice(2).join(" ");
  }
  return partes.join(" ");
}

/** Tono de una nota en escala 1–5 (3.0 aprueba). */
export function tonoNota(n: number | null | undefined): "sin" | "baja" | "media" | "alta" {
  if (typeof n !== "number") return "sin";
  if (n < 3) return "baja";
  if (n < 4) return "media";
  return "alta";
}
