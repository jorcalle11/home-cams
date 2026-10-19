import { useEffect, useRef, useState } from "react";
import { useKvsStream } from "./useKvsStream.js";
import { api } from "./api.js";
import { playShutter, downloadBlob, captureVideoFrame } from "./snapshot.js";

const LABELS = { idle: "", connecting: "Conectando…", reconnecting: "Reconectando…", live: "● En vivo", error: "Error" };

export default function CameraTile({ camera }) {
  const [on, setOn] = useState(camera.on);
  const [playing, setPlaying] = useState(camera.online && camera.on);
  const [substream, setSubstream] = useState(true); // SD by default in the grid to save bandwidth
  const [muted, setMuted] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [powerBusy, setPowerBusy] = useState(false);
  const [powerError, setPowerError] = useState(null);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const mediaRef = useRef(null);
  const canStream = camera.online && on;
  // Always HD in fullscreen.
  const { videoRef, status, error, hasAudio } = useKvsStream(camera, {
    enabled: playing && canStream,
    substream: substream && !fullscreen,
  });

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === mediaRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted, status]);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else mediaRef.current?.requestFullscreen();
  }

  // Capture the current frame of the live video. If it isn't streaming, connect and capture
  // as soon as the first frame arrives.
  const pendingSnapshot = useRef(false);

  async function capture() {
    pendingSnapshot.current = false;
    try {
      const blob = await captureVideoFrame(videoRef.current);
      playShutter();
      setFlash(true);
      setTimeout(() => setFlash(false), 150);
      downloadBlob(blob, camera.name);
    } catch (e) {
      setPowerError(e.message);
    } finally {
      setSnapshotBusy(false);
    }
  }

  function takeSnapshot() {
    setSnapshotBusy(true);
    setPowerError(null);
    const video = videoRef.current;
    if (status === "live" && video?.videoWidth) return capture();
    pendingSnapshot.current = true;
    setPlaying(true);
  }

  useEffect(() => {
    if (!pendingSnapshot.current) return;
    if (status === "error") {
      pendingSnapshot.current = false;
      setSnapshotBusy(false);
      return;
    }
    const video = videoRef.current;
    if (status !== "live" || !video) return;
    if (video.videoWidth) return void capture();
    // The "live" state can arrive before the first decoded frame.
    video.addEventListener("loadeddata", capture, { once: true });
    return () => video.removeEventListener("loadeddata", capture);
  }, [status]);

  async function togglePower() {
    setPowerBusy(true);
    setPowerError(null);
    try {
      await api.setPower(camera, !on);
      setOn(!on);
      setPlaying(!on); // turning on starts streaming; turning off stops it
    } catch (e) {
      setPowerError(e.message);
    } finally {
      setPowerBusy(false);
    }
  }

  return (
    <article className="tile">
      <div className={`media ${fullscreen ? "is-fullscreen" : ""}`} ref={mediaRef} onDoubleClick={toggleFullscreen}>
        <video ref={videoRef} autoPlay muted playsInline hidden={status !== "live"} />
        {status !== "live" && camera.thumbnail && <img src={camera.thumbnail} alt="" />}
        {flash && <span className="flash" />}
        {!on && <span className="overlay center">Cámara apagada</span>}
        {status !== "idle" && <span className={`badge ${status}`}>{LABELS[status]}</span>}
        {(error || powerError) && <span className="overlay">{powerError || error}</span>}
        <div className="media-controls">
          <button
            onClick={() => setMuted((m) => !m)}
            disabled={status !== "live" || !hasAudio}
            title={hasAudio ? (muted ? "Activar audio" : "Silenciar") : "Sin audio"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <button onClick={toggleFullscreen} title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}>
            {fullscreen ? "⤡" : "⤢"}
          </button>
        </div>
      </div>
      <footer>
        <div>
          <strong>{camera.name}</strong>
          <small className="muted">
            {camera.model} · fw {camera.firmware || "?"} · {!camera.online ? "offline" : on ? "online" : "apagada"}
          </small>
        </div>
        <div className="actions">
          <button
            className={on ? "" : "danger"}
            onClick={togglePower}
            disabled={!camera.online || powerBusy}
            title={on ? "Apagar cámara" : "Encender cámara"}
          >
            {powerBusy ? "…" : on ? "⏻ Apagar" : "⏻ Encender"}
          </button>
          <button onClick={() => setSubstream((s) => !s)} title="Calidad">{substream ? "SD" : "HD"}</button>
          <button onClick={takeSnapshot} title="Captura (descarga JPG)" disabled={!canStream || snapshotBusy}>
            {snapshotBusy ? "…" : "📷"}
          </button>
          <button className="primary" disabled={!canStream} onClick={() => setPlaying((p) => !p)}>
            {playing ? "Detener" : "Ver"}
          </button>
        </div>
      </footer>
    </article>
  );
}
