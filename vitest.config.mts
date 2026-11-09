import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    testTimeout: 30_000,
    // subir o Postgres embarcado (PGlite) + migração leva alguns segundos, mais com a máquina carregada
    hookTimeout: 90_000,
  },
});
