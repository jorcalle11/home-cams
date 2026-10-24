// The web uses its login session (an HttpOnly cookie the browser sends on its own). API keys
// are only for other clients. A 401 with code "login_required" means the session is gone:
// SESSION_EXPIRED is dispatched so the app goes back to the login page.
export const SESSION_EXPIRED = "home-cams:session-expired";

// Before the login page, each browser kept its own API key here; the server deleted them.
try { localStorage.removeItem("home-cams.apiKey"); } catch {}

export class ApiError extends Error {
  constructor(status, body) {
    super(body.error || `HTTP ${status}`);
    this.status = status;
    this.code = body.code;
  }
}

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body && JSON.stringify(body),
  });
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.code === "login_required") window.dispatchEvent(new Event(SESSION_EXPIRED));
    throw new ApiError(res.status, data);
  }
  return data;
}

export const api = {
  session: () => request("/api/auth/session"), // { setupRequired, user }
  signup: (username, password) => request("/api/auth/signup", { method: "POST", body: { username, password } }),
  login: (username, password) => request("/api/auth/login", { method: "POST", body: { username, password } }),
  logout: () => request("/api/auth/logout", { method: "POST" }),

  cameras: () => request("/api/cameras"), // { cameras, groups }
  stream: (cam, substream) =>
    request(`/api/cameras/${encodeURIComponent(cam.mac)}/stream?model=${encodeURIComponent(cam.model)}&substream=${substream}`),
  // { events, next } — next is the end for requesting the next page (or null).
  events: ({ macs, begin, end }) => {
    const q = new URLSearchParams({ begin, end });
    for (const mac of macs) q.append("mac", mac);
    return request(`/api/events?${q}`);
  },
  setPower: (cam, on) =>
    request(`/api/cameras/${encodeURIComponent(cam.mac)}/power`, { method: "POST", body: { model: cam.model, on } }),
};
