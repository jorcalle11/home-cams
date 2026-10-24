import crypto from "node:crypto";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

// API clients: each app or browser that calls the API has its own key, so every consumer
// is registered and can be revoked on its own. Only a SHA-256 of each key is stored; the key
// itself is returned once, when it's created.
// SQLite database next to the Wyze token, in the directory Docker already keeps in a volume.
const dir = new URL("../.wyze/", import.meta.url).pathname;
fs.mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(dir + "home-cams.db");
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS clients (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    kind         TEXT NOT NULL DEFAULT 'app',  -- 'web' (a browser of the web app) or 'app'
    key_hash     TEXT NOT NULL UNIQUE,         -- sha256 of the key
    prefix       TEXT NOT NULL,                -- first characters of the key, to recognise it
    created_at   INTEGER NOT NULL,             -- ms since epoch
    last_used_at INTEGER,
    last_ip      TEXT,
    user_agent   TEXT,
    requests     INTEGER NOT NULL DEFAULT 0
  );
`);

// A client counts as "active" when it called the API in the last few minutes.
const ACTIVE_MS = 5 * 60 * 1000;

const hash = (key) => crypto.createHash("sha256").update(key).digest("hex");

const q = {
  list: db.prepare("SELECT * FROM clients ORDER BY COALESCE(last_used_at, created_at) DESC"),
  get: db.prepare("SELECT * FROM clients WHERE id = ?"),
  byHash: db.prepare("SELECT * FROM clients WHERE key_hash = ?"),
  insert: db.prepare(
    "INSERT INTO clients (id, name, kind, key_hash, prefix, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ),
  remove: db.prepare("DELETE FROM clients WHERE id = ?"),
  touch: db.prepare(
    "UPDATE clients SET last_used_at = ?, last_ip = ?, user_agent = ?, requests = requests + 1 WHERE id = ?",
  ),
};

function toPublic(row) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    prefix: row.prefix,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    lastIp: row.last_ip,
    userAgent: row.user_agent,
    requests: row.requests,
    active: Boolean(row.last_used_at && Date.now() - row.last_used_at < ACTIVE_MS),
  };
}

export function listClients() {
  return q.list.all().map(toPublic);
}

export function createClient(name, kind = "app") {
  const key = `hc_${crypto.randomBytes(24).toString("base64url")}`;
  const id = crypto.randomUUID();
  q.insert.run(id, name, kind, hash(key), key.slice(0, 7), Date.now());
  return { client: toPublic(q.get.get(id)), key };
}

export function revokeClient(id) {
  return q.remove.run(id).changes > 0;
}

// The client a key belongs to (or null), recording the request as its latest use.
// Looked up by the key's hash: the hash of a random 192-bit key leaks nothing useful.
export function useKey(key, req) {
  if (!key) return null;
  const row = q.byHash.get(hash(key));
  if (!row) return null;
  q.touch.run(Date.now(), req.ip, (req.headers["user-agent"] || "").slice(0, 200), row.id);
  return toPublic({ ...row, requests: row.requests + 1, last_used_at: Date.now() });
}
