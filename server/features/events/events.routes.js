import { Router } from "express";
import { asyncRoute } from "../../middleware/async-route.js";
import { listEvents } from "./events.service.js";

export const eventsRouter = Router();

eventsRouter.get("/", asyncRoute(async (req, res) => {
  const end = Number(req.query.end) || Date.now();
  const begin = Number(req.query.begin) || end - 24 * 60 * 60 * 1000;
  const macs = req.query.mac ? [].concat(req.query.mac) : [];
  res.json(await listEvents({ macs, begin, end })); // { events, next }
}));
