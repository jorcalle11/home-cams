import express from "express";
import { fileURLToPath } from "node:url";
import { listCamerasAndGroups, getStream, listEvents, setPower } from "./wyze.js";
import { basicAuth, cors } from "./auth.js";

const app = express();
app.disable("x-powered-by");
// No auth and no data: used by the Docker healthcheck.
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.use("/api", cors());
app.use(basicAuth());
app.use(express.json());
const route = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    // Trim: some wyze-api errors include signed URLs and TURN credentials.
    const msg = (err.response?.data?.description || err.message).split(":")[0].slice(0, 200);
    console.error(`[${req.method} ${req.path}]`, msg);
    res.status(502).json({ error: msg });
  });

app.get("/api/cameras", route(async (_req, res) => {
  res.json(await listCamerasAndGroups());
}));

app.get("/api/cameras/:mac/stream", route(async (req, res) => {
  const { model, substream } = req.query;
  if (!model) return res.status(400).json({ error: "Falta model" });
  res.json(await getStream(req.params.mac, model, substream === "true"));
}));

app.post("/api/cameras/:mac/power", route(async (req, res) => {
  const { model, on } = req.body || {};
  if (!model || typeof on !== "boolean") return res.status(400).json({ error: "Faltan model u on" });
  await setPower(req.params.mac, model, on);
  res.json({ on });
}));

app.get("/api/events", route(async (req, res) => {
  const end = Number(req.query.end) || Date.now();
  const begin = Number(req.query.begin) || end - 24 * 60 * 60 * 1000;
  const macs = req.query.mac ? [].concat(req.query.mac) : [];
  res.json(await listEvents({ macs, begin, end })); // { events, next }
}));

if (process.env.NODE_ENV === "production") {
  const dist = fileURLToPath(new URL("../dist/", import.meta.url));
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(dist + "index.html"));
}

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 5178);
app.listen(port, host, () => console.log(`API en http://${host}:${port}`));
