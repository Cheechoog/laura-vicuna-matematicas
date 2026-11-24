import type { ErrorApi } from "@lv/shared";

/** Error de la API con el mensaje y código que envía el servidor. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly codigo?: string,
    public readonly datos?: unknown
  ) {
    super(message);
  }
}

async function solicitar<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${ruta}`, {
      method: metodo,
      credentials: "same-origin",
      headers: cuerpo !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ApiError(0, "No hay conexión con el servidor. Revisa que la plataforma esté encendida.", "SIN_CONEXION");
  }

  if (res.status === 204) return undefined as T;
  const datos = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const e = (datos ?? {}) as Partial<ErrorApi>;
    throw new ApiError(res.status, e.error ?? "Algo salió mal. Inténtalo otra vez.", e.codigo, e.datos);
  }
  return datos as T;
}

export const api = {
  get: <T>(ruta: string) => solicitar<T>("GET", ruta),
  post: <T>(ruta: string, cuerpo?: unknown) => solicitar<T>("POST", ruta, cuerpo ?? {}),
  patch: <T>(ruta: string, cuerpo: unknown) => solicitar<T>("PATCH", ruta, cuerpo),
};

export function mensajeDeError(e: unknown): string {
  return e instanceof Error ? e.message : "Algo salió mal. Inténtalo otra vez.";
}
