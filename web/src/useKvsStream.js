import { useEffect, useRef, useState } from "react";
import { api } from "./api.js";

// Wyze streams live through Amazon Kinesis Video Streams (WebRTC).
// The browser is the "viewer" and the camera is the "MASTER".
const encode = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
function decode(raw) {
  if (!raw || raw === "null") return null;
  try {
    return JSON.parse(raw);
  } catch {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)))));
  }
}

const MAX_RETRIES = 3;

// Put H.264 first: it's the only video codec Wyze cameras send.
function preferH264(transceiver) {
  const codecs = RTCRtpReceiver.getCapabilities?.("video")?.codecs;
  if (!codecs || !transceiver.setCodecPreferences) return;
  const h264 = codecs.filter((c) => c.mimeType === "video/H264");
  transceiver.setCodecPreferences([...h264, ...codecs.filter((c) => c.mimeType !== "video/H264")]);
}

export function useKvsStream(camera, { enabled, substream }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | connecting | live | reconnecting | error
  const [error, setError] = useState(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const failures = useRef(0);

  // Changing camera/quality/enabled resets the retry counter.
  useEffect(() => {
    failures.current = 0;
  }, [camera.mac, enabled, substream]);

  useEffect(() => {
    if (!enabled) return setStatus("idle");
    let cancelled = false;
    let live = false;
    let retryTimer;
    let pc, ws;
    const pending = [];
    setStatus(failures.current ? "reconnecting" : "connecting");
    setError(null);
    setHasAudio(false);

    const fail = (msg) => {
      if (cancelled) return;
      cancelled = true;
      ws?.close(1000);
      pc?.close();
      if (failures.current < MAX_RETRIES) {
        failures.current += 1;
        setStatus("reconnecting");
        retryTimer = setTimeout(() => setRetryKey((k) => k + 1), 2000 * failures.current);
      } else {
        setError(msg);
        setStatus("error");
      }
    };

    api.stream(camera, substream).then(({ signalingUrl, iceServers }) => {
      if (cancelled) return;
      pc = new RTCPeerConnection({ iceServers });
      preferH264(pc.addTransceiver("video", { direction: "recvonly" }));
      // The camera answers audio as "sendrecv" (intercom); with "recvonly" the browser rejects
      // the answer ("Incompatible send direction"). Without a local track nothing is sent.
      pc.addTransceiver("audio", { direction: "sendrecv" });
      // Video and audio arrive as separate tracks: merge them into a single MediaStream.
      const media = new MediaStream();
      pc.ontrack = (e) => {
        media.addTrack(e.track);
        if (e.track.kind === "audio") setHasAudio(true);
        if (videoRef.current && videoRef.current.srcObject !== media) videoRef.current.srcObject = media;
      };
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") {
          live = true;
          setStatus("live");
          failures.current = 0;
        }
        // "disconnected" usually recovers on its own; "failed" doesn't.
        if (state === "disconnected") setStatus("reconnecting");
        if (state === "failed") fail("Conexión fallida");
      };

      ws = new WebSocket(signalingUrl);
      const send = (action, payload) =>
        ws.readyState === WebSocket.OPEN &&
        ws.send(JSON.stringify({ action, messagePayload: encode(payload), recipientClientId: "MASTER" }));

      pc.onicecandidate = (e) => e.candidate && send("ICE_CANDIDATE", e.candidate);
      ws.onopen = async () => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send("SDP_OFFER", offer);
      };
      ws.onmessage = async (e) => {
        if (typeof e.data !== "string" || !e.data) return;
        try {
          const msg = JSON.parse(e.data);
          const type = msg.messageType || msg.action;
          const payload = decode(msg.messagePayload);
          if (!payload) return;
          if (type === "SDP_ANSWER" && pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(payload);
            for (const c of pending.splice(0)) await pc.addIceCandidate(c);
          } else if (type === "ICE_CANDIDATE") {
            if (pc.remoteDescription) await pc.addIceCandidate(payload);
            else pending.push(payload);
          }
        } catch (err) {
          console.error(`[${camera.name}] señalización:`, err);
          fail(err.message);
        }
      };
      // Once WebRTC is connected, the signaling channel is no longer needed.
      ws.onclose = (e) => !live && e.code !== 1000 && fail(`Señalización cerrada (${e.code})`);
    }, (err) => fail(err.message));

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      ws?.close(1000);
      pc?.close();
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [camera.mac, camera.model, enabled, substream, retryKey]);

  return { videoRef, status, error, hasAudio };
}
