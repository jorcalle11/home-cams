import { useState } from "react";
import { api } from "./api.js";

// Server errors are in English; the UI shows its own messages, by status.
const ERRORS = {
  401: "Usuario o contraseña incorrectos.",
  409: "Ya existe un usuario. Inicia sesión.",
  429: "Demasiados intentos fallidos. Espera unos minutos.",
};

// The signup (first run: registers the only user) or the login.
export default function Login({ setup, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (setup && password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (setup && password !== confirm) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    setError(null);
    try {
      const { user } = await (setup ? api.signup : api.login)(username, password);
      onLogin(user);
    } catch (err) {
      setError(ERRORS[err.status] || `No se pudo ${setup ? "crear la cuenta" : "iniciar sesión"}.`);
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form onSubmit={submit}>
        <h1>Home Cams</h1>
        <p className="muted">
          {setup ? "Primera vez: crea el usuario que usará la app. Será el único." : "Inicia sesión para continuar."}
        </p>
        <label>
          Usuario
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required autoFocus />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={setup ? "new-password" : "current-password"}
            required
          />
        </label>
        {setup && (
          <label>
            Repite la contraseña
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          </label>
        )}
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>{setup ? "Crear cuenta" : "Entrar"}</button>
      </form>
    </div>
  );
}
