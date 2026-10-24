import crypto from "node:crypto";
import { promisify } from "node:util";
import { db } from "../../db.js";

// One user, registered by the signup the first time the web is opened. Logging in starts a
// session: a random token sent as a cookie, stored only as its sha256.
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

const scrypt = promisify(crypto.scrypt);
const sha256 = (v) => crypto.createHash("sha256").update(v).digest();

const q = {
  user: db.prepare("SELECT * FROM users WHERE id = 1"),
  insertUser: db.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (1, ?, ?, ?)"),
  insertSession: db.prepare("INSERT INTO sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)"),
  session: db.prepare("SELECT 1 FROM sessions WHERE token_hash = ? AND expires_at > ?"),
  deleteSession: db.prepare("DELETE FROM sessions WHERE token_hash = ?"),
  deleteExpired: db.prepare("DELETE FROM sessions WHERE expires_at <= ?"),
};

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const actual = await scrypt(password, Buffer.from(salt, "hex"), 64);
  return crypto.timingSafeEqual(actual, Buffer.from(hash, "hex"));
}

export function getUser() {
  const row = q.user.get();
  return row ? { username: row.username } : null;
}

// Registers the only user; false if there already is one. The primary key makes it atomic,
// so two signups racing on first run can't both succeed.
export async function signup(username, password) {
  const hash = await hashPassword(password);
  try {
    q.insertUser.run(username, hash, Date.now());
    return true;
  } catch (err) {
    if (/constraint/i.test(err.message)) return false;
    throw err;
  }
}

export async function checkCredentials(username, password) {
  const row = q.user.get();
  if (!row) return false;
  // Always hash the password, so a wrong username takes as long as a wrong password.
  const passwordOk = await verifyPassword(password, row.password_hash);
  return passwordOk && crypto.timingSafeEqual(sha256(username), sha256(row.username));
}

export function createSession() {
  const now = Date.now();
  q.deleteExpired.run(now);
  const token = crypto.randomBytes(32).toString("base64url");
  q.insertSession.run(sha256(token).toString("hex"), now, now + SESSION_MS);
  return { token, maxAge: SESSION_MS };
}

export function isValidSession(token) {
  return Boolean(token && q.session.get(sha256(token).toString("hex"), Date.now()));
}

export function deleteSession(token) {
  if (token) q.deleteSession.run(sha256(token).toString("hex"));
}
