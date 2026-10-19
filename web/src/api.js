async function get(path, init) {
  const res = await fetch(path, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body;
}

export const api = {
  cameras: () => get("/api/cameras"), // { cameras, groups }
  stream: (cam, substream) =>
    get(`/api/cameras/${encodeURIComponent(cam.mac)}/stream?model=${encodeURIComponent(cam.model)}&substream=${substream}`),
  // { events, next } — next is the end for requesting the next page (or null).
  events: ({ macs, begin, end }) => {
    const q = new URLSearchParams({ begin, end });
    for (const mac of macs) q.append("mac", mac);
    return get(`/api/events?${q}`);
  },
  setPower: (cam, on) =>
    get(`/api/cameras/${encodeURIComponent(cam.mac)}/power`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: cam.model, on }),
    }),
};
