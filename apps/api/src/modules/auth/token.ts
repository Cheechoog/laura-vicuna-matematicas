import jwt from "jsonwebtoken";
import type { Rol } from "@lv/shared";
import { env } from "../../config/env.js";

export const COOKIE_SESION = "lv_sesion";

export interface PayloadSesion {
  sub: number;
  rol: Rol;
}

const DURACION: Record<Rol, number> = {
  estudiante: 6 * 60 * 60, // una jornada escolar
  docente: 12 * 60 * 60,
};

export function firmarSesion(p: PayloadSesion): { token: string; maxAgeMs: number } {
  const exp = DURACION[p.rol];
  const token = jwt.sign({ rol: p.rol }, env.JWT_SECRET, { subject: String(p.sub), expiresIn: exp });
  return { token, maxAgeMs: exp * 1000 };
}

export function leerSesion(token: string): PayloadSesion | null {
  try {
    const d = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    const sub = Number(d.sub);
    if (!sub || (d.rol !== "estudiante" && d.rol !== "docente")) return null;
    return { sub, rol: d.rol };
  } catch {
    return null;
  }
}

/** Token corto para la práctica: guarda la respuesta firmada, no en el cliente en claro. */
export function firmarPractica(datos: { r: string; t: string; e?: string | null; s: number }): string {
  return jwt.sign(datos, env.JWT_SECRET, { expiresIn: 60 * 30 });
}

export function leerPractica(token: string): { r: string; t: string; e?: string | null; s: number } | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as { r: string; t: string; e?: string | null; s: number };
  } catch {
    return null;
  }
}
