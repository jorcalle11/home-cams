import { Router } from "express";
import { asyncRoute } from "../../middleware/async-route.js";
import { listCamerasAndGroups, getStream, setPower } from "./cameras.service.js";

export const camerasRouter = Router();

camerasRouter.get("/", asyncRoute(async (_req, res) => {
  res.json(await listCamerasAndGroups());
}));

camerasRouter.get("/:mac/stream", asyncRoute(async (req, res) => {
  const { model, substream } = req.query;
  if (!model) return res.status(400).json({ error: "Missing model" });
  res.json(await getStream(req.params.mac, model, substream === "true"));
}));

camerasRouter.post("/:mac/power", asyncRoute(async (req, res) => {
  const { model, on } = req.body || {};
  if (!model || typeof on !== "boolean") return res.status(400).json({ error: "Missing model or on" });
  await setPower(req.params.mac, model, on);
  res.json({ on });
}));
