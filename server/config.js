import { fileURLToPath } from "node:url";

// Every setting comes from the environment (.env). This is the only module that reads it.
const env = process.env;

export const config = {
  isProduction: env.NODE_ENV === "production",
  host: env.HOST,
  port: env.API_PORT ? Number(env.API_PORT) : undefined,
  auth: {
    username: env.APP_USERNAME,
    password: env.APP_PASSWORD,
    // Only if a proxy in front already authenticates.
    disabled: env.AUTH_DISABLED === "true",
  },
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
  dataDir: fileURLToPath(new URL("../.wyze/", import.meta.url)),
  // The built web app, served in production.
  distDir: fileURLToPath(new URL("../dist/", import.meta.url)),
};
