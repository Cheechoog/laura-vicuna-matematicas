import { aplicarMigraciones, sqlite } from "../db/client.js";
import { env } from "../config/env.js";

aplicarMigraciones();
console.log("✅ Migraciones aplicadas en", env.DB_FILE);
sqlite.close();
