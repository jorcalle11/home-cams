// Shutter sound synthesized with WebAudio (short noise burst), no audio files.
let audioCtx;
export function playShutter() {
  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    const duration = 0.12;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1200;
    const gain = ctx.createGain();
    gain.gain.value = 0.5;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
  } catch {}
}

const stamp = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
};

export function downloadBlob(blob, cameraName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${cameraName.replace(/[^\p{L}\p{N}_-]+/gu, "_")}_${stamp()}.jpg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Capture the current <video> frame at full resolution.
export function captureVideoFrame(video) {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo generar la imagen"))), "image/jpeg", 0.92),
  );
}
