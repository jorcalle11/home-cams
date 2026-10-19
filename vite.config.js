import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Proxy /api to the dev server on PORT from .env (same value `npm run dev` uses).
  const { PORT = "5178" } = loadEnv(mode, process.cwd(), "");
  return {
  root: "web",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true },
  server: { proxy: { "/api": `http://127.0.0.1:${PORT}` } },
  };
});
