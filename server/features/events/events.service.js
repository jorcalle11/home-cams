import { wyze } from "../../wyze/client.js";

// Labels shown in the UI, so they stay in Spanish.
const AI_TAGS = { 101: "Persona", 102: "Vehículo", 103: "Mascota", 104: "Paquete" };
const ALARM_TYPES = { 1: "Movimiento", 2: "Sonido" };

// Wyze returns at most ~30 events per page (newest first) and flags more with next_page.
// To paginate, request again with end_time = last event's ts - 1.
const PAGES_PER_CALL = 3;

export async function listEvents({ macs = [], begin, end }) {
  const events = [];
  let cursor = end;
  let more = true;
  for (let page = 0; page < PAGES_PER_CALL && more; page++) {
    const res = await wyze.request("app/v2/device/get_event_list", {
      device_mac: "",
      device_mac_list: macs,
      event_type: "",
      event_value_list: [],
      event_tag_list: [],
      begin_time: begin,
      end_time: cursor,
      count: 30,
      order_by: 2,
    });
    // The response is wrapped: { code, msg, data: { event_list, next_page } }
    const list = res.data?.data?.event_list || [];
    events.push(...list.map(toEvent));
    more = Boolean(res.data?.data?.next_page) && list.length > 0;
    if (list.length) cursor = list.at(-1).event_ts - 1;
  }
  return { events, next: more ? cursor : null };
}

function toEvent(e) {
  const files = e.file_list || [];
  const tags = new Set([...(e.tag_list || []), ...files.flatMap((f) => f.ai_tag_list || [])]);
  return {
    id: e.event_id,
    mac: e.device_mac,
    model: e.device_model,
    ts: e.event_ts,
    type: ALARM_TYPES[e.event_value] || `Evento ${e.event_value}`,
    tags: [...tags].map((t) => AI_TAGS[t] || String(t)),
    image: files.find((f) => f.type === 1)?.url || null,
    video: files.find((f) => f.type === 2)?.url || null, // Cam Plus only
  };
}
