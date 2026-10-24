// The web uses its own API key, like any other client, so each browser shows up in
// GET /api/keys and can be revoked. The key is created on first use with the app login
// (the page is already behind it, so the browser sends it) and kept in localStorage.
const STORAGE_KEY = "home-cams.apiKey";

// "Chrome en macOS": how this browser is named in the client list.
function browserName() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS"
    : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} en ${os}` : browser;
}

let keyPromise = null; // shared, so parallel requests create a single key
function apiKey() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return Promise.resolve(stored);
  keyPromise ||= fetch("/api/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: `Web · ${browserName()}`, kind: "web" }),
  })
    .then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || res.statusText);
      localStorage.setItem(STORAGE_KEY, body.key);
      return body.key;
    })
    .finally(() => { keyPromise = null; });
  return keyPromise;
}

async function get(path, init = {}, retried = false) {
  const key = await apiKey();
  const res = await fetch(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${key}` } });
  // Revoked (or the database was reset): get a new key once.
  if (res.status === 401 && !retried) {
    localStorage.removeItem(STORAGE_KEY);
    return get(path, init, true);
  }
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
