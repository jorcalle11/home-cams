import { useEffect, useState } from "react";
import { api } from "./api.js";

// "YYYY-MM-DD" in local time (what <input type="date"> uses).
const toDateInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
function dayRange(value) {
  const [y, m, d] = value.split("-").map(Number);
  const begin = new Date(y, m - 1, d).getTime();
  return { begin, end: Math.min(new Date(y, m - 1, d + 1).getTime() - 1, Date.now()) };
}
const shiftDay = (value, days) => {
  const [y, m, d] = value.split("-").map(Number);
  return toDateInput(new Date(y, m - 1, d + days));
};

export default function Events({ cameras, params, setParams }) {
  const today = toDateInput(new Date());
  // ?cam=<mac> and ?day=YYYY-MM-DD come from the URL; invalid values are ignored.
  const mac = cameras.some((c) => c.mac === params.cam) ? params.cam : "";
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.day || "") && params.day <= today ? params.day : today;
  const setMac = (cam) => setParams({ cam });
  const setDay = (d) => setParams({ day: d === today ? null : d });
  const [events, setEvents] = useState(null);
  const [next, setNext] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const names = Object.fromEntries(cameras.map((c) => [c.mac, c.name]));
  const macsKey = cameras.map((c) => c.mac).join(",");
  // No camera selected: every camera in the selected group.
  const macs = mac ? [mac] : cameras.map((c) => c.mac);

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    setNext(null);
    setError(null);
    api.events({ macs, ...dayRange(day) }).then(
      (r) => !cancelled && (setEvents(r.events), setNext(r.next)),
      (e) => !cancelled && setError(e.message),
    );
    return () => {
      cancelled = true;
    };
  }, [mac, day, macsKey]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const r = await api.events({ macs, begin: dayRange(day).begin, end: next });
      setEvents((prev) => [...prev, ...r.events]);
      setNext(r.next);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  }

  // Group by hour so a full day is easy to browse.
  const byHour = [];
  for (const ev of events || []) {
    const hour = new Date(ev.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }).replace(/:\d\d/, ":00");
    if (byHour.at(-1)?.hour !== hour) byHour.push({ hour, items: [] });
    byHour.at(-1).items.push(ev);
  }

  return (
    <section>
      <div className="filters">
        <select value={mac} onChange={(e) => setMac(e.target.value)}>
          <option value="">Todas ({cameras.length})</option>
          {cameras.map((c) => <option key={c.mac} value={c.mac}>{c.name}</option>)}
        </select>
        <button onClick={() => setDay(shiftDay(day, -1))} title="Día anterior">‹</button>
        <input type="date" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} />
        <button onClick={() => setDay(shiftDay(day, 1))} disabled={day >= today} title="Día siguiente">›</button>
        {day !== today && <button onClick={() => setDay(today)}>Hoy</button>}
        {events && <span className="muted count">{events.length}{next ? "+" : ""} eventos</span>}
      </div>

      {error && <p className="error">{error}</p>}
      {!events && !error && <p className="muted">Cargando eventos…</p>}
      {events?.length === 0 && <p className="muted">Sin eventos este día.</p>}

      {byHour.map(({ hour, items }) => (
        <div key={hour + items[0].id}>
          <h3 className="hour">{hour} <span className="muted">· {items.length}</span></h3>
          <div className="events">
            {items.map((ev) => (
              <button key={ev.id} className="event" onClick={() => setOpen(ev)}>
                {ev.image ? <img src={ev.image} alt="" loading="lazy" /> : <div className="noimg" />}
                <div>
                  <strong>{names[ev.mac] || ev.mac}</strong>
                  <small>{new Date(ev.ts).toLocaleTimeString()}</small>
                  <small>{[ev.type, ...ev.tags].join(" · ")}{ev.video ? " · ▶ video" : ""}</small>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {next && (
        <p className="more">
          <button onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Cargando…" : "Cargar más"}</button>
        </p>
      )}

      {open && (
        <div className="modal" onClick={() => setOpen(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            {open.video ? <video src={open.video} controls autoPlay playsInline /> : <img src={open.image} alt="" />}
            <p>{names[open.mac]} — {new Date(open.ts).toLocaleString()} — {[open.type, ...open.tags].join(" · ")}</p>
            <button onClick={() => setOpen(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </section>
  );
}
