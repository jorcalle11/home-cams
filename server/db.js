import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";

// SQLite database next to the Wyze token, in the directory Docker already keeps in a volume.
fs.mkdirSync(config.dataDir, { recursive: true });
export const db = new DatabaseSync(config.dataDir + "home-cams.db");

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
