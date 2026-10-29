// Tiny WebAudio synth so the game has sound without any audio assets.
let ctx: AudioContext | null = null;
let muted = false;
export const setMuted = (m: boolean) => { muted = m; };
export const isMuted = () => muted;

function ac() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, vol = 0.08, slide = 0) {
  const a = ac();
  if (!a || muted) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), a.currentTime + dur);
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur);
}

function noise(dur: number, vol = 0.08, hp = 800) {
  const a = ac();
  if (!a || muted) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = a.createBufferSource();
  s.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = hp;
  const g = a.createGain(); g.gain.value = vol;
  s.connect(f).connect(g).connect(a.destination);
  s.start();
}

export const sfx = {
  swing: () => noise(0.12, 0.05, 1800),
  hit: () => { noise(0.08, 0.12, 300); tone(140, 0.12, 'square', 0.05, -80); },
  hurt: () => tone(220, 0.25, 'sawtooth', 0.06, -140),
  pickup: () => { tone(660, 0.07, 'square', 0.04); setTimeout(() => tone(990, 0.08, 'square', 0.04), 60); },
  chop: () => { noise(0.06, 0.1, 500); tone(90, 0.1, 'triangle', 0.08); },
  eat: () => noise(0.18, 0.05, 2500),
  drink: () => { tone(400, 0.1, 'sine', 0.05, 200); setTimeout(() => tone(500, 0.1, 'sine', 0.05, 200), 120); },
  level: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'square', 0.05), i * 110)),
  coin: () => { tone(1200, 0.06, 'square', 0.04); setTimeout(() => tone(1600, 0.1, 'square', 0.04), 70); },
  click: () => tone(800, 0.03, 'square', 0.03),
  death: () => tone(200, 1.2, 'sawtooth', 0.07, -170),
  boss: () => { tone(60, 1.5, 'sawtooth', 0.09, -20); noise(1.2, 0.05, 100); },
};
