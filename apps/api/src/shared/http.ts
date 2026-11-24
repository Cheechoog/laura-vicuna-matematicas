import type { Request } from "express";
import { z } from "zod";
import { solicitudInvalida } from "./errores.js";

/** Valida y tipa cualquier parte de la petición con un esquema Zod. */
export function validar<T extends z.ZodType>(esquema: T, valor: unknown): z.infer<T> {
  const r = esquema.safeParse(valor);
  if (!r.success) {
    throw solicitudInvalida("Datos inválidos", z.flattenError(r.error).fieldErrors);
  }
  return r.data;
}

export const idParam = z.coerce.number().int().positive();

export function paramId(req: Request, nombre = "id"): number {
  return validar(idParam, req.params[nombre]);
}
