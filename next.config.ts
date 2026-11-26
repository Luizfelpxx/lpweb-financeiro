import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O sistema é 100% autenticado e dinâmico: não usamos Cache Components.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // A logo usada no PDF é lida do disco em tempo de execução (serverless na Vercel).
  outputFileTracingIncludes: {
    "/api/pdf": ["./public/logo/**/*"],
    "/api/pdf/comissoes": ["./public/logo/**/*"],
    "/api/cron/relatorio-diario": ["./public/logo/**/*"],
    "/configuracoes": ["./public/logo/**/*"],
  },
};

export default nextConfig;
