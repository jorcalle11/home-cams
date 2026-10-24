import { wyze } from "../../wyze/client.js";

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
  if (String(res?.code) !== "1") throw new Error(`Wyze rejected the change (${res?.code} ${res?.msg || ""})`);
}
