import crypto from "node:crypto";

// HTTP Basic auth. Required in production unless AUTH_DISABLED=true
// (e.g. when a proxy in front already authenticates).
// API_TOKEN, when set, also lets other apps (e.g. a TV app) call the API with
// "Authorization: Bearer <token>" instead of the app login.
const user = process.env.APP_USERNAME;
const pass = process.env.APP_PASSWORD;
const token = process.env.API_TOKEN;
const disabled = process.env.AUTH_DISABLED === "true";

const digest = (v) => crypto.createHash("sha256").update(v).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));

// CORS for apps served from another origin (CORS_ORIGINS="*" or a comma-separated list;
// a webOS/Tizen app opened from file:// sends "null"). Preflight requests are answered
// before auth, since browsers send them without the Authorization header.
export function cors() {
  const origins = (process.env.CORS_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
  if (!origins.length) return (_req, _res, next) => next();
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (origins.includes("*") || origins.includes(origin))) {
      res.set({
        "Access-Control-Allow-Origin": origins.includes("*") ? "*" : origin,
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
      });
      if (req.method === "OPTIONS") return res.sendStatus(204);
    }
    next();
  };
}

export function basicAuth() {
  if (disabled) {
    console.warn("⚠ AUTH_DISABLED=true: la app no pide usuario ni contraseña.");
    return (_req, _res, next) => next();
  }
  if (!user || !pass) {
    if (process.env.NODE_ENV === "production") {
      console.error("Faltan APP_USERNAME y APP_PASSWORD (o AUTH_DISABLED=true). Abortando.");
      process.exit(1);
    }
    return (_req, _res, next) => next(); // local development without credentials
  }
  return (req, res, next) => {
    const [scheme, encoded = ""] = (req.headers.authorization || "").split(" ");
    if (scheme === "Bearer" && token && safeEqual(encoded, token)) return next();
    const [u, ...rest] = Buffer.from(encoded, "base64").toString().split(":");
    if (scheme === "Basic" && safeEqual(u, user) && safeEqual(rest.join(":"), pass)) return next();
    res.set("WWW-Authenticate", 'Basic realm="Home Cams", charset="UTF-8"').status(401).send("Autenticación requerida");
  };
}
