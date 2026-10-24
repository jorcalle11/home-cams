import express from "express";
import { fileURLToPath } from "node:url";
import { listCamerasAndGroups, getStream, listEvents, setPower } from "./wyze.js";
import { basicAuth, apiKeyAuth, cors } from "./auth.js";
import { listClients, createClient, revokeClient } from "./clients.js";

const app = express();
app.disable("x-powered-by");
// Behind Caddy on a private network: take the client's IP from X-Forwarded-For.
app.set("trust proxy", "loopback, uniquelocal");
// No auth and no data: used by the Docker healthcheck.
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.use("/api", cors());
app.use(express.json());
const login = basicAuth();
const route = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    // Trim: some wyze-api errors include signed URLs and TURN credentials.
    const msg = (err.response?.data?.description || err.message).split(":")[0].slice(0, 200);
    console.error(`[${req.method} ${req.path}]`, msg);
    res.status(502).json({ error: msg });
  });

// ---- API keys: one per client (app or browser). Managed with the app login. ----
app.get("/api/keys", login, (_req, res) => {
  res.json({ clients: listClients() });
});

// The key is only ever returned here; the server keeps just its hash.
app.post("/api/keys", login, (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 80);
  if (!name) return res.status(400).json({ error: "Missing name" });
  const kind = req.body?.kind === "web" ? "web" : "app";
  res.status(201).json(createClient(name, kind)); // { client, key }
});

app.delete("/api/keys/:id", login, (req, res) => {
  if (!revokeClient(req.params.id)) return res.status(404).json({ error: "Not found" });
  res.sendStatus(204);
});

// ---- Data API: every request needs an API key ----
app.use("/api", apiKeyAuth());

app.get("/api/cameras", route(async (_req, res) => {
  res.json(await listCamerasAndGroups());
}));

app.get("/api/cameras/:mac/stream", route(async (req, res) => {
  const { model, substream } = req.query;
  if (!model) return res.status(400).json({ error: "Missing model" });
  res.json(await getStream(req.params.mac, model, substream === "true"));
}));

app.post("/api/cameras/:mac/power", route(async (req, res) => {
  const { model, on } = req.body || {};
  if (!model || typeof on !== "boolean") return res.status(400).json({ error: "Missing model or on" });
  await setPower(req.params.mac, model, on);
  res.json({ on });
}));

app.get("/api/events", route(async (req, res) => {
  const end = Number(req.query.end) || Date.now();
  const begin = Number(req.query.begin) || end - 24 * 60 * 60 * 1000;
  const macs = req.query.mac ? [].concat(req.query.mac) : [];
  res.json(await listEvents({ macs, begin, end })); // { events, next }
}));

// ---- Web page: the app login ----
app.use(login);
if (process.env.NODE_ENV === "production") {
  const dist = fileURLToPath(new URL("../dist/", import.meta.url));
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(dist + "index.html"));
}

const { HOST: host, API_PORT: port } = process.env;
if (!host || !port) {
  console.error("HOST and API_PORT must be set");
  process.exit(1);
}
app.listen(Number(port), host, () => console.log(`API running on http://${host}:${port}`));
