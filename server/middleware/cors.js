import { config } from "../config.js";

// CORS for apps served from another origin (CORS_ORIGINS). Preflight requests are answered
// before auth, since browsers send them without the Authorization header.
export function cors() {
  const origins = config.corsOrigins;
  if (!origins.length) return (_req, _res, next) => next();
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (origins.includes("*") || origins.includes(origin))) {
      res.set({
        "Access-Control-Allow-Origin": origins.includes("*") ? "*" : origin,
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
      });
      if (req.method === "OPTIONS") return res.sendStatus(204);
    }
    next();
  };
}
