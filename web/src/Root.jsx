import { useEffect, useState } from "react";
import { api, SESSION_EXPIRED } from "./api.js";
import App from "./App.jsx";
import Login from "./Login.jsx";

// Picks the screen: signup on first run, login without a session, the app otherwise.
export default function Root() {
  const [session, setSession] = useState(null); // { setupRequired, user }
  const [error, setError] = useState(null);

  useEffect(() => {
    api.session().then(setSession, (e) => setError(e.message));
    const expired = () => setSession((s) => s && { ...s, user: null });
    window.addEventListener(SESSION_EXPIRED, expired);
    return () => window.removeEventListener(SESSION_EXPIRED, expired);
  }, []);

  async function logout() {
    await api.logout().catch(() => {});
    setSession({ setupRequired: false, user: null });
  }

  if (error) return <div className="app"><p className="error">No se pudo conectar con el servidor: {error}</p></div>;
  if (!session) return null;
  if (!session.user) {
    return <Login setup={session.setupRequired} onLogin={(user) => setSession({ setupRequired: false, user })} />;
  }
  return <App user={session.user} onLogout={logout} />;
}
