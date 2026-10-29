// Every world object, drawn procedurally. Kept free of Phaser imports so the
// preview script can render a contact sheet outside the browser.
// Every world object, drawn procedurally. The architecture set is the one that
// carries the Elden Ring / Bloodborne register: tall stone, pointed arches,
// iron, candles and hanging things.

import { Px, shade, mix, type Col } from './raster';
import { diamond, prism, cone, gable, lancet, crenel, TW, TH, UNIT } from './iso';
import { P } from './palette';
import { O } from '../world/types';
import type { Rng } from '../core';

const BOX_W = 80;

/**
 * Natural height of a prop in wall-units. A structure can stamp a taller value;
 * anything stamped at the default of 1 falls back to the natural height here,
 * so a cathedral pillar is a pillar and not a stump.
 */
export const HEIGHT_UNITS: Partial<Record<number, number>> = {
  [O.WALL]: 3, [O.WALL_WINDOW]: 3, [O.WALL_ARCH]: 3, [O.WALL_RUIN]: 2, [O.BUTTRESS]: 3,
  [O.PILLAR]: 4, [O.PILLAR_BROKEN]: 2, [O.SPIRE]: 8, [O.ARCH]: 5, [O.BATTLEMENT]: 3,
  [O.GATE]: 4, [O.STATUE_SAINT]: 3, [O.STATUE_BEAST]: 2, [O.GARGOYLE]: 2, [O.TOMB]: 2,
  [O.LAMP_POST]: 3, [O.GIBBET]: 4, [O.BELL]: 4, [O.BANNER]: 3, [O.CHANDELIER]: 5, [O.PYRE]: 2,
  [O.TREE_DEAD]: 4, [O.TREE_PALE]: 5, [O.TREE_PINE]: 5, [O.TREE_ROT]: 4, [O.CRAG]: 4,
  [O.BOULDER]: 2, [O.CRYSTAL]: 2, [O.BOOKSHELF]: 2, [O.WHEEL]: 3, [O.LADDER]: 3,
  [O.FOG_WALL]: 3, [O.BRIDGE_RAIL]: 1, [O.OSSUARY]: 2, [O.CANDLE_RACK]: 2, [O.IRON_FENCE]: 1,
  [O.BOARD]: 2,
};

export const unitsFor = (o: number, h: number) => (h > 1 ? h : HEIGHT_UNITS[o] ?? 1);

export const boxFor = (o: number, h: number) => {
  const units = unitsFor(o, h);
  return { w: BOX_W, h: Math.ceil(TH * 1.6 + units * UNIT + 16) };
};

export interface Ctx { px: Px; cx: number; by: number; r: Rng; v: number; h: number }

// ---------------------------------------------------------------- helpers
const mortar = (px: Px, cx: number, baseY: number, hPx: number, c: Col) => {
  for (let k = UNIT * 0.5; k < hPx; k += UNIT * 0.5) {
    px.line(cx - TW / 2, baseY - TH / 2 - k, cx, baseY - k, shade(c, 0.72));
    px.line(cx + TW / 2, baseY - TH / 2 - k, cx, baseY - k, shade(c, 0.72));
  }
  px.line(cx, baseY, cx, baseY - hPx, shade(c, 0.6));
};

export const grime = (px: Px, seed: number) => px.grain(seed, 0.09);

/** Props that must not get a hard ink outline — anything hazy or emissive. */
export const NO_OUTLINE = new Set<number>([O.FOG_WALL, O.SHARD]);

function trunk(px: Px, cx: number, by: number, hPx: number, c: Col, w: number, lean: number) {
  px.capsule(cx, by, cx + lean, by - hPx, w, w * 0.55, shade(c, 0.74));
  px.capsule(cx - 0.8, by - 1, cx + lean - 0.8, by - hPx, w * 0.72, w * 0.4, c);
  px.capsule(cx - 1.6, by - 2, cx + lean - 1.6, by - hPx, w * 0.3, w * 0.16, shade(c, 1.2));
}

function branches(px: Px, cx: number, ty: number, n: number, len: number, c: Col, r: Rng, depth = 2, a0 = -Math.PI / 2) {
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / Math.max(1, n - 1) - 0.5) * 2.0 + (r() - 0.5) * 0.4;
    const l = len * (0.6 + r() * 0.6);
    const ex = cx + Math.cos(a) * l, ey = ty + Math.sin(a) * l * 0.8;
    px.capsule(cx, ty, ex, ey, 2.4, 0.7, c);
    if (depth > 0) branches(px, ex, ey, 2, l * 0.55, shade(c, 0.95), r, depth - 1, a);
  }
}

function foliage(px: Px, cx: number, cy: number, rx: number, ry: number, c: Col, r: Rng, blobs = 7) {
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx * 0.55 + (r() - 0.5) * 4;
    const y = cy + Math.sin(a) * ry * 0.55 + (r() - 0.5) * 3;
    px.ellipse(x, y, rx * 0.52, ry * 0.52, shade(c, 0.82 + r() * 0.3));
  }
  px.ellipse(cx, cy, rx * 0.6, ry * 0.6, c);
  px.ellipse(cx - rx * 0.2, cy - ry * 0.28, rx * 0.4, ry * 0.32, shade(c, 1.18));
}

function flameSprite(px: Px, x: number, y: number, s: number, warm: Col = P.flame) {
  px.ellipse(x, y, 3.4 * s, 5 * s, shade(warm, 0.8), 0.55);
  px.ellipse(x, y - 1 * s, 2.3 * s, 3.6 * s, warm, 0.9);
  px.ellipse(x, y - 2 * s, 1.3 * s, 2 * s, P.flameLit);
}

// ---------------------------------------------------------------- the props
export function paintProp(o: number, c: Ctx) {
  const { px, cx, by, r, v } = c;
  const units = unitsFor(o, c.h);
  const stone = mix(P.granite, P.stoneLit, v * 0.14);
  const wood = mix(P.wood, P.woodLit, v * 0.12);

  switch (o) {
    // ---------------------------------------------------- architecture
    case O.WALL: {
      const hPx = units * UNIT;
      prism(px, cx, by, hPx, stone);
      mortar(px, cx, by, hPx, stone);
      if (v === 3) for (let i = 0; i < 6; i++) px.blend(cx + (r() - 0.5) * TW * 0.8, by - r() * hPx, P.moss, 0.4);
      break;
    }
    case O.WALL_WINDOW: {
      const hPx = units * UNIT;
      prism(px, cx, by, hPx, stone);
      mortar(px, cx, by, hPx, stone);
      const glass: Col = [[86, 48, 54], [48, 60, 84], [84, 72, 42], [52, 72, 58]][v] as Col;
      lancet(px, cx - TW / 4, by - TH / 4 - hPx * 0.35, 13, hPx * 0.52, shade(stone, 0.34), glass);
      lancet(px, cx + TW / 4, by - TH / 4 - hPx * 0.35, 13, hPx * 0.52, shade(stone, 0.38), shade(glass, 1.12));
      break;
    }
    case O.WALL_RUIN: {
      const hPx = units * UNIT * (0.5 + r() * 0.4);
      prism(px, cx, by, hPx, shade(stone, 0.92));
      mortar(px, cx, by, hPx, stone);
      // chew the top edge away
      for (let i = 0; i < 26; i++) {
        const x = cx + (r() - 0.5) * TW, y = by - hPx - TH / 2 + (r() - 0.5) * 8;
        px.ellipse(x, y, 3 + r() * 3, 2 + r() * 2, [0, 0, 0], 0);
      }
      for (let i = 0; i < 40; i++) {
        const x = cx + (r() - 0.5) * TW * 0.9;
        const y = by - hPx - TH / 2 + Math.abs(x - cx) * 0.25 + (r() - 0.5) * 6;
        px.set(x, y, shade(stone, 1.1));
      }
      break;
    }
    case O.WALL_ARCH: {
      const hPx = units * UNIT;
      prism(px, cx, by, hPx, stone);
      mortar(px, cx, by, hPx, stone);
      // a doorway punched straight through the wall
      lancet(px, cx, by - TH / 2 + 2, 24, hPx * 0.68, [10, 9, 12]);
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        px.ellipse(cx - 12 + 24 * t, by - TH / 2 + 2 - hPx * 0.374 - Math.sin(t * Math.PI) * hPx * 0.3, 2.4, 2.2, shade(stone, 1.08));
      }
      break;
    }
    case O.BATTLEMENT: {
      const hPx = units * UNIT;
      prism(px, cx, by, hPx, stone);
      mortar(px, cx, by, hPx, stone);
      crenel(px, cx, by - hPx - TH / 2 + 2, TW * 0.9, shade(stone, 1.1));
      break;
    }
    case O.BUTTRESS: {
      const hPx = units * UNIT;
      prism(px, cx, by, hPx * 0.8, shade(stone, 0.96), TW * 0.5, TH * 0.5);
      // the flying arm
      px.poly([
        { x: cx - 2, y: by - hPx },
        { x: cx + TW * 0.34, y: by - hPx * 0.42 },
        { x: cx + TW * 0.34, y: by - hPx * 0.3 },
        { x: cx - 2, y: by - hPx * 0.78 },
      ], shade(stone, 0.82));
      cone(px, cx, by - hPx * 0.8 - TH / 4, 16, TW * 0.4, shade(stone, 1.05));
      break;
    }
    case O.PILLAR: {
      const hPx = units * UNIT;
      prism(px, cx, by, 6, shade(stone, 0.9), TW * 0.56, TH * 0.56);     // base
      prism(px, cx, by - 6, hPx - 12, stone, TW * 0.38, TH * 0.38);      // shaft
      for (let k = 0; k < 4; k++) px.line(cx - 9 + k * 6, by - 8, cx - 9 + k * 6, by - hPx + 12, shade(stone, 0.74));
      prism(px, cx, by - hPx + 6, 7, shade(stone, 1.06), TW * 0.52, TH * 0.52); // capital
      break;
    }
    case O.PILLAR_BROKEN: {
      const hPx = units * UNIT * (0.35 + r() * 0.4);
      prism(px, cx, by, 6, shade(stone, 0.9), TW * 0.56, TH * 0.56);
      prism(px, cx, by - 6, hPx, shade(stone, 0.95), TW * 0.38, TH * 0.38);
      for (let i = 0; i < 16; i++) px.set(cx + (r() - 0.5) * TW * 0.36, by - 6 - hPx - TH * 0.19 + (r() - 0.5) * 5, shade(stone, 1.15));
      for (let i = 0; i < 5; i++) px.ellipse(cx + (r() - 0.5) * TW * 0.7, by - 2 - r() * 4, 3.5, 2.2, shade(stone, 0.86));
      break;
    }
    case O.SPIRE: {
      const hPx = units * UNIT;
      prism(px, cx, by, hPx * 0.72, stone, TW * 0.6, TH * 0.6);
      mortar(px, cx, by, hPx * 0.72, stone);
      for (let k = 1; k <= 2; k++) lancet(px, cx - TW * 0.14, by - TH * 0.18 - hPx * 0.2 * k - 6, 8, 13, shade(stone, 0.35), [80, 70, 110]);
      prism(px, cx, by - hPx * 0.72, 8, shade(stone, 1.1), TW * 0.68, TH * 0.68);
      cone(px, cx, by - hPx * 0.72 - 8 - TH * 0.34, hPx * 0.42, TW * 0.6, shade(P.slate, 0.95));
      px.capsule(cx, by - hPx - 4, cx, by - hPx - 12, 1.1, 0.5, P.ironDark);
      px.capsule(cx - 3, by - hPx - 9, cx + 3, by - hPx - 9, 0.9, 0.9, P.ironDark);
      break;
    }
    case O.ARCH: {
      const hPx = units * UNIT;
      prism(px, cx - TW * 0.36, by - TH * 0.18, hPx, stone, TW * 0.28, TH * 0.28);
      prism(px, cx + TW * 0.36, by + TH * 0.18, hPx, stone, TW * 0.28, TH * 0.28);
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const x = cx - TW * 0.36 + TW * 0.72 * t;
        const y = by - hPx - TH * 0.18 + TH * 0.36 * t - Math.sin(t * Math.PI) * 18;
        px.ellipse(x, y, 4.5, 4, shade(stone, 0.92 + Math.sin(t * Math.PI) * 0.2));
      }
      break;
    }
    case O.GATE: {
      const hPx = units * UNIT;
      prism(px, cx - TW * 0.34, by - TH * 0.17, hPx, stone, TW * 0.3, TH * 0.3);
      prism(px, cx + TW * 0.34, by + TH * 0.17, hPx, stone, TW * 0.3, TH * 0.3);
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const x = cx - TW * 0.34 + TW * 0.68 * t;
        const y = by - hPx - TH * 0.17 + TH * 0.34 * t - Math.sin(t * Math.PI) * 14;
        px.ellipse(x, y, 5, 4.4, shade(stone, 0.95));
      }
      // portcullis
      for (let k = -3; k <= 3; k++) px.capsule(cx + k * 5, by - hPx * 0.52, cx + k * 5, by - 2, 1.0, 1.0, P.ironDark);
      for (let k = 0; k < 3; k++) px.capsule(cx - 17, by - 6 - k * 9, cx + 17, by - 6 - k * 9 + 2, 0.9, 0.9, P.ironDark);
      break;
    }
    case O.STAIR: {
      for (let k = 0; k < 4; k++) prism(px, cx, by - k * 4, 4, shade(stone, 0.9 + k * 0.05), TW * (0.9 - k * 0.1), TH * (0.9 - k * 0.1));
      break;
    }
    case O.RUBBLE: {
      for (let i = 0; i < 12; i++) {
        const x = cx + (r() - 0.5) * TW * 0.85, y = by - 2 - r() * 7;
        const s = 3 + r() * 5;
        px.poly([{ x: x - s, y }, { x, y: y - s * 0.6 }, { x: x + s, y }, { x, y: y + s * 0.5 }], shade(stone, 0.78 + r() * 0.4));
      }
      break;
    }
    case O.BRIDGE_RAIL: {
      prism(px, cx, by, 12, stone, TW * 0.92, TH * 0.92);
      for (let k = -1; k <= 1; k++) prism(px, cx + k * 20, by - 12, 9, shade(stone, 1.05), 11, 6);
      break;
    }
    case O.FLOOR_GRATE: {
      px.poly(diamond(cx, by - TH / 2, TW * 0.8, TH * 0.8), [16, 14, 18]);
      for (let k = -2; k <= 2; k++) px.line(cx + k * 6 - 10, by - TH / 2 + k * 3 - 5, cx + k * 6 + 10, by - TH / 2 + k * 3 + 5, P.ironDark);
      break;
    }
    case O.DOOR: {
      prism(px, cx, by, UNIT * 1.6, shade(wood, 0.9), TW * 0.44, TH * 0.44);
      px.capsule(cx - 6, by - UNIT * 1.2, cx + 6, by - UNIT * 1.2, 1.2, 1.2, P.ironDark);
      px.ellipse(cx + 5, by - UNIT * 0.8, 1.6, 1.6, P.bronze);
      break;
    }

    // ------------------------------------------------------- monuments
    case O.STATUE_SAINT: {
      const hPx = units * UNIT;
      prism(px, cx, by, 10, shade(stone, 0.86), TW * 0.52, TH * 0.52);
      const fy = by - 10 - TH * 0.26;
      const body = shade(stone, 1.04);
      px.poly([{ x: cx - 9, y: fy }, { x: cx + 9, y: fy }, { x: cx + 6, y: fy - hPx * 0.62 }, { x: cx - 6, y: fy - hPx * 0.62 }], body);
      px.capsule(cx, fy - hPx * 0.6, cx, fy - hPx * 0.74, 5.5, 5, body);
      px.ellipse(cx, fy - hPx * 0.8, 4.6, 5, shade(body, 1.08));
      px.ellipse(cx, fy - hPx * 0.8, 4.6, 5, shade(body, 0.7), 0.0);
      // hands clasped, head bowed, face worn away
      px.capsule(cx - 6, fy - hPx * 0.56, cx, fy - hPx * 0.4, 2.4, 2, shade(body, 0.92));
      px.capsule(cx + 6, fy - hPx * 0.56, cx, fy - hPx * 0.4, 2.4, 2, shade(body, 0.92));
      if (v % 2) { px.capsule(cx - 7, fy - hPx * 0.62, cx - 11, fy - hPx * 0.3, 2, 1, shade(body, 0.8)); }
      for (let i = 0; i < 14; i++) px.blend(cx + (r() - 0.5) * 18, fy - r() * hPx * 0.7, P.moss, 0.3);
      break;
    }
    case O.STATUE_BEAST: {
      prism(px, cx, by, 9, shade(stone, 0.86), TW * 0.55, TH * 0.55);
      const fy = by - 9 - TH * 0.28;
      const body = shade(stone, 0.98);
      px.capsule(cx - 10, fy - 6, cx + 8, fy - 10, 6, 5, body);
      px.ellipse(cx + 12, fy - 13, 5, 4.4, body);
      px.capsule(cx + 13, fy - 16, cx + 18, fy - 21, 1.6, 0.6, body);
      px.capsule(cx + 10, fy - 16, cx + 14, fy - 22, 1.6, 0.6, body);
      for (const dx of [-8, -2, 4, 9]) px.capsule(cx + dx, fy - 4, cx + dx, fy, 2.2, 2.4, shade(body, 0.9));
      px.capsule(cx - 11, fy - 8, cx - 19, fy - 16, 2, 0.6, shade(body, 0.9));
      break;
    }
    case O.GARGOYLE: {
      prism(px, cx, by, UNIT, shade(stone, 0.9), TW * 0.4, TH * 0.4);
      const fy = by - UNIT - TH * 0.2;
      px.ellipse(cx, fy - 6, 6, 5, shade(stone, 1.02));
      px.ellipse(cx, fy - 11, 4.4, 4, shade(stone, 1.06));
      px.capsule(cx - 4, fy - 14, cx - 8, fy - 20, 1.5, 0.5, shade(stone, 1.1));
      px.capsule(cx + 4, fy - 14, cx + 8, fy - 20, 1.5, 0.5, shade(stone, 1.1));
      px.poly([{ x: cx - 6, y: fy - 8 }, { x: cx - 20, y: fy - 18 }, { x: cx - 16, y: fy - 4 }], shade(stone, 0.8));
      px.poly([{ x: cx + 6, y: fy - 8 }, { x: cx + 20, y: fy - 18 }, { x: cx + 16, y: fy - 4 }], shade(stone, 0.88));
      px.set(cx - 2, fy - 11, [20, 16, 18]); px.set(cx + 2, fy - 11, [20, 16, 18]);
      break;
    }
    case O.TOMB: {
      prism(px, cx, by, 16, shade(stone, 0.94), TW * 0.78, TH * 0.78);
      gable(px, cx, by - 16 - TH * 0.39, 14, TW * 0.78, shade(stone, 1.04));
      px.capsule(cx - 10, by - 10, cx + 10, by - 10, 1.1, 1.1, shade(stone, 0.7));
      break;
    }
    case O.COFFIN: {
      px.poly([
        { x: cx - 20, y: by - 6 }, { x: cx - 6, y: by - 13 }, { x: cx + 20, y: by - 2 }, { x: cx + 6, y: by + 5 },
      ], shade(wood, 0.84));
      px.poly([
        { x: cx - 17, y: by - 7 }, { x: cx - 6, y: by - 12 }, { x: cx + 17, y: by - 3 }, { x: cx + 6, y: by + 2 },
      ], wood);
      px.capsule(cx - 4, by - 9, cx + 4, by - 6, 1.1, 1.1, P.ironDark);
      if (v === 0) px.capsule(cx - 2, by - 12, cx + 2, by - 5, 1.4, 1.4, P.bone);
      break;
    }
    case O.GRAVE_CROSS: {
      const hPx = 20 + v * 3;
      px.capsule(cx, by - 2, cx + (v - 1.5), by - hPx, 2.2, 1.8, shade(stone, 0.95));
      px.capsule(cx - 6, by - hPx * 0.68, cx + 6, by - hPx * 0.68 + (v - 1.5), 1.8, 1.8, shade(stone, 0.95));
      px.ellipse(cx, by - 1, 9, 3.4, [72, 66, 58] as Col);
      break;
    }
    case O.GRAVE_SLAB: {
      px.poly([{ x: cx - 11, y: by - 4 }, { x: cx, y: by - 9 }, { x: cx + 11, y: by - 4 }, { x: cx, y: by + 1 }], shade(stone, 0.9));
      px.poly([{ x: cx - 9, y: by - 5 }, { x: cx, y: by - 9 }, { x: cx + 9, y: by - 5 }, { x: cx, y: by - 1 }], shade(stone, 1.02));
      for (let k = 0; k < 3; k++) px.line(cx - 5, by - 6 + k * 1.6, cx + 5, by - 6 + k * 1.6, shade(stone, 0.72));
      break;
    }
    case O.OSSUARY: {
      prism(px, cx, by, UNIT * 1.4, shade(stone, 0.9), TW * 0.7, TH * 0.7);
      for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) {
        const x = cx - 10 + i * 20, y = by - 8 - j * 10;
        px.ellipse(x, y, 6, 4.5, [18, 16, 18]);
        px.ellipse(x, y, 3.4, 3, P.bone);
        px.set(x - 1, y, [20, 16, 16]); px.set(x + 1, y, [20, 16, 16]);
      }
      break;
    }

    // ---------------------------------------------------------- light
    case O.LANTERN: {
      // The grace site. Deliberately the most legible object in the game.
      prism(px, cx, by, 7, shade(stone, 0.9), TW * 0.44, TH * 0.44);
      px.capsule(cx, by - 7, cx, by - 30, 2.0, 1.6, P.ironDark);
      px.capsule(cx - 7, by - 30, cx + 7, by - 30, 1.4, 1.4, P.ironDark);
      px.poly([{ x: cx - 7, y: by - 31 }, { x: cx + 7, y: by - 31 }, { x: cx + 5, y: by - 44 }, { x: cx - 5, y: by - 44 }], [26, 22, 26]);
      px.poly([{ x: cx - 5, y: by - 32 }, { x: cx + 5, y: by - 32 }, { x: cx + 4, y: by - 43 }, { x: cx - 4, y: by - 43 }], shade(P.flame, 0.9));
      flameSprite(px, cx, by - 37, 1.3);
      px.poly([{ x: cx - 8, y: by - 44 }, { x: cx + 8, y: by - 44 }, { x: cx, y: by - 52 }], P.ironDark);
      px.ellipse(cx, by - 37, 17, 17, P.flame, 0.1);
      px.ellipse(cx, by - 37, 10, 10, P.flameLit, 0.12);
      break;
    }
    case O.BRAZIER: {
      px.capsule(cx, by - 2, cx, by - 14, 2.4, 1.8, P.ironDark);
      for (const dx of [-7, 0, 7]) px.capsule(cx, by - 4, cx + dx, by - 1, 1.3, 1.3, P.ironDark);
      px.ellipse(cx, by - 17, 10, 5, shade(P.iron, 0.8));
      px.ellipse(cx, by - 18, 8, 3.6, [30, 20, 16]);
      flameSprite(px, cx, by - 22, 1.6);
      px.ellipse(cx, by - 20, 20, 16, P.flame, 0.12);
      break;
    }
    case O.LAMP_POST: {
      const hPx = units * UNIT;
      px.capsule(cx, by - 1, cx, by - hPx, 2.2, 1.5, P.ironDark);
      px.ellipse(cx, by - 1, 6, 2.6, shade(P.ironDark, 1.2));
      px.capsule(cx, by - hPx, cx + 9, by - hPx - 3, 1.3, 1.1, P.ironDark);
      const lx = cx + 10, ly = by - hPx + 4;
      px.poly([{ x: lx - 4, y: ly - 10 }, { x: lx + 4, y: ly - 10 }, { x: lx + 3, y: ly }, { x: lx - 3, y: ly }], [24, 20, 24]);
      px.poly([{ x: lx - 3, y: ly - 9 }, { x: lx + 3, y: ly - 9 }, { x: lx + 2, y: ly - 1 }, { x: lx - 2, y: ly - 1 }], shade(P.flame, 0.85));
      flameSprite(px, lx, ly - 5, 0.9);
      px.poly([{ x: lx - 5, y: ly - 10 }, { x: lx + 5, y: ly - 10 }, { x: lx, y: ly - 15 }], P.ironDark);
      px.ellipse(lx, ly - 5, 14, 14, P.flame, 0.1);
      break;
    }
    case O.CANDLE_RACK: {
      px.capsule(cx, by - 1, cx, by - 16, 1.6, 1.3, P.ironDark);
      for (let k = -2; k <= 2; k++) {
        const x = cx + k * 5, y = by - 16 - Math.abs(k) * 1.5;
        px.capsule(x, y, x, y - 7 + Math.abs(k), 1.3, 1.1, P.pale);
        flameSprite(px, x, y - 9 + Math.abs(k), 0.5);
      }
      px.capsule(cx - 11, by - 15, cx + 11, by - 15, 1.1, 1.1, P.ironDark);
      px.ellipse(cx, by - 18, 18, 10, P.flame, 0.1);
      break;
    }
    case O.CHANDELIER: {
      const hPx = units * UNIT;
      px.capsule(cx, by - hPx, cx, by - hPx + 14, 0.8, 0.8, P.ironDark);
      px.ellipse(cx, by - hPx + 16, 14, 5, shade(P.ironDark, 1.1));
      px.ellipse(cx, by - hPx + 16, 10, 3, [0, 0, 0], 0);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const x = cx + Math.cos(a) * 13, y = by - hPx + 16 + Math.sin(a) * 4.5;
        px.capsule(x, y, x, y - 5, 1.1, 1, P.pale);
        flameSprite(px, x, y - 7, 0.55);
      }
      px.ellipse(cx, by - hPx + 14, 24, 18, P.flame, 0.1);
      break;
    }
    case O.PYRE: {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        px.capsule(cx + Math.cos(a) * 11, by - 1 + Math.sin(a) * 4, cx, by - 11, 2, 1.4, shade(wood, 0.8 + r() * 0.3));
      }
      flameSprite(px, cx, by - 18, 2.4);
      flameSprite(px, cx - 5, by - 14, 1.3);
      flameSprite(px, cx + 5, by - 15, 1.2);
      px.ellipse(cx, by - 16, 28, 22, P.flame, 0.14);
      break;
    }

    // --------------------------------------------------------- hanging
    case O.GIBBET: {
      const hPx = units * UNIT;
      px.capsule(cx - 14, by - 1, cx - 14, by - hPx, 2.6, 2, wood);
      px.capsule(cx - 14, by - hPx, cx + 8, by - hPx + 2, 2, 1.6, wood);
      px.capsule(cx + 8, by - hPx + 2, cx + 8, by - hPx + 9, 0.7, 0.7, P.ironDark);
      const gy = by - hPx + 12;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        px.capsule(cx + 8 + Math.cos(a) * 6, gy, cx + 8 + Math.cos(a) * 6, gy + 15, 0.8, 0.8, P.ironDark);
      }
      px.ellipse(cx + 8, gy, 7, 3, P.ironDark);
      px.ellipse(cx + 8, gy + 15, 7, 3, P.ironDark);
      px.capsule(cx + 8, gy + 4, cx + 8, gy + 12, 3.2, 2.4, shade(P.oldBlood, 0.9));
      px.ellipse(cx + 8, gy + 4, 3, 3, P.boneDark);
      break;
    }
    case O.WHEEL: {
      const hPx = units * UNIT;
      px.capsule(cx, by - 1, cx, by - hPx, 2.4, 2, wood);
      const wy = by - hPx - 2;
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        px.capsule(cx + Math.cos(a) * 13, wy + Math.sin(a) * 13, cx + Math.cos(a + 0.28) * 13, wy + Math.sin(a + 0.28) * 13, 1.5, 1.5, wood);
      }
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        px.capsule(cx, wy, cx + Math.cos(a) * 13, wy + Math.sin(a) * 13, 1.2, 1.2, shade(wood, 0.9));
      }
      px.ellipse(cx, wy, 3, 3, shade(wood, 1.2));
      break;
    }
    case O.BELL: {
      const hPx = units * UNIT;
      px.capsule(cx - 15, by - 1, cx - 15, by - hPx, 2.6, 2.2, wood);
      px.capsule(cx + 15, by - 1, cx + 15, by - hPx, 2.6, 2.2, wood);
      px.capsule(cx - 15, by - hPx, cx + 15, by - hPx, 2, 2, wood);
      const bq = by - hPx + 6;
      px.poly([{ x: cx - 10, y: bq + 18 }, { x: cx - 7, y: bq }, { x: cx + 7, y: bq }, { x: cx + 10, y: bq + 18 }], shade(P.bronze, 0.82));
      px.poly([{ x: cx - 7, y: bq + 17 }, { x: cx - 5, y: bq + 1 }, { x: cx + 3, y: bq + 1 }, { x: cx + 5, y: bq + 17 }], P.bronze);
      px.ellipse(cx, bq + 18, 10, 3.4, shade(P.bronze, 1.15));
      px.capsule(cx, bq + 16, cx, bq + 22, 1.4, 1.2, shade(P.bronze, 0.6));
      break;
    }
    case O.BANNER: {
      const hPx = units * UNIT;
      px.capsule(cx, by - hPx, cx, by - hPx + 4, 1, 1, P.ironDark);
      const c0 = [P.crimson, P.wine, P.slate, P.tarnish][v] as Col;
      px.poly([
        { x: cx - 9, y: by - hPx + 3 }, { x: cx + 9, y: by - hPx + 3 },
        { x: cx + 8, y: by - hPx + 30 }, { x: cx, y: by - hPx + 25 }, { x: cx - 8, y: by - hPx + 30 },
      ], c0);
      px.poly([
        { x: cx - 6, y: by - hPx + 5 }, { x: cx + 6, y: by - hPx + 5 },
        { x: cx + 5, y: by - hPx + 26 }, { x: cx, y: by - hPx + 22 }, { x: cx - 5, y: by - hPx + 26 },
      ], shade(c0, 1.15));
      px.capsule(cx, by - hPx + 10, cx, by - hPx + 20, 2.4, 1.4, P.gold);
      px.capsule(cx - 9, by - hPx + 3, cx + 9, by - hPx + 3, 1.2, 1.2, P.ironDark);
      break;
    }

    // ------------------------------------------------------- vegetation
    case O.TREE_DEAD: {
      const hPx = units * UNIT * (0.75 + r() * 0.4);
      trunk(px, cx, by, hPx, shade(P.woodDark, 1.1), 5.5, (r() - 0.5) * 8);
      branches(px, cx + (r() - 0.5) * 6, by - hPx + 4, 4, hPx * 0.42, shade(P.woodDark, 1.25), r, 2);
      px.ellipse(cx, by - 1, 13, 5, shade(P.woodDark, 0.8));
      break;
    }
    case O.TREE_PALE: {
      const hPx = units * UNIT * (0.78 + r() * 0.34);
      trunk(px, cx, by, hPx, [186, 184, 172], 4.6, (r() - 0.5) * 5);
      // birch scars: short dark dashes, offset left and right
      for (let i = 0; i < 7; i++) {
        const yy = by - 10 - i * (hPx / 9);
        const side = i % 2 ? 1 : -1;
        px.capsule(cx + side * 1.2, yy, cx + side * 3.4, yy - 1, 1.1, 0.6, [84, 80, 74]);
      }
      branches(px, cx, by - hPx + 6, 3, hPx * 0.3, [170, 168, 158], r, 1);
      foliage(px, cx, by - hPx - 4, 34, 24, [88, 104, 92], r, 8);
      foliage(px, cx - 10, by - hPx + 8, 22, 16, [78, 94, 84], r, 5);
      break;
    }
    case O.TREE_PINE: {
      const hPx = units * UNIT * (0.85 + r() * 0.3);
      trunk(px, cx, by, hPx * 0.5, P.woodDark, 4.4, 0);
      const dark: Col = [34, 48, 42];
      for (let k = 0; k < 4; k++) {
        const y = by - hPx * 0.35 - k * (hPx * 0.2);
        const w = 34 - k * 6;
        px.poly([{ x: cx - w, y }, { x: cx + w, y }, { x: cx, y: y - hPx * 0.3 }], shade(dark, 0.82 + k * 0.08));
      }
      px.poly([{ x: cx - 8, y: by - hPx * 0.95 }, { x: cx + 8, y: by - hPx * 0.95 }, { x: cx, y: by - hPx * 1.18 }], shade(dark, 1.15));
      break;
    }
    case O.TREE_ROT: {
      const hPx = units * UNIT * (0.7 + r() * 0.4);
      trunk(px, cx, by, hPx, [62, 56, 40], 6, (r() - 0.5) * 10);
      branches(px, cx, by - hPx + 3, 4, hPx * 0.4, [56, 50, 36], r, 2);
      foliage(px, cx, by - hPx - 2, 30, 20, [92, 106, 50], r, 7);
      for (let i = 0; i < 6; i++) px.capsule(cx + (r() - 0.5) * 30, by - hPx * 0.5, cx + (r() - 0.5) * 30, by - hPx * 0.5 + 10 + r() * 8, 1.1, 0.5, [74, 88, 44]);
      break;
    }
    case O.STUMP: {
      prism(px, cx, by, 9, shade(P.woodDark, 1.05), TW * 0.34, TH * 0.34);
      px.ellipse(cx, by - 9 - TH * 0.17, TW * 0.17, TH * 0.17, shade(P.wood, 1.1));
      for (let k = 1; k < 4; k++) px.ellipse(cx, by - 9 - TH * 0.17, TW * 0.17 - k * 2.2, TH * 0.17 - k * 1.1, shade(P.wood, 1 + k * 0.06), 0.5);
      break;
    }
    case O.BUSH: case O.BUSH_BARE: case O.FERN_BUSH: {
      const leaf: Col = o === O.BUSH_BARE ? [66, 60, 48] : o === O.FERN_BUSH ? [58, 88, 62] : [54, 76, 50];
      foliage(px, cx, by - 10, 26, 18, leaf, r, 6);
      if (o === O.BUSH) for (let i = 0; i < 6; i++) px.ellipse(cx + (r() - 0.5) * 22, by - 6 - r() * 12, 1.6, 1.6, [148, 42, 52]);
      break;
    }
    case O.REED: {
      for (let i = 0; i < 11; i++) {
        const x = cx + (r() - 0.5) * 32, hgt = 12 + r() * 16;
        const lean = (r() - 0.5) * 6;
        px.capsule(x, by - 1, x + lean, by - hgt, 1.2, 0.4, shade([96, 104, 62], 0.8 + r() * 0.4));
        if (r() < 0.4) px.ellipse(x + lean, by - hgt - 2, 1.4, 3, [86, 70, 46]);
      }
      break;
    }
    case O.FUNGUS: {
      for (let i = 0; i < 4; i++) {
        const x = cx + (r() - 0.5) * 22, y = by - 1 - r() * 4, s = 0.7 + r() * 0.7;
        px.capsule(x, y, x, y - 7 * s, 1.5 * s, 1.2 * s, [196, 190, 170]);
        px.ellipse(x, y - 8 * s, 5 * s, 3.4 * s, [166, 170, 120]);
        px.ellipse(x - 1, y - 9 * s, 3 * s, 2 * s, [196, 198, 150]);
      }
      break;
    }
    case O.VINE: {
      for (let i = 0; i < 4; i++) {
        let x = cx + (r() - 0.5) * 24, y = by - 1;
        for (let k = 0; k < 9; k++) { px.ellipse(x, y, 2.2, 1.8, [62, 82, 46]); x += (r() - 0.5) * 5; y -= 3 + r() * 2; }
      }
      break;
    }
    case O.ROOT: {
      for (let i = 0; i < 4; i++) {
        const a = r() * Math.PI * 2;
        px.capsule(cx, by - 2, cx + Math.cos(a) * 20, by - 2 + Math.sin(a) * 8, 3, 1, shade(P.woodDark, 1.1));
      }
      break;
    }
    case O.HERB: {
      for (let i = 0; i < 6; i++) {
        const x = cx + (r() - 0.5) * 18;
        px.capsule(x, by - 1, x + (r() - 0.5) * 4, by - 8 - r() * 5, 1.2, 0.5, [70, 96, 58]);
      }
      for (let i = 0; i < 4; i++) px.ellipse(cx + (r() - 0.5) * 16, by - 10 - r() * 4, 2, 1.6, [172, 70, 86]);
      break;
    }

    // ---------------------------------------------------------- natural
    case O.ROCK: {
      const s = 0.8 + v * 0.14;
      px.poly([{ x: cx - 12 * s, y: by - 3 }, { x: cx - 5 * s, y: by - 11 * s }, { x: cx + 7 * s, y: by - 10 * s }, { x: cx + 12 * s, y: by - 2 }, { x: cx, y: by + 3 }], shade(stone, 0.8));
      px.poly([{ x: cx - 8 * s, y: by - 4 }, { x: cx - 3 * s, y: by - 10 * s }, { x: cx + 5 * s, y: by - 9 * s }, { x: cx + 8 * s, y: by - 3 }], stone);
      px.poly([{ x: cx - 4 * s, y: by - 6 }, { x: cx - 1 * s, y: by - 9 * s }, { x: cx + 3 * s, y: by - 8 * s }], shade(stone, 1.2));
      break;
    }
    case O.BOULDER: {
      px.ellipse(cx, by - 12, 20, 14, shade(stone, 0.8));
      px.ellipse(cx - 2, by - 15, 16, 10, stone);
      px.ellipse(cx - 5, by - 18, 8, 5, shade(stone, 1.18));
      for (let i = 0; i < 4; i++) px.line(cx - 12 + i * 7, by - 22 + i, cx - 8 + i * 7, by - 6 + i, shade(stone, 0.65));
      for (let i = 0; i < 7; i++) px.blend(cx + (r() - 0.5) * 30, by - 20 - r() * 4, P.moss, 0.4);
      break;
    }
    case O.CRAG: {
      const hPx = units * UNIT * (0.6 + r() * 0.5);
      px.poly([
        { x: cx - 16, y: by }, { x: cx - 11, y: by - hPx * 0.7 }, { x: cx - 3, y: by - hPx },
        { x: cx + 6, y: by - hPx * 0.78 }, { x: cx + 15, y: by - 2 }, { x: cx, y: by + 5 },
      ], shade(stone, 0.78));
      px.poly([
        { x: cx - 9, y: by - 2 }, { x: cx - 6, y: by - hPx * 0.68 }, { x: cx - 3, y: by - hPx * 0.96 },
        { x: cx + 4, y: by - hPx * 0.72 }, { x: cx + 9, y: by - 3 },
      ], stone);
      px.poly([{ x: cx - 4, y: by - hPx * 0.5 }, { x: cx - 3, y: by - hPx * 0.94 }, { x: cx + 1, y: by - hPx * 0.6 }], shade(stone, 1.22));
      break;
    }
    case O.CRYSTAL: {
      const hPx = units * UNIT * 0.7;
      for (let i = 0; i < 3; i++) {
        const x = cx + (i - 1) * 7, hh = hPx * (0.5 + r() * 0.6);
        px.poly([{ x: x - 4, y: by - 2 }, { x, y: by - hh }, { x: x + 4, y: by - 2 }, { x, y: by + 2 }], shade(P.frost, 0.7));
        px.poly([{ x: x - 2, y: by - 3 }, { x, y: by - hh + 2 }, { x: x + 1, y: by - 4 }], P.frost);
      }
      px.ellipse(cx, by - hPx * 0.4, 20, 16, P.frost, 0.12);
      break;
    }
    case O.BONES: {
      for (let i = 0; i < 5; i++) {
        const x = cx + (r() - 0.5) * 26, y = by - 1 - r() * 4, a = r() * Math.PI;
        px.capsule(x - Math.cos(a) * 6, y - Math.sin(a) * 2, x + Math.cos(a) * 6, y + Math.sin(a) * 2, 1.5, 1.5, P.bone);
        px.ellipse(x - Math.cos(a) * 6, y - Math.sin(a) * 2, 2.2, 2, shade(P.bone, 1.1));
      }
      break;
    }
    case O.SKULL_PILE: {
      for (let i = 0; i < 7; i++) {
        const x = cx + (r() - 0.5) * 24, y = by - 2 - r() * 11;
        px.ellipse(x, y, 5, 4.4, shade(P.bone, 0.9 + r() * 0.25));
        px.ellipse(x - 1.6, y, 1.2, 1.2, [22, 18, 20]);
        px.ellipse(x + 1.6, y, 1.2, 1.2, [22, 18, 20]);
        px.rect(x - 1, y + 3, 2, 2, shade(P.bone, 0.8));
      }
      break;
    }
    case O.ASH_HEAP: {
      px.ellipse(cx, by - 4, 18, 7, shade(P.ash, 0.82));
      px.ellipse(cx - 2, by - 6, 13, 5, P.ash);
      for (let i = 0; i < 5; i++) px.ellipse(cx + (r() - 0.5) * 22, by - 4 - r() * 4, 1.6, 1.2, P.ember);
      break;
    }
    case O.ORE: {
      px.poly([{ x: cx - 13, y: by - 2 }, { x: cx - 6, y: by - 13 }, { x: cx + 8, y: by - 11 }, { x: cx + 13, y: by - 1 }], shade(stone, 0.82));
      px.poly([{ x: cx - 8, y: by - 4 }, { x: cx - 3, y: by - 11 }, { x: cx + 6, y: by - 9 }, { x: cx + 8, y: by - 3 }], stone);
      for (let i = 0; i < 5; i++) px.ellipse(cx + (r() - 0.5) * 16, by - 4 - r() * 7, 2, 1.6, P.ember);
      px.ellipse(cx, by - 7, 16, 12, P.ember, 0.1);
      break;
    }
    case O.SHARD: {
      px.poly([{ x: cx - 3, y: by - 1 }, { x: cx, y: by - 14 }, { x: cx + 3, y: by - 1 }], P.hollow);
      px.ellipse(cx, by - 8, 14, 12, P.hollow, 0.18);
      break;
    }

    // ----------------------------------------------------- furnishings
    case O.CRATE: {
      prism(px, cx, by, 17, wood, TW * 0.42, TH * 0.42);
      px.line(cx - 13, by - 9, cx, by - 2, shade(wood, 0.6));
      px.line(cx + 13, by - 9, cx, by - 2, shade(wood, 0.6));
      break;
    }
    case O.BARREL: {
      px.ellipse(cx, by - 4, 11, 5, shade(wood, 0.72));
      px.rect(cx - 11, by - 20, 22, 16, shade(wood, 0.84));
      px.ellipse(cx, by - 20, 11, 5, shade(wood, 1.12));
      for (const yy of [by - 8, by - 17]) { px.rect(cx - 11, yy, 22, 2, P.ironDark); }
      px.rect(cx - 11, by - 20, 2, 16, shade(wood, 0.66));
      break;
    }
    case O.TABLE: {
      px.poly(diamond(cx, by - 14, TW * 0.6, TH * 0.6), shade(wood, 1.05));
      px.poly(diamond(cx, by - 11, TW * 0.6, TH * 0.6), shade(wood, 0.72));
      for (const [dx, dy] of [[-16, 0], [16, 0], [0, 8], [0, -8]]) px.capsule(cx + dx, by - 11 + dy * 0.5, cx + dx, by - 1 + dy * 0.5, 1.5, 1.3, shade(wood, 0.7));
      break;
    }
    case O.CHAIR: {
      px.poly(diamond(cx, by - 11, TW * 0.26, TH * 0.26), shade(wood, 1.02));
      for (const [dx, dy] of [[-7, 0], [7, 0], [0, 4], [0, -4]]) px.capsule(cx + dx, by - 10 + dy * 0.5, cx + dx, by - 1 + dy * 0.5, 1.2, 1, shade(wood, 0.7));
      px.poly([{ x: cx - 7, y: by - 12 }, { x: cx, y: by - 15 }, { x: cx, y: by - 26 }, { x: cx - 7, y: by - 23 }], shade(wood, 0.88));
      break;
    }
    case O.BED: {
      px.poly(diamond(cx, by - 9, TW * 0.72, TH * 0.72), shade(P.wool, 0.9));
      px.poly(diamond(cx - 10, by - 12, TW * 0.26, TH * 0.26), P.linen);
      px.poly([{ x: cx - 22, y: by - 9 }, { x: cx, y: by - 20 }, { x: cx + 22, y: by - 9 }, { x: cx, y: by + 2 }], shade(P.wool, 0.72), 0);
      for (const dx of [-21, 21]) px.capsule(cx + dx, by - 10, cx + dx, by - 1, 1.6, 1.4, shade(wood, 0.8));
      px.capsule(cx - 22, by - 12, cx - 12, by - 17, 2, 2, shade(wood, 0.9));
      break;
    }
    case O.BOOKSHELF: {
      const hPx = units * UNIT;
      prism(px, cx, by, hPx, shade(wood, 0.82), TW * 0.5, TH * 0.5);
      for (let k = 0; k < 3; k++) {
        const y = by - 8 - k * (hPx / 3.4);
        for (let i = 0; i < 7; i++) {
          const bc: Col = [[82, 46, 44], [52, 56, 76], [70, 62, 44], [46, 58, 48]][i % 4] as Col;
          px.rect(cx - 12 + i * 3.4, y - 8 - (i % 3), 2.6, 8 + (i % 3), shade(bc, 0.9 + (i % 2) * 0.25));
        }
        px.rect(cx - 14, y, 28, 1.6, shade(wood, 0.66));
      }
      break;
    }
    case O.ANVIL: {
      prism(px, cx, by, 8, shade(wood, 0.76), TW * 0.3, TH * 0.3);
      px.poly([{ x: cx - 13, y: by - 12 }, { x: cx + 15, y: by - 14 }, { x: cx + 13, y: by - 18 }, { x: cx - 11, y: by - 16 }], shade(P.ironDark, 1.1));
      px.poly([{ x: cx + 13, y: by - 15 }, { x: cx + 22, y: by - 16 }, { x: cx + 13, y: by - 18 }], shade(P.ironDark, 1.2));
      px.rect(cx - 5, by - 12, 10, 4, P.ironDark);
      break;
    }
    case O.CAULDRON: {
      px.ellipse(cx, by - 10, 13, 10, shade(P.ironDark, 1.1));
      px.ellipse(cx, by - 14, 12, 5, shade(P.ironDark, 0.7));
      px.ellipse(cx, by - 14, 10, 4, [54, 72, 48]);
      for (const dx of [-8, 0, 8]) px.capsule(cx + dx, by - 4, cx + dx * 1.3, by, 1.3, 1.3, P.ironDark);
      flameSprite(px, cx, by - 2, 0.8);
      break;
    }
    case O.WELL: {
      prism(px, cx, by, 12, stone, TW * 0.62, TH * 0.62);
      px.poly(diamond(cx, by - 12 - TH * 0.31, TW * 0.46, TH * 0.46), [12, 14, 20]);
      for (const dx of [-15, 15]) px.capsule(cx + dx, by - 14, cx + dx, by - 40, 2.2, 2, wood);
      px.capsule(cx - 16, by - 40, cx + 16, by - 40, 2, 2, wood);
      gable(px, cx, by - 40, 14, TW * 0.7, shade(P.slate, 1.0));
      px.capsule(cx, by - 38, cx, by - 26, 0.7, 0.7, P.ironDark);
      px.rect(cx - 4, by - 26, 8, 5, shade(wood, 0.9));
      break;
    }
    case O.CART: {
      px.poly([{ x: cx - 20, y: by - 10 }, { x: cx + 14, y: by - 16 }, { x: cx + 20, y: by - 10 }, { x: cx - 14, y: by - 4 }], shade(wood, 0.92));
      px.poly([{ x: cx - 20, y: by - 10 }, { x: cx - 14, y: by - 4 }, { x: cx - 14, y: by - 12 }, { x: cx - 20, y: by - 18 }], shade(wood, 0.74));
      for (const dx of [-12, 10]) {
        px.ellipse(cx + dx, by - 3, 7, 7, shade(wood, 0.7));
        px.ellipse(cx + dx, by - 3, 4.4, 4.4, shade(wood, 0.95));
        px.ellipse(cx + dx, by - 3, 1.4, 1.4, P.ironDark);
      }
      px.capsule(cx + 18, by - 12, cx + 30, by - 6, 1.6, 1.2, wood);
      break;
    }
    case O.CHEST: {
      prism(px, cx, by, 11, shade(wood, 0.9), TW * 0.44, TH * 0.44);
      px.poly([{ x: cx - 14, y: by - 11 }, { x: cx, y: by - 18 }, { x: cx + 14, y: by - 11 }, { x: cx, y: by - 4 }], shade(wood, 1.06));
      px.capsule(cx - 14, by - 11, cx, by - 4, 1.2, 1.2, P.bronze);
      px.capsule(cx + 14, by - 11, cx, by - 4, 1.2, 1.2, P.bronze);
      px.ellipse(cx, by - 8, 2.4, 2, P.goldLit);
      break;
    }
    case O.IRON_FENCE: {
      for (let k = -2; k <= 2; k++) {
        const x = cx + k * 12, y = by - 2 + k * 0;
        px.capsule(x, y, x, y - 20 - (k % 2 ? 0 : 3), 1.2, 0.8, P.ironDark);
        px.ellipse(x, y - 22 - (k % 2 ? 0 : 3), 1.6, 2.2, P.ironDark);
      }
      px.capsule(cx - 26, by - 14, cx + 26, by - 14, 1, 1, P.ironDark);
      px.capsule(cx - 26, by - 6, cx + 26, by - 6, 1, 1, P.ironDark);
      break;
    }
    case O.WOOD_FENCE: {
      for (let k = -1; k <= 1; k++) px.capsule(cx + k * 18, by - 1, cx + k * 18, by - 18, 2, 1.6, wood);
      px.capsule(cx - 22, by - 13, cx + 22, by - 13, 1.6, 1.6, shade(wood, 1.05));
      px.capsule(cx - 22, by - 6, cx + 22, by - 6, 1.6, 1.6, shade(wood, 0.9));
      break;
    }
    case O.LADDER: {
      const hPx = units * UNIT;
      for (const dx of [-5, 5]) px.capsule(cx + dx, by - 1, cx + dx, by - hPx, 1.4, 1.2, wood);
      for (let k = 0; k * 7 < hPx; k++) px.capsule(cx - 5, by - 4 - k * 7, cx + 5, by - 4 - k * 7, 1, 1, shade(wood, 1.1));
      break;
    }
    case O.BOARD: {
      // a parish notice board, papered over many times and never cleared
      for (const dx of [-16, 16]) px.capsule(cx + dx, by - 1, cx + dx, by - 34, 2.4, 2.0, wood);
      px.poly([{ x: cx - 19, y: by - 14 }, { x: cx + 19, y: by - 17 }, { x: cx + 19, y: by - 38 }, { x: cx - 19, y: by - 35 }], shade(wood, 0.82));
      px.poly([{ x: cx - 17, y: by - 15 }, { x: cx + 17, y: by - 18 }, { x: cx + 17, y: by - 36 }, { x: cx - 17, y: by - 33 }], shade(wood, 1.02));
      gable(px, cx, by - 36, 9, TW * 0.64, shade(P.slate, 1.0));
      let sx = cx - 14;
      for (let i = 0; i < 4; i++) {
        const w = 6 + (r() * 5) | 0, h = 8 + (r() * 6) | 0;
        const yy = by - 32 + ((r() * 6) | 0);
        px.poly([{ x: sx, y: yy }, { x: sx + w, y: yy - 1 }, { x: sx + w, y: yy + h }, { x: sx, y: yy + h + 1 }], i === 0 ? P.linen : shade(P.linen, 0.84 + r() * 0.2));
        for (let k = 1; k < 4; k++) px.line(sx + 1, yy + k * 2.2, sx + w - 1, yy + k * 2.2 - 1, shade(P.linen, 0.55));
        px.set(sx + 1, yy + 1, P.rust);
        sx += w + 1;
      }
      break;
    }
    case O.SIGN: {
      px.capsule(cx, by - 1, cx, by - 20, 1.8, 1.5, wood);
      px.poly([{ x: cx - 13, y: by - 20 }, { x: cx + 13, y: by - 22 }, { x: cx + 13, y: by - 32 }, { x: cx - 13, y: by - 30 }], shade(wood, 1.05));
      for (let k = 0; k < 3; k++) px.line(cx - 9, by - 27 + k * 3, cx + 7, by - 28 + k * 3, shade(wood, 0.6));
      break;
    }
    case O.ALTAR: {
      prism(px, cx, by, 14, shade(stone, 0.95), TW * 0.6, TH * 0.6);
      px.poly(diamond(cx, by - 14 - TH * 0.3, TW * 0.68, TH * 0.68), shade(stone, 1.12));
      px.poly(diamond(cx, by - 14 - TH * 0.3, TW * 0.44, TH * 0.44), shade(stone, 0.72));
      px.capsule(cx, by - 20, cx, by - 36, 1.6, 1.2, P.gold);
      px.capsule(cx - 6, by - 31, cx + 6, by - 31, 1.3, 1.3, P.gold);
      px.ellipse(cx, by - 30, 20, 18, P.goldLit, 0.1);
      break;
    }
    case O.CORPSE: {
      px.capsule(cx - 10, by - 3, cx + 8, by - 5, 4, 3.4, shade(P.cloth, 0.9));
      px.ellipse(cx + 11, by - 6, 4, 3.4, P.skinCorpse);
      px.capsule(cx - 2, by - 4, cx - 4, by + 2, 2, 1.4, shade(P.cloth, 0.8));
      for (let i = 0; i < 5; i++) px.ellipse(cx + (r() - 0.5) * 20, by - 1 + r() * 2, 2.4, 1.2, P.oldBlood);
      break;
    }
    case O.NOTE: {
      px.ellipse(cx, by - 3, 9, 4, P.hollowDim, 0.3);
      px.poly([{ x: cx - 5, y: by - 4 }, { x: cx + 5, y: by - 6 }, { x: cx + 4, y: by - 13 }, { x: cx - 6, y: by - 11 }], P.linen);
      for (let k = 0; k < 3; k++) px.line(cx - 3, by - 10 + k * 2, cx + 2, by - 11 + k * 2, shade(P.linen, 0.6));
      px.ellipse(cx, by - 8, 14, 12, P.hollow, 0.14);
      break;
    }
    case O.FOG_WALL: {
      const hPx = units * UNIT;
      // a soft vertical veil: dense at the base, fraying at the top
      for (let y = 0; y < hPx; y++) {
        const t = y / hPx;
        const a = 0.30 * (1 - t * 0.75);
        const halfW = TW * (0.54 - t * 0.06);
        for (let x = -halfW; x < halfW; x++) {
          const edge = 1 - Math.pow(Math.abs(x) / halfW, 3);
          px.blend(cx + x, by - y - TH * 0.25, [206, 216, 236], a * edge);
        }
      }
      for (let i = 0; i < 90; i++) {
        const t = r();
        px.ellipse(cx + (r() - 0.5) * TW * 0.95, by - t * hPx - TH * 0.25, 4 + r() * 7, 3 + r() * 5, [230, 238, 252], 0.05 + (1 - t) * 0.05);
      }
      break;
    }
  }
}

