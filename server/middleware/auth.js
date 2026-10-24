import { isValidSession } from "../features/auth/auth.service.js";
import { readSessionToken } from "../features/auth/session-cookie.js";
import { useKey } from "../features/keys/keys.service.js";

// Two kinds of access:
// - The web's login session (cookie): the data API and API key management (/api/keys).
// - API keys ("Authorization: Bearer <key>"): the data API, for other clients (e.g. a TV app).
//   Each has its own key, so it's registered and can be revoked (see features/keys).
// 401s carry a code, so the web can tell an expired session from other errors.
const loginRequired = (res) => res.status(401).json({ error: "Login required", code: "login_required" });

const hasSession = (req) => isValidSession(readSessionToken(req));

export function requireSession() {
  return (req, res, next) => (hasSession(req) ? next() : loginRequired(res));
}

// Data API: a session or a valid API key, recorded as that client's latest use (req.client).
export function requireSessionOrApiKey() {
  return (req, res, next) => {
    const [scheme, key = ""] = (req.headers.authorization || "").split(" ");
    if (scheme === "Bearer") {
      req.client = useKey(key, req);
      if (req.client) return next();
      return res.status(401).json({ error: "Invalid API key", code: "invalid_api_key" });
    }
    if (hasSession(req)) return next();
    loginRequired(res);
  };
}
