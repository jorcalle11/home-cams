import { Wyze } from "./wyze-quiet.js";

export const wyze = new Wyze({
  username: process.env.WYZE_EMAIL,
  password: process.env.WYZE_PASSWORD,
  keyId: process.env.WYZE_KEY_ID,
  apiKey: process.env.WYZE_API_KEY,
  // Persist the token so every start doesn't log in again (Wyze rate-limits logins).
  persistPath: new URL("../.wyze/", import.meta.url).pathname,
  logLevel: process.env.WYZE_LOG_LEVEL || "none",
});

// A single get_object_list call returns devices and groups (the ones created in the Wyze app).
export async function listCamerasAndGroups() {
  const { data } = await wyze.getObjectList();
  const cameras = (data.device_list || []).filter((d) => d.product_type?.toLowerCase() === "camera");
  const camMacs = new Set(cameras.map((d) => d.mac));
  const groups = (data.device_group_list || [])
    .map((g) => ({
      id: String(g.group_id),
      name: g.group_name,
      macs: (g.device_list || []).map((d) => d.device_mac).filter((mac) => camMacs.has(mac)),
    }))
    .filter((g) => g.macs.length > 0);
  return { cameras: cameras.map(toCamera), groups };
}

export async function listCameras() {
  return (await listCamerasAndGroups()).cameras;
}

function toCamera(d) {
  return {
    mac: d.mac,
    model: d.product_model,
    name: d.nickname,
    online: wyze.cameraIsOnline(d),
    // power_switch 0 = camera off / privacy mode: it doesn't stream even when connected.
    on: d.device_params?.power_switch !== 0,
    thumbnail: wyze.cameraGetThumbnail(d),
    firmware: wyze.cameraGetFirmware(d),
    ip: wyze.cameraGetIp(d),
  };
}

export function getStream(mac, model, substream) {
  // The signaling URL is pre-signed (AWS SigV4): hand it to the browser untouched.
  return wyze.getCameraWebRTCConnectionInfo(mac, model, { substream, noCache: true });
}

export async function setPower(mac, model, on) {
  const res = await wyze.runAction(mac, model, on ? "power_on" : "power_off");
  if (String(res?.code) !== "1") throw new Error(`Wyze rechazó el cambio (${res?.code} ${res?.msg || ""})`);
}

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
