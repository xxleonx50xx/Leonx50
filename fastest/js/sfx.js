// ================= Sonidos (Web Audio, sintetizados) =================
// Estilo "arcade / shooter": fanfarrias al subir de nivel, medallas, monedas.
// Nota: son sonidos originales sintetizados (no usamos audio con copyright).
let ctx = null;
let enabled = true;

export function setEnabled(v) { enabled = v; }
export function isEnabled() { return enabled; }

export function unlock() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (ctx && ctx.state === "suspended") ctx.resume();
}

function tone(freq, start, dur, type = "sine", gain = 0.25, glideTo = null) {
  if (!ctx || !enabled) return;
  const t0 = ctx.currentTime + start;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(start, dur, gain = 0.15) {
  if (!ctx || !enabled) return;
  const t0 = ctx.currentTime + start;
  const n = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  n.buffer = buf;
  const g = ctx.createGain(); g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1200;
  n.connect(f); f.connect(g); g.connect(ctx.destination); n.start(t0); n.stop(t0 + dur);
}

export const sfx = {
  click() { unlock(); tone(420, 0, 0.06, "triangle", 0.12); },
  coin() { unlock(); tone(880, 0, 0.06, "square", 0.18); tone(1320, 0.05, 0.09, "square", 0.18); },
  star() { unlock(); tone(660, 0, 0.07, "triangle", 0.2); tone(990, 0.07, 0.1, "triangle", 0.2); },
  checkpoint() { unlock(); tone(520, 0, 0.08, "sine", 0.2, 780); noise(0, 0.12, 0.08); },
  // fanfarria de subida de nivel (acorde ascendente + brillo)
  levelUp() {
    unlock();
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22, "sawtooth", 0.16));
    tone(1568, 0.36, 0.5, "triangle", 0.18);
    noise(0.36, 0.3, 0.06);
  },
  // medalla desbloqueada (impacto grave + campanita)
  medal() {
    unlock();
    tone(160, 0, 0.18, "square", 0.22, 90);
    noise(0, 0.18, 0.12);
    tone(1046, 0.14, 0.25, "triangle", 0.2);
    tone(1568, 0.22, 0.3, "triangle", 0.16);
  },
  spin() { unlock(); for (let i = 0; i < 10; i++) tone(500 + i * 40, i * 0.06, 0.05, "square", 0.08); },
  jackpot() {
    unlock();
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.08, 0.3, "sawtooth", 0.16));
    noise(0, 0.4, 0.1);
  },
};
