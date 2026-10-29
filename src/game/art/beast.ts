// Quadruped rig. Same principle as the humanoid: one pose authored in local 3D,
// rotated to the facing yaw and projected — so a deer's legs move in the
// direction it is actually travelling, in all eight facings.

import { Px, shade, mix, type Col } from './raster';
import { limbDir, project, rotY, type V3, add, scale, norm, type P2 } from './rig';

export interface BeastBuild {
  /** Overall scale. */
  h: number;
  /** Shoulder-to-hip length. */
  body: number;
  /** Ground-to-belly height. */
  legLen: number;
  /** Body thickness. */
  girth: number;
  neck: number;
  head: number;
  tail: number;
  /** Antler/horn branch count, 0 = none. */
  horn: number;
  /** Ear length. */
  ear: number;
  /** Shaggy mane across the shoulders. */
  mane: number;
}

export const DEER: BeastBuild = { h: 1, body: 24, legLen: 12.5, girth: 5.4, neck: 8, head: 5.2, tail: 4, horn: 2, ear: 3.2, mane: 0 };
export const WOLF: BeastBuild = { h: 0.96, body: 25, legLen: 10.5, girth: 5.4, neck: 7, head: 4.8, tail: 9, horn: 0, ear: 3, mane: 1.5 };
export const BOAR: BeastBuild = { h: 0.94, body: 22, legLen: 8.5, girth: 7.2, neck: 4.5, head: 5.0, tail: 3, horn: 0, ear: 2.2, mane: 2.4 };
export const HOUND: BeastBuild = { h: 1.0, body: 26, legLen: 11, girth: 4.8, neck: 6.5, head: 4.6, tail: 7, horn: 0, ear: 3.6, mane: 1.8 };

export interface BeastPose {
  /** Four leg swings: FL, FR, BL, BR. */
  swing: [number, number, number, number];
  knee: [number, number, number, number];
  bob: number;
  /** Spine pitch: positive lowers the head. */
  pitch: number;
  neckPitch: number;
  headPitch: number;
  tailPitch: number;
  tailWag: number;
  /** Whole body roll, for death. */
  roll: number;
  lift: number;
  /** Mouth open 0..1 for bite frames. */
  jaw: number;
}

const rest: BeastPose = {
  swing: [0, 0, 0, 0], knee: [0.15, 0.15, 0.15, 0.15], bob: 0,
  pitch: 0, neckPitch: 0.76, headPitch: -0.5, tailPitch: 0.5, tailWag: 0, roll: 0, lift: 0, jaw: 0,
};
export const bpose = (o: Partial<BeastPose>): BeastPose => ({ ...rest, ...o, swing: o.swing ?? [...rest.swing], knee: o.knee ?? [...rest.knee] });

export interface BeastSkel {
  hip: V3; shoulder: V3; neck: V3; head: V3; nose: V3; tailA: V3; tailB: V3;
  legs: { hip: V3; knee: V3; foot: V3 }[];
  ears: [V3, V3];
  horns: V3[][];
  roll: number;
  jaw: number;
}

export function solveBeast(p: BeastPose, b: BeastBuild): BeastSkel {
  const H = b.h;
  const upper = b.legLen * 0.5 * H, lower = b.legLen * 0.5 * H;
  const z = b.legLen * H + p.bob * H + p.lift * H;
  const halfL = (b.body * H) / 2;
  const halfW = b.girth * 0.62 * H;

  const spin = (v: V3) => {
    const c = Math.cos(p.pitch), s = Math.sin(p.pitch);
    return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
  };
  const hip = spin({ x: 0, y: -halfL, z });
  const shoulder = spin({ x: 0, y: halfL, z });

  // legs: front pair at the shoulder, back pair at the hip
  const anchors: V3[] = [
    add(shoulder, { x: -halfW, y: 0, z: 0 }), add(shoulder, { x: halfW, y: 0, z: 0 }),
    add(hip, { x: -halfW, y: 0, z: 0 }), add(hip, { x: halfW, y: 0, z: 0 }),
  ];
  const legs = anchors.map((a, i) => {
    const d1 = limbDir(p.swing[i], 0);
    const knee = add(a, scale(d1, upper));
    // front legs bend backwards, hind legs forwards — that is what makes a
    // quadruped gait read as an animal rather than a table walking
    const back = i >= 2 ? 1 : -1;
    const d2 = limbDir(p.swing[i] + p.knee[i] * back, 0);
    return { hip: a, knee, foot: add(knee, scale(d2, lower)) };
  });

  // Neck and tail use an elevation convention: 0 = horizontal, +PI/2 = straight
  // up, measured from the animal's own forward (+Y) / rearward (-Y) axis.
  const fwd = (elev: number, yaw = 0): V3 => ({ x: Math.sin(yaw) * Math.cos(elev), y: Math.cos(elev) * Math.cos(yaw), z: Math.sin(elev) });
  const back = (elev: number, yaw = 0): V3 => ({ x: Math.sin(yaw) * Math.cos(elev), y: -Math.cos(elev) * Math.cos(yaw), z: Math.sin(elev) });

  const nd = fwd(p.neckPitch);
  const neck = add(shoulder, scale(nd, b.neck * H));
  const hd = fwd(p.neckPitch + p.headPitch);
  const head = add(neck, scale(hd, b.head * 0.7 * H));
  const nose = add(head, scale(hd, b.head * 1.0 * H));

  const td = back(p.tailPitch, p.tailWag);
  const tailA = add(hip, scale(td, b.tail * 0.6 * H));
  const tailB = add(tailA, scale(back(p.tailPitch - 0.6, p.tailWag * 1.6), b.tail * 0.6 * H));

  const ears: [V3, V3] = [
    add(head, { x: -b.head * 0.55 * H, y: 0, z: b.ear * H }),
    add(head, { x: b.head * 0.55 * H, y: 0, z: b.ear * H }),
  ];

  const horns: V3[][] = [];
  if (b.horn > 0) {
    for (const side of [-1, 1]) {
      const pts: V3[] = [add(head, { x: side * b.head * 0.36 * H, y: 0, z: b.head * 0.56 * H })];
      let cur = pts[0];
      for (let k = 0; k < b.horn; k++) {
        cur = add(cur, { x: side * (2.2 - k * 0.3) * H, y: 0.8 * H, z: (2.8 - k * 0.5) * H });
        pts.push(cur);
      }
      horns.push(pts);
    }
  }
  return { hip, shoulder, neck, head, nose, tailA, tailB, legs, ears, horns, roll: p.roll, jaw: p.jaw };
}

export function faceBeast(s: BeastSkel, yaw: number): BeastSkel {
  const r = (v: V3) => rotY(v, yaw);
  return {
    hip: r(s.hip), shoulder: r(s.shoulder), neck: r(s.neck), head: r(s.head), nose: r(s.nose),
    tailA: r(s.tailA), tailB: r(s.tailB),
    legs: s.legs.map(l => ({ hip: r(l.hip), knee: r(l.knee), foot: r(l.foot) })),
    ears: [r(s.ears[0]), r(s.ears[1])],
    horns: s.horns.map(h => h.map(r)),
    roll: s.roll, jaw: s.jaw,
  };
}

export interface BeastLook {
  build: BeastBuild;
  coat: Col;
  belly: Col;
  /** Mane / ruff colour. */
  ruff?: Col;
  horn: Col;
  eye: Col;
  /** Spots / stripes / patches. */
  marks?: Col;
  aura?: Col;
  ghost?: number;
  ink?: Col;
  gore?: number;
}

function limb(px: Px, a: P2, b: P2, r0: number, r1: number, c: Col, rim?: Col) {
  if (rim) px.capsule(a.x, a.y, b.x, b.y, r0 + 0.8, r1 + 0.8, rim);
  px.capsule(a.x, a.y, b.x, b.y, r0, r1, shade(c, 0.76));
  px.capsule(a.x - 0.5, a.y - 0.6, b.x - 0.5, b.y - 0.6, r0 * 0.76, r1 * 0.76, c);
}

export function paintBeast(px: Px, s: BeastSkel, look: BeastLook, ox: number, oy: number, opts: { ground?: boolean; yaw?: number } = {}) {
  const b = look.build;
  const H = b.h;
  let yy = oy;
  if (opts.ground !== false) {
    let low = -Infinity;
    for (const l of s.legs) low = Math.max(low, project(l.foot, 0, 0, s.roll).y);
    yy -= low + 1;
  }
  const P = (v: V3) => project(v, ox, yy, s.roll);
  const rim: Col = look.ink ?? [12, 9, 14];
  const coat = look.coat, belly = look.belly;

  type Cmd = { d: number; run: () => void };
  const cmds: Cmd[] = [];
  const push = (d: number, run: () => void) => cmds.push({ d, run });

  // far legs first, near legs last, body between — sorted by depth
  s.legs.forEach((l, i) => {
    const h = P(l.hip), k = P(l.knee), f = P(l.foot);
    push((l.hip.y + l.foot.y) / 2, () => {
      limb(px, h, k, 2.1 * H, 1.7 * H, coat, rim);
      limb(px, k, f, 1.7 * H, 1.2 * H, coat, rim);
      px.ellipse(f.x, f.y + 0.4, 1.9 * H, 1.3 * H, shade(coat, 0.5));
      void i;
    });
  });

  push(s.hip.y * 0.5 + s.shoulder.y * 0.5, () => {
    const hp = P(s.hip), sh = P(s.shoulder);
    px.capsule(hp.x, hp.y, sh.x, sh.y, b.girth * H, b.girth * 0.92 * H, shade(coat, 0.78));
    px.capsule(hp.x - 0.6, hp.y - 1, sh.x - 0.6, sh.y - 1, b.girth * 0.82 * H, b.girth * 0.76 * H, coat);
    px.capsule(hp.x, hp.y + b.girth * 0.45 * H, sh.x, sh.y + b.girth * 0.45 * H, b.girth * 0.42 * H, b.girth * 0.4 * H, belly);
    if (look.marks) {
      let r = 1337;
      for (let i = 0; i < 5; i++) {
        r = (r * 1103515245 + 12345) & 0x7fffffff;
        const t = (r % 100) / 100;
        px.ellipseOver(hp.x + (sh.x - hp.x) * t, hp.y + (sh.y - hp.y) * t + 1 + ((r >> 9) % 3), 1.3, 1.0, look.marks, 0.55);
      }
    }
    if (b.mane > 0 && look.ruff) {
      px.capsule(sh.x - 1, sh.y - b.girth * 0.5 * H, sh.x + 1, sh.y - b.girth * 0.5 * H, b.mane * 1.8 * H, b.mane * 1.4 * H, look.ruff);
    }
  });

  push(s.tailA.y - 1, () => {
    const a = P(s.hip), t1 = P(s.tailA), t2 = P(s.tailB);
    limb(px, a, t1, 1.6 * H, 1.2 * H, coat, rim);
    limb(px, t1, t2, 1.2 * H, 0.7 * H, look.ruff ?? coat);
  });

  push(s.head.y + 1, () => {
    const sh = P(s.shoulder), nk = P(s.neck), hd = P(s.head), no = P(s.nose);
    const head = s.head;
    limb(px, sh, nk, b.girth * 0.72 * H, 2.4 * H, coat, rim);
    if (b.mane > 0 && look.ruff) px.capsule(sh.x, sh.y, nk.x, nk.y, b.girth * 0.8 * H, 2.8 * H, look.ruff, 0.75);
    limb(px, nk, hd, 2.4 * H, 2.2 * H, coat, rim);
    // skull + muzzle
    px.capsule(hd.x, hd.y, no.x, no.y, b.head * 0.56 * H, b.head * 0.34 * H, shade(coat, 0.84));
    px.capsule(hd.x - 0.5, hd.y - 0.6, no.x - 0.5, no.y - 0.6, b.head * 0.46 * H, b.head * 0.26 * H, coat);
    px.ellipse(no.x, no.y, b.head * 0.3 * H, b.head * 0.26 * H, shade(coat, 0.45));
    if (s.jaw > 0) {
      px.capsule(hd.x, hd.y + 1.4, no.x, no.y + 2.6 * s.jaw, b.head * 0.3 * H, b.head * 0.2 * H, [52, 24, 26]);
      for (let k = -1; k <= 1; k += 2) px.capsule(no.x + k * 1.2, no.y + 0.4, no.x + k * 1.2, no.y + 2.0 * s.jaw, 0.7, 0.3, [226, 222, 206]);
    }
    const ex = P(s.ears[0]), ey = P(s.ears[1]);
    limb(px, hd, ex, 1.5 * H, 0.5 * H, shade(coat, 0.9));
    limb(px, hd, ey, 1.5 * H, 0.5 * H, shade(coat, 0.9));
    // eyes
    const half = (no.x - hd.x) * 0.3, lift = (no.y - hd.y) * 0.25;
    px.rect(hd.x + half - 1.6, hd.y + lift - 0.6, 1.4, 1.4, look.eye);
    px.rect(hd.x + half + 0.6, hd.y + lift - 0.6, 1.4, 1.4, look.eye);
    for (const horn of s.horns) {
      for (let i = 0; i < horn.length - 1; i++) {
        const a = P(horn[i]), c2 = P(horn[i + 1]);
        px.capsule(a.x, a.y, c2.x, c2.y, 1.9 - i * 0.35, 1.5 - i * 0.32, shade(look.horn, 0.75));
        px.capsule(a.x - 0.5, a.y - 0.6, c2.x - 0.5, c2.y - 0.6, 1.3 - i * 0.3, 1.0 - i * 0.26, look.horn);
        // tine off the back of each fork
        const tine = P(add(horn[i], { x: (horn[i].x - head.x) * 0.45, y: 1.2 * H, z: 3.0 * H - i * 0.6 * H }));
        px.capsule(a.x, a.y, tine.x, tine.y, 1.2, 0.4, look.horn);
      }
    }
  });

  cmds.sort((a, c) => a.d - c.d);
  for (const c of cmds) c.run();
  void mix; void norm;
}

// ------------------------------------------------------------------ clips
const TAU = Math.PI * 2;

/** Diagonal-pair gait: front-left moves with back-right. */
function beastGait(n: number, amp: number, bob: number, knee: number, pitch: number): BeastPose[] {
  const out: BeastPose[] = [];
  for (let i = 0; i < n; i++) {
    const ph = (i / n) * TAU;
    const sw = (o: number) => Math.sin(ph + o) * amp;
    const kn = (o: number) => 0.12 + Math.max(0, -Math.cos(ph + o - 0.5)) * knee;
    out.push(bpose({
      swing: [sw(0), sw(Math.PI), sw(Math.PI), sw(0)],
      knee: [kn(0), kn(Math.PI), kn(Math.PI), kn(0)],
      bob: -Math.abs(Math.cos(ph * 2)) * bob,
      pitch,
      neckPitch: 0.76 + Math.sin(ph * 2) * 0.06,
      headPitch: -0.5,
      tailPitch: 0.55, tailWag: Math.sin(ph) * 0.4,
    }));
  }
  return out;
}

function beastIdle(n: number): BeastPose[] {
  const out: BeastPose[] = [];
  for (let i = 0; i < n; i++) {
    const ph = (i / n) * TAU;
    out.push(bpose({
      swing: [0.04, -0.04, -0.03, 0.03],
      bob: Math.sin(ph) * 0.2,
      neckPitch: 0.76 + Math.sin(ph) * 0.05,
      headPitch: -0.5 - Math.sin(ph * 0.5) * 0.2,
      tailPitch: 0.55, tailWag: Math.sin(ph) * 0.5,
    }));
  }
  return out;
}

function beastBite(): BeastPose[] {
  return [
    bpose({ swing: [-0.4, -0.35, 0.3, 0.35], knee: [0.5, 0.5, 0.4, 0.4], bob: -1.2, pitch: -0.18, neckPitch: 1.25, headPitch: -0.5, jaw: 0.3 }),
    bpose({ swing: [-0.6, -0.55, 0.45, 0.5], knee: [0.7, 0.7, 0.5, 0.5], bob: -2.0, pitch: -0.3, neckPitch: 1.4, headPitch: -0.55, jaw: 0.7 }),
    bpose({ swing: [0.7, 0.65, -0.4, -0.45], knee: [0.15, 0.15, 0.7, 0.7], bob: 0.6, pitch: 0.22, neckPitch: 0.45, headPitch: -0.5, jaw: 1 }),
    bpose({ swing: [0.9, 0.85, -0.55, -0.6], knee: [0.1, 0.1, 0.8, 0.8], bob: 0.9, pitch: 0.34, neckPitch: 0.25, headPitch: -0.4, jaw: 1 }),
    bpose({ swing: [0.5, 0.45, -0.3, -0.35], knee: [0.15, 0.15, 0.5, 0.5], bob: 0.3, pitch: 0.16, neckPitch: 0.7, headPitch: -0.55, jaw: 0.5 }),
    bpose({ swing: [0.1, 0.1, -0.05, -0.05], bob: 0, pitch: 0, neckPitch: 0.95, headPitch: -0.6, jaw: 0 }),
  ];
}

function beastPounce(): BeastPose[] {
  const out: BeastPose[] = [];
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const air = Math.sin(t * Math.PI);
    out.push(bpose({
      swing: [-0.9 + air * 1.5, -0.85 + air * 1.5, 0.8 - air * 1.4, 0.85 - air * 1.4],
      knee: [0.7 - air * 0.5, 0.7 - air * 0.5, 0.8 - air * 0.6, 0.8 - air * 0.6],
      bob: -1.5 + air * 1.2, lift: air * 5.5,
      pitch: -0.3 + t * 0.5, neckPitch: 1.2 - t * 0.6, headPitch: -0.45,
      tailPitch: 0.9, jaw: air,
    }));
  }
  return out;
}

function beastHurt(): BeastPose[] {
  return [
    bpose({ swing: [-0.5, -0.4, -0.2, -0.3], knee: [0.6, 0.6, 0.5, 0.5], bob: -1.6, pitch: -0.3, neckPitch: 1.35, headPitch: -0.25 }),
    bpose({ swing: [-0.25, -0.2, -0.1, -0.15], knee: [0.4, 0.4, 0.35, 0.35], bob: -0.8, pitch: -0.15, neckPitch: 1.15, headPitch: -0.4 }),
    bpose({ bob: -0.2, neckPitch: 0.95, headPitch: -0.6 }),
  ];
}

function beastDeath(): BeastPose[] {
  const out: BeastPose[] = [];
  for (let i = 0; i < 8; i++) {
    const t = Math.pow(i / 7, 0.8);
    out.push(bpose({
      swing: [-0.6 * t - 0.1, -0.8 * t, 0.7 * t, 0.5 * t],
      knee: [1.1 * t, 1.3 * t, 1.0 * t, 1.2 * t],
      bob: -t * 9, roll: t * 1.2,
      pitch: -0.2 + t * 0.5, neckPitch: 0.95 - t * 1.5, headPitch: -0.6 + t * 0.5,
      tailPitch: 0.5 - t * 0.9,
    }));
  }
  return out;
}

export const BEAST_CLIPS = {
  idle: { frames: beastIdle(6), fps: 6, loop: true },
  walk: { frames: beastGait(8, 0.52, 0.7, 0.9, 0.02), fps: 11, loop: true },
  run: { frames: beastGait(8, 0.92, 1.5, 1.5, -0.12), fps: 16, loop: true },
  attack1: { frames: beastBite(), fps: 15, loop: false },
  heavy: { frames: beastPounce(), fps: 15, loop: false },
  hurt: { frames: beastHurt(), fps: 14, loop: false },
  death: { frames: beastDeath(), fps: 11, loop: false },
} as const;
export type BeastClipName = keyof typeof BEAST_CLIPS;
