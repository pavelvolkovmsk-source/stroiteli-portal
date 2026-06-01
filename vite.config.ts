import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Конфиг Vite для портала «Хаб — кабинет руководителя».
// Всё через env, без хардкода хостов — код «переездной» на сервер.
// VITE_HUB_URL задаёт адрес Hub (по умолчанию http://localhost:8000).
// Dev-сервер слушает порт 5174 (5173 занят Юр-блоком).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    host: true,
  },
});
