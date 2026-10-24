import { Router } from "express";
import { asyncRoute } from "../../middleware/async-route.js";
import { getUser, signup, checkCredentials, createSession, isValidSession, deleteSession } from "./auth.service.js";
import { readSessionToken, setSessionCookie, clearSessionCookie } from "./session-cookie.js";
import { isLimited, recordFailure, clearFailures } from "./login-limiter.js";

export const authRouter = Router();

// What the web needs to pick a screen: signup (first run), login or the app.
authRouter.get("/session", (req, res) => {
  const user = getUser();
  res.json({ setupRequired: !user, user: user && isValidSession(readSessionToken(req)) ? user : null });
});

// First run only: registers the one user of the web and logs them in.
authRouter.post("/signup", asyncRoute(async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  if (!username || username.length > 80) return res.status(400).json({ error: "Username must be 1-80 characters" });
  if (password.length < 8 || password.length > 200) {
    return res.status(400).json({ error: "Password must be 8-200 characters" });
  }
  if (!(await signup(username, password))) return res.status(409).json({ error: "A user already exists" });
  setSessionCookie(req, res, createSession());
  res.status(201).json({ user: getUser() });
}));

authRouter.post("/login", asyncRoute(async (req, res) => {
  if (isLimited(req.ip)) return res.status(429).json({ error: "Too many failed attempts, try again later" });
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  if (!(await checkCredentials(username, password))) {
    recordFailure(req.ip);
    return res.status(401).json({ error: "Invalid username or password" });
  }
  clearFailures(req.ip);
  setSessionCookie(req, res, createSession());
  res.json({ user: getUser() });
}));

authRouter.post("/logout", (req, res) => {
  deleteSession(readSessionToken(req));
  clearSessionCookie(req, res);
  res.sendStatus(204);
});
