import { useEffect, useState } from "react";
import { api } from "./api.js";
import CameraTile from "./CameraTile.jsx";
import Events from "./Events.jsx";
import { useUrlState } from "./useUrlState.js";
import { useTheme } from "./useTheme.js";

const THEME_LABEL = { system: "🖥 Sistema", light: "☀️ Claro", dark: "🌙 Oscuro" };
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function App() {
  const [params, setParams, goHome] = useUrlState();
  const [theme, cycleTheme] = useTheme();
  const [data, setData] = useState(null); // { cameras, groups }
  const [error, setError] = useState(null);
  const tab = params.tab === "events" ? "events" : "live";
  const view = params.view === "list" ? "list" : "grid";

  useEffect(() => {
    api.cameras().then(setData, (e) => setError(e.message));
  }, []);

  // ?group= accepts the group name (case- and accent-insensitive) or its id.
  const group = params.group && data?.groups.find((g) => g.id === params.group || norm(g.name) === norm(params.group));
  const cameras = data && (group ? data.cameras.filter((c) => group.macs.includes(c.mac)) : data.cameras);

  return (
    <div className="app">
      <header>
        <h1>
          <a
            href="/"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // opening in a new tab still works
              e.preventDefault();
              goHome();
            }}
          >
            Home Cams
          </a>
        </h1>
        <nav>
          {data?.groups.length > 0 && (
            <select
              value={group?.id || ""}
              onChange={(e) => setParams({ group: data.groups.find((g) => g.id === e.target.value)?.name, cam: null })}
              aria-label="Grupo"
            >
              <option value="">Todas las cámaras ({data.cameras.length})</option>
              {data.groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name} ({g.macs.length})</option>
              ))}
            </select>
          )}
          <button className={tab === "live" ? "active" : ""} onClick={() => setParams({ tab: null })}>En vivo</button>
          <button className={tab === "events" ? "active" : ""} onClick={() => setParams({ tab: "events" })}>Eventos</button>
          {tab === "live" && (
            <div className="segmented" role="group" aria-label="Vista">
              <button className={view === "grid" ? "active" : ""} onClick={() => setParams({ view: null })} title="Cuadrícula">▦</button>
              <button className={view === "list" ? "active" : ""} onClick={() => setParams({ view: "list" })} title="Lista">☰</button>
            </div>
          )}
          <button onClick={cycleTheme} title="Tema (clic para cambiar)">{THEME_LABEL[theme]}</button>
        </nav>
      </header>

      <main>
        {error && <p className="error">No se pudo conectar con Wyze: {error}</p>}
        {!data && !error && <p className="muted">Cargando cámaras…</p>}

        {cameras && tab === "live" && (
          <div className={view}>
            {cameras.map((cam) => <CameraTile key={cam.mac} camera={cam} />)}
          </div>
        )}
        {cameras && tab === "events" && <Events cameras={cameras} params={params} setParams={setParams} />}
      </main>
    </div>
  );
}
