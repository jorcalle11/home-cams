import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after } from "node:test";

// node --test runs every test file in its own process. Point the data directory at a temporary
// folder before the app (and so the database) is imported: tests never touch the real .wyze.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "home-cams-test-"));
process.env.DATA_DIR = dataDir;

const { createApp } = await import("../app.js");
const { db } = await import("../db.js");
const { loginLimiter } = await import("../features/auth/login-limiter.js");
export const { wyze } = await import("../wyze/client.js");

// Starts the app on a random port; stopped (and the data removed) when the file's tests end.
export async function startServer() {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  after(() => {
    server.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  return `http://127.0.0.1:${server.address().port}`;
}

// A clean slate: no user, sessions, API keys or failed logins.
export function resetState() {
  db.exec("DELETE FROM users; DELETE FROM sessions; DELETE FROM clients;");
  loginLimiter.reset();
}

export { db };

// fetch with JSON in and out. `cookie` / `apiKey` authenticate the request.
export async function request(base, path, { method = "GET", body, cookie, apiKey, headers = {} } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...(cookie && { Cookie: cookie }),
      ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = text;
  try { data = JSON.parse(text); } catch {}
  return { status: res.status, body: data, headers: res.headers };
}

// The "name=value" part of the session cookie a response set, ready to send back.
export function sessionCookie(res) {
  return res.headers.get("set-cookie")?.split(";")[0] ?? null;
}

export const USER = { username: "owner", password: "correct horse" };

// Signs up USER and returns its session cookie.
export async function signupUser(base) {
  const res = await request(base, "/api/auth/signup", { method: "POST", body: USER });
  return sessionCookie(res);
}

// Creates an API key with a session and returns { client, key }.
export async function createKey(base, cookie, name = "TV") {
  return (await request(base, "/api/keys", { method: "POST", body: { name }, cookie })).body;
}
