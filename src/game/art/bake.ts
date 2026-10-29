// Bakes a Look into one Phaser canvas atlas. Keeping every frame in a single
// texture means an actor costs one texture bind no matter how many clips it
// has, and swapping armour just re-bakes the atlas under the same key.

import * as Phaser from 'phaser';
import { Px, upload, type Col, shade } from './raster';
import { CLIPS, type ClipName } from './anim';
import { solve, face, dirYaw, type Skel } from './rig';
import { paintSkeleton } from './paint';
import type { Look } from './look';

export const SPR_W = 76;
export const SPR_H = 64;
export const BASE_Y = 53;
export const ORIGIN_X = 0.5;
export const ORIGIN_Y = BASE_Y / SPR_H;

export interface BakeSpec {
  key: string;
  look: Look;
  clips: ClipName[];
  /** Multiplies the sprite box — bosses need the extra headroom. */
  box?: number;
  /** Bake 5 facings and mirror the rest. Halves cost; used for everything but the player. */
  mirror?: boolean;
  /** Sprite scale applied at draw time, so big bosses reuse the same box. */
  scale?: number;
  seed?: number;
}

export interface ClipInfo { n: number; fps: number; loop: boolean }

export interface Baked {
  key: string;
  clips: Set<ClipName>;
  /** Frame count / timing per clip, so beasts and humanoids share one player. */
  info: Record<string, ClipInfo>;
  mirror: boolean;
  scale: number;
  frames: Record<string, number>;
  /** Frame dimensions and the origin that puts the feet on the tile. */
  w: number;
  h: number;
  originY: number;
}

/** Clips whose support foot should stay pinned to the baseline. */
const GROUNDED = new Set<ClipName>(['idle', 'walk', 'run', 'attack1', 'attack2', 'heavy', 'block', 'blockwalk', 'cast', 'hurt']);

const baked = new Map<string, Baked>();
export const frameName = (clip: string, dir: number, f: number) => `${clip}${dir}_${f}`;

/** Resolve a (clip, dir) pair to a frame name plus whether to flip. */
export function resolve(b: Baked, clip: ClipName, dir: number, f: number) {
  let d = ((dir % 8) + 8) % 8;
  let flip = false;
  if (b.mirror && d > 4) { d = 8 - d; flip = true; }
  const c = b.clips.has(clip) ? clip : 'idle';
  const n = b.info[c]?.n ?? 1;
  return { name: frameName(c, d, ((f % n) + n) % n), flip, count: n };
}
export const clipInfo = (b: Baked, clip: string): ClipInfo =>
  b.info[clip] ?? b.info.idle ?? { n: 1, fps: 8, loop: true };

export function getBaked(key: string) { return baked.get(key); }

function renderFrames(spec: BakeSpec) {
  const dirs = spec.mirror ? 5 : 8;
  const out: { name: string; buf: Px }[] = [];
  const seed = spec.seed ?? 7;
  const k = spec.box ?? 1;
  const W = Math.ceil(SPR_W * k), H = Math.ceil(SPR_H * k), BY = Math.round(BASE_Y * k);
  for (const cn of spec.clips) {
    const clip = CLIPS[cn];
    for (let d = 0; d < dirs; d++) {
      const yaw = dirYaw(d);
      for (let f = 0; f < clip.frames.length; f++) {
        const sk: Skel = face(solve(clip.frames[f], spec.look.build), yaw);
        const px = new Px(W, H);
        paintSkeleton(px, sk, spec.look, W / 2, BY, seed + f * 13 + d * 7, { ground: GROUNDED.has(cn), yaw });
        px.topLight(0.24, 0.26);
        if (spec.look.gore) splatter(px, seed + d, spec.look.gore);
        px.outline(spec.look.ink ?? [12, 9, 14], spec.look.ghost ? 0.5 : 1);
        if (spec.look.aura) rim(px, spec.look.aura);
        if (spec.look.ghost) ghostify(px, spec.look.ghost);
        out.push({ name: frameName(cn, d, f), buf: px });
      }
    }
  }
  return out;
}

function splatter(px: Px, seed: number, amount: number) {
  let s = seed >>> 0;
  const blood: Col = [122, 20, 26];
  for (let i = 0; i < px.w * px.h * 0.04 * amount; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const x = (s >>> 8) % px.w, y = (s >>> 17) % px.h;
    if (px.alphaAt(x, y)) px.set(x, y, blood);
  }
}

function rim(px: Px, c: Col) {
  for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
    if (!px.alphaAt(x, y)) continue;
    if (!px.alphaAt(x - 1, y) || !px.alphaAt(x + 1, y) || !px.alphaAt(x, y - 1)) px.blend(x, y, c, 0.5);
  }
}

function ghostify(px: Px, k: number) {
  for (let i = 0; i < px.w * px.h; i++) {
    const a = px.d[i * 4 + 3];
    if (!a) continue;
    px.d[i * 4 + 3] = a * (1 - k * 0.55);
    // cool the palette and lift the darks so spectres glow
    px.d[i * 4] = px.d[i * 4] * (1 - k * 0.3) + 40 * k;
    px.d[i * 4 + 1] = px.d[i * 4 + 1] * (1 - k * 0.1) + 70 * k;
    px.d[i * 4 + 2] = px.d[i * 4 + 2] * (1 - k * 0.05) + 80 * k;
  }
}

/** Synchronous bake. Use for small clip sets; the player goes through the queue. */
export function bakeNow(scene: Phaser.Scene, spec: BakeSpec): Baked {
  const k = spec.box ?? 1;
  const W = Math.ceil(SPR_W * k), H = Math.ceil(SPR_H * k), BY = Math.round(BASE_Y * k);
  const frames = renderFrames(spec);
  const cols = Math.max(1, Math.floor(2048 / W));
  const rows = Math.ceil(frames.length / cols);
  if (scene.textures.exists(spec.key)) scene.textures.remove(spec.key);
  const tex = scene.textures.createCanvas(spec.key, cols * W, rows * H);
  const idx: Record<string, number> = {};
  if (tex) {
    const ctx = tex.getContext();
    frames.forEach((fr, i) => {
      const cx = (i % cols) * W, cy = Math.floor(i / cols) * H;
      const img = ctx.createImageData(W, H);
      img.data.set(fr.buf.d);
      ctx.putImageData(img, cx, cy);
      tex.add(fr.name, 0, cx, cy, W, H);
      idx[fr.name] = i;
    });
    tex.refresh();
  }
  const info: Record<string, ClipInfo> = {};
  for (const cn of spec.clips) info[cn] = { n: CLIPS[cn].frames.length, fps: CLIPS[cn].fps, loop: CLIPS[cn].loop };
  const b: Baked = {
    key: spec.key, clips: new Set(spec.clips), info, mirror: !!spec.mirror,
    scale: spec.scale ?? 1, frames: idx, w: W, h: H, originY: BY / H,
  };
  baked.set(spec.key, b);
  return b;
}

/** Write a list of rendered frames into one canvas atlas and register it. */
export function writeAtlas(scene: Phaser.Scene, key: string, frames: { name: string; buf: Px }[], W: number, H: number) {
  const cols = Math.max(1, Math.floor(2048 / W));
  const rows = Math.ceil(frames.length / cols);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, cols * W, rows * H);
  const idx: Record<string, number> = {};
  if (tex) {
    const ctx = tex.getContext();
    frames.forEach((fr, i) => {
      const cx = (i % cols) * W, cy = Math.floor(i / cols) * H;
      const img = ctx.createImageData(W, H);
      img.data.set(fr.buf.d);
      ctx.putImageData(img, cx, cy);
      tex.add(fr.name, 0, cx, cy, W, H);
      idx[fr.name] = i;
    });
    tex.refresh();
  }
  return idx;
}

export function registerBaked(b: Baked) { baked.set(b.key, b); return b; }

/** Simple drop shadow used under every actor. */
export function makeShadow(scene: Phaser.Scene) {
  const px = new Px(34, 16);
  px.ellipse(17, 8, 15, 6.5, [0, 0, 0], 0.34);
  px.ellipse(17, 8, 10, 4, [0, 0, 0], 0.22);
  upload(scene, 'shadow', px);
  const sel = new Px(66, 34);
  sel.ellipse(33, 17, 31, 15, [230, 210, 150], 0);
  for (let a = 0; a < 64; a++) {
    const t = (a / 64) * Math.PI * 2;
    sel.blend(33 + Math.cos(t) * 30, 17 + Math.sin(t) * 14.5, [235, 215, 150], 0.75);
  }
  upload(scene, 'select', sel);
  const dot = new Px(2, 2);
  dot.rect(0, 0, 2, 2, [255, 255, 255]);
  upload(scene, 'px', dot);
}

/** Flat colour swatch used for particles and overlays. */
export function makeSwatch(scene: Phaser.Scene, key: string, c: Col, w = 4, h = 4, round = false) {
  const px = new Px(w, h);
  if (round) px.ellipse(w / 2, h / 2, w / 2, h / 2, c);
  else px.rect(0, 0, w, h, c);
  upload(scene, key, px);
}

/** White radial falloff used to punch light holes in the darkness layer. */
export function makeLightMask(scene: Phaser.Scene, key = 'lightmask', r = 128) {
  const px = new Px(r * 2, r * 2);
  for (let y = 0; y < r * 2; y++) for (let x = 0; x < r * 2; x++) {
    const d = Math.hypot(x - r + 0.5, y - r + 0.5) / r;
    if (d >= 1) continue;
    // squashed vertically so the pool of light reads as lying on the ground
    px.blend(x, y, [255, 255, 255], Math.pow(1 - d, 1.9));
  }
  upload(scene, key, px);
}

/** Soft radial glow for lanterns, fire and spell light. */
export function makeGlow(scene: Phaser.Scene, key: string, c: Col, r: number) {
  const px = new Px(r * 2, r * 2);
  for (let y = 0; y < r * 2; y++) for (let x = 0; x < r * 2; x++) {
    const d = Math.hypot(x - r + 0.5, y - r + 0.5) / r;
    if (d >= 1) continue;
    px.blend(x, y, c, Math.pow(1 - d, 2.4));
  }
  upload(scene, key, px);
}

// ------------------------------------------------------- progressive queue

interface Job { spec: BakeSpec; onDone?: (b: Baked) => void }
const queue: Job[] = [];
let working: { spec: BakeSpec; frames: { name: string; buf: Px }[]; onDone?: (b: Baked) => void } | null = null;

export function bakeQueued(scene: Phaser.Scene, spec: BakeSpec, onDone?: (b: Baked) => void) {
  // Drop any pending job for the same key — only the newest look matters.
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].spec.key === spec.key) queue.splice(i, 1);
  queue.push({ spec, onDone });
}

/** Call once per frame. Spends at most `budgetMs` rasterising so there is no hitch. */
export function pumpBake(scene: Phaser.Scene, budgetMs = 6) {
  const t0 = performance.now();
  while (performance.now() - t0 < budgetMs) {
    if (!working) {
      const job = queue.shift();
      if (!job) return queue.length === 0 && !working;
      working = { spec: job.spec, frames: [], onDone: job.onDone };
      working.frames = renderFrames(job.spec); // one clip set at a time is fast enough
      const b = bakeNow(scene, working.spec);
      working.onDone?.(b);
      working = null;
      continue;
    }
  }
  return false;
}
export const bakePending = () => queue.length;

export function clearBaked(scene: Phaser.Scene) {
  for (const k of baked.keys()) if (scene.textures.exists(k)) scene.textures.remove(k);
  baked.clear();
  queue.length = 0;
  working = null;
}

export { shade };
