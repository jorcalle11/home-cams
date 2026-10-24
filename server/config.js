import path from "node:path";
import { fileURLToPath } from "node:url";

// Every setting comes from the environment (.env). This is the only module that reads it.
const env = process.env;

export const config = {
  isProduction: env.NODE_ENV === "production",
  host: env.HOST,
  port: env.API_PORT ? Number(env.API_PORT) : undefined,
  // "*" or a comma-separated list; a webOS/Tizen app opened from file:// sends "null".
  corsOrigins: (env.CORS_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean),
  wyze: {
    username: env.WYZE_EMAIL,
    password: env.WYZE_PASSWORD,
    keyId: env.WYZE_KEY_ID,
    apiKey: env.WYZE_API_KEY,
    logLevel: env.WYZE_LOG_LEVEL || "none",
  },
  // Wyze token and the SQLite database. Docker keeps this directory in a volume.
  // DATA_DIR moves it (the tests use a temporary one); it isn't meant for .env.
  dataDir: env.DATA_DIR ? path.resolve(env.DATA_DIR) + path.sep : fileURLToPath(new URL("../.wyze/", import.meta.url)),
  // The built web app, served in production.
  distDir: fileURLToPath(new URL("../dist/", import.meta.url)),
};
