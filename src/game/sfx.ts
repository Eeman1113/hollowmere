// Procedural audio. No files ship with the game; every sound is synthesised.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function ac() {
  if (!ctx) {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.26;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setVolume(v: number) { if (master) master.gain.value = v * 0.5; }
export function setMuted(m: boolean) { muted = m; if (master) master.gain.value = m ? 0 : 0.26; }
export function isMuted() { return muted; }

type Wave = OscillatorType;

function tone(freq: number, dur: number, type: Wave = 'sine', vol = 0.3, slideTo?: number, delay = 0) {
  if (muted) return;
  try {
    const c = ac();
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.012, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master!);
    o.start(t0); o.stop(t0 + dur + 0.02);
  } catch { /* audio unavailable */ }
}

function noise(dur: number, vol = 0.2, filterHz = 1800, delay = 0, q = 1) {
  if (muted) return;
  try {
    const c = ac();
    const t0 = c.currentTime + delay;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = filterHz; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master!);
    src.start(t0);
  } catch { /* audio unavailable */ }
}

export const sfx = {
  swing(heavy = false) { noise(heavy ? 0.26 : 0.15, heavy ? 0.26 : 0.18, heavy ? 700 : 1500, 0, 0.7); if (heavy) tone(120, 0.2, 'sawtooth', 0.1, 60); },
  hit(crit = false) {
    noise(0.1, 0.3, crit ? 2600 : 1400, 0, 2);
    tone(crit ? 320 : 180, 0.1, 'square', 0.18, crit ? 90 : 70);
  },
  hurt() { noise(0.2, 0.3, 500, 0, 0.8); tone(140, 0.22, 'sawtooth', 0.2, 60); },
  block() { noise(0.12, 0.3, 3200, 0, 4); tone(640, 0.1, 'triangle', 0.14, 420); },
  roll() { noise(0.26, 0.14, 420, 0, 0.6); },
  die() { tone(220, 0.4, 'triangle', 0.16, 70); noise(0.3, 0.14, 700); },
  death() {
    tone(110, 1.4, 'sine', 0.3, 48);
    tone(164, 1.2, 'triangle', 0.14, 60, 0.08);
    noise(1.0, 0.1, 300);
  },
  heal() { tone(520, 0.2, 'sine', 0.14, 760); tone(780, 0.3, 'sine', 0.1, 1040, 0.08); },
  pickup() { tone(680, 0.08, 'square', 0.12, 900); tone(960, 0.1, 'square', 0.08, 1200, 0.05); },
  click() { tone(540, 0.04, 'square', 0.1); },
  fail() { tone(180, 0.1, 'square', 0.1, 120); },
  shoot() { tone(900, 0.1, 'sawtooth', 0.1, 420); noise(0.08, 0.1, 2400); },
  boom() { tone(70, 0.6, 'sine', 0.34, 34); noise(0.5, 0.3, 320, 0, 0.5); },
  level() { for (let i = 0; i < 4; i++) tone([392, 523, 659, 784][i], 0.3, 'triangle', 0.14, undefined, i * 0.09); },
  lantern() {
    for (let i = 0; i < 3; i++) tone([330, 440, 554][i], 1.3, 'sine', 0.12, undefined, i * 0.14);
    noise(0.7, 0.07, 900);
  },
  bossHorn() {
    tone(82, 1.8, 'sawtooth', 0.26, 76);
    tone(123, 1.6, 'sawtooth', 0.16, 116, 0.1);
    noise(1.4, 0.08, 220);
  },
  bossDown() {
    for (let i = 0; i < 5; i++) tone([196, 262, 330, 392, 523][i], 1.2, 'triangle', 0.14, undefined, i * 0.16);
    tone(65, 2.2, 'sine', 0.2, 40);
  },
  bell() { tone(440, 2.4, 'sine', 0.22, 436); tone(660, 2.0, 'sine', 0.1, 654, 0.02); tone(880, 1.6, 'sine', 0.06, 872, 0.04); },
  page() { noise(0.14, 0.12, 4200, 0, 1.4); },
};
