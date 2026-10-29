// Shared math: seeded RNG, value noise and isometric projection.

export const TW = 64; // tile width (screen px)
export const TH = 32; // tile height (screen px)
export const WALL_H = 44; // wall cube height (screen px)

export const toScreen = (x: number, y: number) => ({ x: (x - y) * (TW / 2), y: (x + y) * (TH / 2) });
export const toWorld = (sx: number, sy: number) => {
  const a = sx / (TW / 2);
  const b = sy / (TH / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
};
/** Painter's-order depth for a world position. */
export const depthOf = (x: number, y: number) => (x + y) * 100;

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;
export const randInt = (r: Rng, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
export const pick = <T,>(r: Rng, arr: T[]) => arr[Math.floor(r() * arr.length)];

/** Smooth 2D value noise in [0,1]. */
export function makeNoise(seed: number) {
  const r = mulberry32(seed);
  const N = 256;
  const perm = new Uint8Array(N * 2);
  const vals = new Float32Array(N);
  for (let i = 0; i < N; i++) { perm[i] = i; vals[i] = r(); }
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < N; i++) perm[i + N] = perm[i];
  const h = (x: number, y: number) => vals[perm[(perm[x & 255] + y) & 511]];
  const sm = (t: number) => t * t * (3 - 2 * t);
  const single = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = sm(x - xi), yf = sm(y - yi);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x: number, y: number, oct = 3) => {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < oct; o++) { sum += single(x * freq, y * freq) * amp; norm += amp; amp *= 0.5; freq *= 2; }
    return sum / norm;
  };
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
