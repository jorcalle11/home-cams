import express from "express";
import { config } from "./config.js";
import { cors } from "./middleware/cors.js";
import { basicAuth, apiKeyAuth } from "./middleware/auth.js";
import { keysRouter } from "./features/keys/keys.routes.js";
import { camerasRouter } from "./features/cameras/cameras.routes.js";
import { eventsRouter } from "./features/events/events.routes.js";

// The order matters: health check, CORS, the login-protected key management, the API-key
// protected data API and, last, the login-protected web page.
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Behind Caddy on a private network: take the client's IP from X-Forwarded-For.
  app.set("trust proxy", "loopback, uniquelocal");
  // No auth and no data: used by the Docker healthcheck.
  app.get("/healthz", (_req, res) => res.json({ ok: true }));
  app.use("/api", cors());
  app.use(express.json());

  const login = basicAuth();
  app.use("/api/keys", login, keysRouter);

  // Data API: every request needs an API key.
  app.use("/api", apiKeyAuth());
  app.use("/api/cameras", camerasRouter);
  app.use("/api/events", eventsRouter);

  // Web page: the app login.
  app.use(login);
  if (config.isProduction) {
    app.use(express.static(config.distDir));
    app.get("*", (_req, res) => res.sendFile(config.distDir + "index.html"));
  }
  return app;
}
