// Verifies credentials and access: `npm run check`
// Only prints trimmed error messages: axios errors include the full request (credentials).
import { wyze, listCameras, listEvents, getStream } from "./wyze.js";

function summarize(err) {
  const data = err.response?.data;
  const msg = data ? `${err.response.status} ${data.description || data.msg || ""} (code ${data.errorCode ?? data.code ?? "?"})` : err.message;
  return msg.split(":")[0].slice(0, 200); // some errors include signed URLs and TURN credentials
}

async function step(label, fn) {
  try {
    return await fn();
  } catch (err) {
    console.error(`✗ ${label}: ${summarize(err)}`);
    process.exit(1);
  }
}

await step("Login", () => wyze.maybeLogin());
console.log("✓ Login correcto");

const cams = await step("Cámaras", listCameras);
console.log(`✓ ${cams.length} cámara(s):`);
for (const c of cams) console.log(`   - ${c.name} [${c.model}] fw ${c.firmware} ${c.online ? "online" : "OFFLINE"}${c.on ? "" : " (APAGADA)"}`);

const { events } = await step("Eventos", () => listEvents({ begin: Date.now() - 86400000, end: Date.now() }));
console.log(`✓ ${events.length} evento(s) en las últimas 24h`);
for (const e of events.slice(0, 5)) console.log(`   - ${new Date(e.ts).toLocaleString()} ${e.mac} ${e.type} ${e.tags.join(",")} img:${!!e.image} video:${!!e.video}`);

const cam = cams.find((c) => c.online && c.on);
if (cam) {
  const s = await step("Streaming", () => getStream(cam.mac, cam.model, false));
  console.log(`✓ Credenciales WebRTC para "${cam.name}" (${s.iceServers.length} ICE servers)`);
}
