import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Конфиг Vite для кабинета генерального («Хаб — центр экосистемы»).
// Всё через env, без хардкода хостов — код «переездной» на сервер.
// VITE_HUB_URL задаёт адрес Hub (по умолчанию http://localhost:8000).
// Dev-сервер слушает порт 5180 (5173 — Юр-блок, 5174 — фронты-спутники).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5180,
    host: true,
  },
});
