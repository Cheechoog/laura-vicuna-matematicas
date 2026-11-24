import type { NextFunction, Request, Response } from "express";
import { COOKIE_SESION, leerSesion, type PayloadSesion } from "../modules/auth/token.js";
import { noAutenticado, prohibido } from "../shared/errores.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sesion?: PayloadSesion;
    }
  }
}

/** Lee la cookie de sesión si existe (no exige estar autenticado). */
export function cargarSesion(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_SESION] as string | undefined;
  if (token) {
    const s = leerSesion(token);
    if (s) req.sesion = s;
  }
  next();
}

export function requiereSesion(req: Request, _res: Response, next: NextFunction): void {
  if (!req.sesion) throw noAutenticado();
  next();
}

export function requiereDocente(req: Request, _res: Response, next: NextFunction): void {
  if (!req.sesion) throw noAutenticado();
  if (req.sesion.rol !== "docente") throw prohibido("Esta sección es solo para docentes");
  next();
}

export function requiereEstudiante(req: Request, _res: Response, next: NextFunction): void {
  if (!req.sesion) throw noAutenticado();
  if (req.sesion.rol !== "estudiante") throw prohibido("Esta acción es solo para estudiantes");
  next();
}

export function sesionDe(req: Request): PayloadSesion {
  if (!req.sesion) throw noAutenticado();
  return req.sesion;
}
