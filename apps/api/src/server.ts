import os from "node:os";
import { env } from "./config/env.js";
import { aplicarMigraciones } from "./db/client.js";
import { crearApp } from "./app.js";

aplicarMigraciones();

const app = crearApp();

app.listen(env.PORT, "0.0.0.0", () => {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i!.address);

  console.log("✅ API lista");
  console.log(`   Local:  http://localhost:${env.PORT}`);
  for (const ip of ips) console.log(`   Red:    http://${ip}:${env.PORT}`);
  console.log(`   Base:   ${env.DB_FILE}`);
});
