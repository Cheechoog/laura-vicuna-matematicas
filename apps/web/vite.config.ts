import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    // En desarrollo, /api va al backend: misma URL, misma cookie
    proxy: { "/api": "http://localhost:4000" },
  },
});
