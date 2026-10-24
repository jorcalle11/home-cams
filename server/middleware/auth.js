import crypto from "node:crypto";
import { config } from "../config.js";
import { useKey } from "../features/keys/keys.service.js";

// Two kinds of access:
// - The app login (HTTP Basic): the web page and API key management (/api/keys).
//   Required in production unless AUTH_DISABLED=true (e.g. a proxy in front already authenticates).
// - API keys ("Authorization: Bearer <key>"): the data API. Every consumer, the web included,
//   uses its own key, so each one is registered (see features/keys).
const { username: user, password: pass, disabled } = config.auth;
// Local development without credentials: nothing is enforced.
const open = disabled || (!user && !pass && !config.isProduction);

const digest = (v) => crypto.createHash("sha256").update(v).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));

export function basicAuth() {
  if (disabled) {
    console.warn("⚠ AUTH_DISABLED=true: the app doesn't ask for a username or password.");
    return (_req, _res, next) => next();
  }
  if (!user || !pass) {
    if (config.isProduction) {
      console.error("APP_USERNAME and APP_PASSWORD (or AUTH_DISABLED=true) must be set. Aborting.");
      process.exit(1);
    }
    return (_req, _res, next) => next(); // local development without credentials
  }
  return (req, res, next) => {
    const [scheme, encoded = ""] = (req.headers.authorization || "").split(" ");
    const [u, ...rest] = Buffer.from(encoded, "base64").toString().split(":");
    if (scheme === "Basic" && safeEqual(u, user) && safeEqual(rest.join(":"), pass)) return next();
    res.set("WWW-Authenticate", 'Basic realm="Home Cams", charset="UTF-8"').status(401).send("Authentication required");
  };
}

// Data API: a valid API key, recorded as that client's latest use (req.client).
// No WWW-Authenticate header: a missing key must not pop up the browser's login dialog.
export function apiKeyAuth() {
  return (req, res, next) => {
    const [scheme, key = ""] = (req.headers.authorization || "").split(" ");
    req.client = scheme === "Bearer" ? useKey(key, req) : null;
    if (req.client || open) return next();
    res.status(401).json({ error: "Invalid or missing API key" });
  };
}
