import express from "express";
import { config } from "./config.js";
import { cors } from "./middleware/cors.js";
import { requireSession, requireSessionOrApiKey } from "./middleware/auth.js";
import { authRouter } from "./features/auth/auth.routes.js";
import { keysRouter } from "./features/keys/keys.routes.js";
import { camerasRouter } from "./features/cameras/cameras.routes.js";
import { eventsRouter } from "./features/events/events.routes.js";

// The order matters: health check, CORS, the public auth endpoints, the session-protected key
// management, the data API (session or API key) and, last, the web page.
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Behind Caddy on a private network: take the client's IP from X-Forwarded-For.
  app.set("trust proxy", "loopback, uniquelocal");
  // No auth and no data: used by the Docker healthcheck.
  app.get("/healthz", (_req, res) => res.json({ ok: true }));
  app.use("/api", cors());
  app.use(express.json());

  app.use("/api/auth", authRouter);
  app.use("/api/keys", requireSession(), keysRouter);

  // Data API: the web's session or another client's API key.
  app.use("/api", requireSessionOrApiKey());
  app.use("/api/cameras", camerasRouter);
  app.use("/api/events", eventsRouter);

  // Web page: public, it has no data of its own; the app shows its login page.
  if (config.isProduction) {
    app.use(express.static(config.distDir));
    app.get("*", (_req, res) => res.sendFile(config.distDir + "index.html"));
  }
  return app;
}
