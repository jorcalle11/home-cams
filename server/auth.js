import crypto from "node:crypto";

// HTTP Basic auth. Required in production unless AUTH_DISABLED=true
// (e.g. when a proxy in front already authenticates).
const user = process.env.APP_USERNAME;
const pass = process.env.APP_PASSWORD;
const disabled = process.env.AUTH_DISABLED === "true";

const digest = (v) => crypto.createHash("sha256").update(v).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));

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
    const [u, ...rest] = Buffer.from(encoded, "base64").toString().split(":");
    if (scheme === "Basic" && safeEqual(u, user) && safeEqual(rest.join(":"), pass)) return next();
    res.set("WWW-Authenticate", 'Basic realm="Home Cams", charset="UTF-8"').status(401).send("Autenticación requerida");
  };
}
