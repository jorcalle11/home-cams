import { Router } from "express";
import { listClients, createClient, revokeClient } from "./keys.service.js";

// API keys: one per client (app or browser). Mounted behind the app login.
export const keysRouter = Router();

keysRouter.get("/", (_req, res) => {
  res.json({ clients: listClients() });
});

// The key is only ever returned here; the server keeps just its hash.
keysRouter.post("/", (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 80);
  if (!name) return res.status(400).json({ error: "Missing name" });
  const kind = req.body?.kind === "web" ? "web" : "app";
  res.status(201).json(createClient(name, kind)); // { client, key }
});

keysRouter.delete("/:id", (req, res) => {
  if (!revokeClient(req.params.id)) return res.status(404).json({ error: "Not found" });
  res.sendStatus(204);
});
