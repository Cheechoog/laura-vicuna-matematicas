import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

fs.mkdirSync(path.dirname(env.DB_FILE), { recursive: true });

export const sqlite = new Database(env.DB_FILE);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

export const db = drizzle(sqlite, { schema, casing: "snake_case" });
export type DB = typeof db;
export { schema };

/** Aplica las migraciones pendientes de /drizzle. Es seguro llamarlo siempre. */
export function aplicarMigraciones(): void {
  migrate(db, { migrationsFolder: env.MIGRACIONES_DIR });
}
