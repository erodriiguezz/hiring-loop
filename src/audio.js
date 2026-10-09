// Synthesized sound through a master gain and compressor. Follows the arcade's Mute button (mute/1).
let ac = null, master = null, muted = false, noise = null;

export function unlockAudio() {
  if (!ac) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    const comp = ac.createDynamicsCompressor();
    comp.connect(ac.destination);
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(comp);
    noise = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === "suspended") ac.resume();
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}
export const isMuted = () => muted;

export function listenForArcadeMute() {
  if (window.parent === window) return;
  addEventListener("message", (e) => {
    const m = e.data;
    if (e.source === window.parent && m?.arcade === "mute/1" && typeof m.muted === "boolean") setMuted(m.muted);
  });
  window.parent.postMessage({ arcade: "mute/1", op: "ready" }, "*");
}

function tone(type, f0, f1, dur, vol = 0.3, delay = 0) {
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function hiss(dur, vol = 0.3, freq = 1200) {
  const t = ac.currentTime;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noise;
  f.type = "bandpass"; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t); s.stop(t + dur);
}

const SFX = {
  jump: () => tone("square", 320, 640, 0.09, 0.12),
  land: () => hiss(0.05, 0.12, 600),
  death: () => { hiss(0.25, 0.35, 900); tone("sawtooth", 420, 60, 0.35, 0.18); },
  trap: () => { tone("square", 466, 466, 0.08, 0.14); tone("square", 330, 330, 0.12, 0.14, 0.08); },
  thud: () => { tone("sine", 120, 40, 0.25, 0.4); hiss(0.12, 0.25, 300); },
  clear: () => [523, 659, 784, 1047].forEach((f, i) => tone("square", f, f, 0.12, 0.12, i * 0.08)),
  click: () => tone("square", 880, 880, 0.04, 0.08),
  poof: () => hiss(0.18, 0.2, 2400),
};

export function sfx(name) {
  if (!ac || muted || ac.state !== "running") return;
  SFX[name]?.();
}
