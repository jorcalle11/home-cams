import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";

// SQLite database next to the Wyze token, in the directory Docker already keeps in a volume.
fs.mkdirSync(config.dataDir, { recursive: true });
export const db = new DatabaseSync(config.dataDir + "home-cams.db");

db.exec(`
  PRAGMA journal_mode = WAL;

  -- API clients: other apps that call the API, each with its own key.
  CREATE TABLE IF NOT EXISTS clients (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    key_hash     TEXT NOT NULL UNIQUE,         -- sha256 of the key
    prefix       TEXT NOT NULL,                -- first characters of the key, to recognise it
    created_at   INTEGER NOT NULL,             -- ms since epoch
    last_used_at INTEGER,
    last_ip      TEXT,
    user_agent   TEXT,
    requests     INTEGER NOT NULL DEFAULT 0
  );

  -- The only user of the web app, created by the signup on first run. The CHECK allows one row.
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY CHECK (id = 1),
    username      TEXT NOT NULL,
    password_hash TEXT NOT NULL,               -- scrypt, "salt:hash" in hex
    created_at    INTEGER NOT NULL
  );

  -- Web login sessions. Only a sha256 of the cookie value is stored.
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
`);

// Before the login page, each browser had its own API key (kind = 'web'). The web now uses
// its session, so those keys and the column go.
if (db.prepare("SELECT 1 FROM pragma_table_info('clients') WHERE name = 'kind'").get()) {
  db.exec("DELETE FROM clients WHERE kind = 'web'; ALTER TABLE clients DROP COLUMN kind;");
}
