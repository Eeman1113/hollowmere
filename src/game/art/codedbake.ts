// Adapter: turns a ChatGPT-derived CodedSprite into the same `Baked` atlas shape
// the rest of the game already drives, so coded sheets and procedural rigs are
// interchangeable to the Actor class.
//
// A three-view sheet (front / back / side) is expanded to the eight isometric
// facings the game uses. Side views are drawn facing right, so the three
// leftward facings reuse them flipped.

import * as Phaser from 'phaser';
import { Px } from './raster';
import { frameName, registerBaked, writeAtlas, type Baked, type ClipInfo } from './bake';
import type { ClipName } from './anim';
import { ALPHABET, type CodedSprite } from '../sprites/types';

/** dir -> which row of the sheet to use, and whether to mirror it. */
export const DIR_VIEW: { view: string; flip: boolean }[] = [
  { view: 'front', flip: false }, // 0  toward the camera
  { view: 'side', flip: true },   // 1  down-left
  { view: 'side', flip: true },   // 2  left
  { view: 'side', flip: true },   // 3  up-left
  { view: 'back', flip: false },  // 4  away from the camera
  { view: 'side', flip: false },  // 5  up-right
  { view: 'side', flip: false },  // 6  right
  { view: 'side', flip: false },  // 7  down-right
];

/**
 * How each animation clip is played from a walk sheet. `from` names the sheet
 * row set; `seq` indexes into that row's frames.
 */
export interface ClipMap { seq: number[]; fps: number; loop: boolean; row?: string }

export const DEFAULT_CLIPS: Partial<Record<ClipName, ClipMap>> = {
  idle: { seq: [0], fps: 2, loop: true },
  walk: { seq: [0, 1, 2, 3], fps: 8, loop: true },
  run: { seq: [0, 1, 2, 3], fps: 13, loop: true },
  block: { seq: [0], fps: 2, loop: true },
  blockwalk: { seq: [0, 1, 2, 3], fps: 7, loop: true },
  rest: { seq: [0], fps: 2, loop: true },
  cast: { seq: [0, 1], fps: 6, loop: false },
  // Without dedicated art, a swing is read as a fast partial step. Replaced by
  // a real attack row whenever the sheet provides one.
  attack1: { seq: [1, 2, 0], fps: 12, loop: false },
  attack2: { seq: [3, 2, 0], fps: 12, loop: false },
  heavy: { seq: [1, 2, 3, 0], fps: 9, loop: false },
  hurt: { seq: [0], fps: 6, loop: false },
  death: { seq: [0], fps: 4, loop: false },
};

const hexToRgb = (h: string): [number, number, number] => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Paint one indexed frame string into a pixel buffer. */
function decode(s: CodedSprite, data: string, flip: boolean): Px {
  const px = new Px(s.w, s.h);
  const pal = s.palette.map(hexToRgb);
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      const ch = data[y * s.w + x];
      if (ch === '.' || ch === undefined) continue;
      const c = pal[ALPHABET.indexOf(ch)];
      if (!c) continue;
      px.set(flip ? s.w - 1 - x : x, y, c);
    }
  }
  return px;
}

export interface CodedSpec {
  key: string;
  sprite: CodedSprite;
  clips?: Partial<Record<ClipName, ClipMap>>;
  scale?: number;
  /** Fraction of the frame height that sits on the tile. 1 = feet at the bottom. */
  footY?: number;
}

export function bakeCoded(scene: Phaser.Scene, spec: CodedSpec): Baked {
  const s = spec.sprite;
  const clips: Partial<Record<ClipName, ClipMap>> = { ...DEFAULT_CLIPS };
  // A sheet that drew a dedicated attack row gets to use it. The row is a side
  // view, which is what every facing uses here — the same compromise every
  // three-view sheet makes, and far better than reading a swing as a footstep.
  const atk = s.frames.attack;
  if (atk?.length) {
    const n = atk.length;
    clips.attack1 = { seq: Array.from({ length: n }, (_, i) => i), fps: 11, loop: false, row: 'attack' };
    clips.attack2 = { seq: Array.from({ length: n }, (_, i) => n - 1 - i), fps: 11, loop: false, row: 'attack' };
    clips.heavy = { seq: Array.from({ length: n }, (_, i) => i), fps: 7, loop: false, row: 'attack' };
  }
  if (s.frames.death?.length) {
    clips.death = { seq: s.frames.death.map((_, i) => i), fps: 8, loop: false, row: 'death' };
  }
  Object.assign(clips, spec.clips ?? {});
  const frames: { name: string; buf: Px }[] = [];
  const info: Record<string, ClipInfo> = {};
  // decode each (view, frame, flip) once, then reference it per clip
  const cache = new Map<string, Px>();
  const get = (view: string, idx: number, flip: boolean) => {
    const rows = s.frames[view] ?? s.frames.side ?? s.frames.front ?? [];
    const data = rows[idx % Math.max(1, rows.length)];
    const k = `${view}${idx}${flip ? 'f' : ''}`;
    let px = cache.get(k);
    if (!px) { px = data ? decode(s, data, flip) : new Px(s.w, s.h); cache.set(k, px); }
    return px;
  };

  for (const [cn, map] of Object.entries(clips) as [ClipName, ClipMap][]) {
    info[cn] = { n: map.seq.length, fps: map.fps, loop: map.loop };
    for (let d = 0; d < 8; d++) {
      const { view, flip } = DIR_VIEW[d];
      // an explicit row (attack, death) overrides the per-direction view
      const row = map.row && s.frames[map.row] ? map.row : view;
      map.seq.forEach((idx, f) => {
        frames.push({ name: frameName(cn, d, f), buf: get(row, idx, flip) });
      });
    }
  }
  const idx = writeAtlas(scene, spec.key, frames, s.w, s.h);
  return registerBaked({
    key: spec.key,
    clips: new Set(Object.keys(clips) as ClipName[]),
    info,
    mirror: false,
    scale: spec.scale ?? 1,
    frames: idx,
    w: s.w,
    h: s.h,
    originY: spec.footY ?? 1,
  });
}
