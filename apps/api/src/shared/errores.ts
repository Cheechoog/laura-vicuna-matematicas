/** Error de negocio con código HTTP. El manejador global lo convierte en JSON. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly codigo?: string,
    public readonly datos?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const noEncontrado = (que: string) => new AppError(404, `${que} no existe`, "NO_ENCONTRADO");
export const prohibido = (msg = "No tienes permiso para esto") => new AppError(403, msg, "PROHIBIDO");
export const noAutenticado = () => new AppError(401, "Inicia sesión para continuar", "NO_AUTENTICADO");
export const solicitudInvalida = (msg: string, datos?: unknown) =>
  new AppError(400, msg, "SOLICITUD_INVALIDA", datos);
