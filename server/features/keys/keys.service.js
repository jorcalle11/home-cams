import crypto from "node:crypto";
import { db } from "../../db.js";

// API clients: each other app that calls the API has its own key, so every consumer
// is registered and can be revoked on its own. Only a SHA-256 of each key is stored; the key
// itself is returned once, when it's created.

// A client counts as "active" when it called the API in the last few minutes.
const ACTIVE_MS = 5 * 60 * 1000;

const hash = (key) => crypto.createHash("sha256").update(key).digest("hex");

const q = {
  list: db.prepare("SELECT * FROM clients ORDER BY COALESCE(last_used_at, created_at) DESC"),
  get: db.prepare("SELECT * FROM clients WHERE id = ?"),
  byHash: db.prepare("SELECT * FROM clients WHERE key_hash = ?"),
  insert: db.prepare(
    "INSERT INTO clients (id, name, key_hash, prefix, created_at) VALUES (?, ?, ?, ?, ?)",
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

export function createClient(name) {
  const key = `hc_${crypto.randomBytes(24).toString("base64url")}`;
  const id = crypto.randomUUID();
  q.insert.run(id, name, hash(key), key.slice(0, 7), Date.now());
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
