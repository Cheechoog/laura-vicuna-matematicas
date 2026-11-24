import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const DEV_SECRET = "solo-desarrollo-no-usar-en-produccion-0123456789";

const esquema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DB_PATH: z.string().default("./data/plataforma.sqlite"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET debe tener al menos 32 caracteres").default(DEV_SECRET),
});

const parsed = esquema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Configuración inválida:\n", z.prettifyError(parsed.error));
  process.exit(1);
}

const data = parsed.data;

if (data.NODE_ENV === "production" && data.JWT_SECRET === DEV_SECRET) {
  console.error("❌ En producción debes definir JWT_SECRET en el archivo .env");
  process.exit(1);
}

export const env = {
  ...data,
  esProduccion: data.NODE_ENV === "production",
  API_ROOT,
  DB_FILE: path.resolve(API_ROOT, data.DB_PATH),
  MIGRACIONES_DIR: path.join(API_ROOT, "drizzle"),
  SEED_DIR: path.join(API_ROOT, "seed"),
  WEB_DIST: path.resolve(API_ROOT, "../web/dist"),
};
