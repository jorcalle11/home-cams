import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command, mode }) => {
  // Dev server on HOST:UI_PORT from .env; proxies /api to the API on API_PORT (same values
  // `npm run dev` uses). API_PROXY_TARGET overrides the target, e.g. in docker-compose.yml.
  // No defaults; `vite build` doesn't need them (the Docker build has no .env).
  const { HOST, API_PORT, UI_PORT, API_PROXY_TARGET } = loadEnv(mode, process.cwd(), "");
  if (command === "serve" && !(HOST && API_PORT && UI_PORT)) {
    throw new Error("HOST, API_PORT and UI_PORT must be set in .env");
  }
  return {
  root: "web",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true },
  server: {
    host: HOST,
    port: Number(UI_PORT),
    strictPort: true,
    proxy: { "/api": API_PROXY_TARGET || `http://127.0.0.1:${API_PORT}` },
  },
  };
});
