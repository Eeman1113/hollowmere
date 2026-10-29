// Hand-authored, procedurally varied set-pieces. Every structure is stamped
// deterministically from (worldSeed, regionX, regionY) so an infinite world
// still generates the same cathedral every time you walk back to it.

import { mulberry32, type Rng } from '../core';
import { O, T, type Biome } from './types';

export interface Cell { t?: T; o?: O; v?: number; h?: number }
export interface Marker {
  kind: 'lantern' | 'boss' | 'npc' | 'chest' | 'spawn' | 'note' | 'fog' | 'merchant' | 'poi';
  x: number; y: number; id?: string; tier?: number;
}

export interface StampCtx {
  put: (x: number, y: number, c: Cell) => void;
  mark: (m: Marker) => void;
  rng: Rng;
  x: number; y: number; w: number; h: number;
  biome: Biome;
  tier: number;
}

export interface StructDef {
  id: string;
  name: string;
  w: number; h: number;
  /** Flattens terrain and suppresses scatter inside the footprint. */
  clear?: boolean;
  stamp: (c: StampCtx) => void;
}

// ------------------------------------------------------------------ helpers
const rect = (c: StampCtx, x: number, y: number, w: number, h: number, cell: Cell) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) c.put(x + i, y + j, cell);
};
const frame = (c: StampCtx, x: number, y: number, w: number, h: number, cell: Cell, gaps: [number, number][] = []) => {
  const skip = (px: number, py: number) => gaps.some(([gx, gy]) => gx === px && gy === py);
  for (let i = 0; i < w; i++) {
    if (!skip(x + i, y)) c.put(x + i, y, cell);
    if (!skip(x + i, y + h - 1)) c.put(x + i, y + h - 1, cell);
  }
  for (let j = 1; j < h - 1; j++) {
    if (!skip(x, y + j)) c.put(x, y + j, cell);
    if (!skip(x + w - 1, y + j)) c.put(x + w - 1, y + j, cell);
  }
};
const disc = (c: StampCtx, cx: number, cy: number, r: number, cell: Cell) => {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) c.put(cx + x, cy + y, cell);
};
const ring = (c: StampCtx, cx: number, cy: number, r: number, n: number, cell: Cell) => {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    c.put(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), cell);
  }
};
const chance = (c: StampCtx, p: number) => c.rng() < p;
const pickW = <A,>(r: Rng, list: [A, number][]) => {
  let total = 0;
  for (const [, w] of list) total += w;
  let n = r() * total;
  for (const [v, w] of list) { n -= w; if (n <= 0) return v; }
  return list[list.length - 1][0];
};

/** Rows of pillars down a hall, with the odd broken one. */
const colonnade = (c: StampCtx, x: number, y: number, len: number, gap: number, span: number, h = 4) => {
  for (let i = 0; i < len; i += gap) {
    const broken = chance(c, 0.22);
    c.put(x + i, y, { o: broken ? O.PILLAR_BROKEN : O.PILLAR, v: (i / gap) | 0, h: broken ? 2 : h });
    const b2 = chance(c, 0.22);
    c.put(x + i, y + span, { o: b2 ? O.PILLAR_BROKEN : O.PILLAR, v: ((i / gap) | 0) + 1, h: b2 ? 2 : h });
  }
};

/** Wall run that breaks itself up with windows so a long face is never flat. */
const curtain = (c: StampCtx, x: number, y: number, w: number, h: number, hh: number, gaps: [number, number][] = []) => {
  const skip = (px: number, py: number) => gaps.some(([gx, gy]) => gx === px && gy === py);
  const put = (px: number, py: number, i: number) => {
    if (skip(px, py)) return;
    const o = i % 3 === 1 ? O.WALL_WINDOW : O.WALL;
    c.put(px, py, { o, h: hh, v: (px + py) & 3 });
  };
  for (let i = 0; i < w; i++) { put(x + i, y, i); put(x + i, y + h - 1, i); }
  for (let j = 1; j < h - 1; j++) { put(x, y + j, j); put(x + w - 1, y + j, j); }
};

// ---------------------------------------------------------------- cathedral
const cathedral: StructDef = {
  id: 'cathedral', name: 'Cathedral of the Drowned Choir', w: 38, h: 28, clear: true,
  stamp: (c) => {
    const { x, y, w, h } = c;
    // consecrated ground
    rect(c, x - 2, y - 2, w + 4, h + 4, { t: T.COBBLE });
    rect(c, x + 2, y + 2, w - 4, h - 4, { t: T.FLAG });
    // nave floor
    rect(c, x + 6, y + 4, w - 14, h - 8, { t: T.MARBLE });

    // outer walls with a door at the south face
    const door = x + Math.floor(w / 2);
    curtain(c, x + 2, y + 2, w - 4, h - 4, 4, [[door, y + h - 3], [door + 1, y + h - 3]]);
    c.put(door, y + h - 3, { o: O.GATE, t: T.MARBLE });
    c.put(door + 1, y + h - 3, { t: T.MARBLE });

    // buttresses marching down both flanks
    for (let j = y + 5; j < y + h - 5; j += 4) {
      c.put(x + 1, j, { o: O.BUTTRESS, h: 4 });
      c.put(x + w - 2, j, { o: O.BUTTRESS, h: 4 });
      c.put(x + 2, j, { o: O.WALL_WINDOW, h: 4 });
      c.put(x + w - 3, j, { o: O.WALL_WINDOW, h: 4 });
    }

    // twin spires flanking the entrance
    c.put(x + 3, y + h - 4, { o: O.SPIRE, h: 8 });
    c.put(x + w - 4, y + h - 4, { o: O.SPIRE, h: 8 });
    c.put(x + 3, y + 3, { o: O.SPIRE, h: 6 });
    c.put(x + w - 4, y + 3, { o: O.SPIRE, h: 6 });

    // the nave: two colonnades and a carpet of candles
    colonnade(c, x + 8, y + 6, w - 18, 3, h - 13, 5);
    for (let j = y + 7; j < y + h - 8; j += 5) {
      c.put(x + 7, j, { o: O.CANDLE_RACK });
      c.put(x + w - 8, j, { o: O.CANDLE_RACK });
    }
    for (let i = x + 9; i < x + w - 9; i += 6) c.put(i, y + Math.floor(h / 2), { o: O.CHANDELIER, h: 5 });

    // apse: altar, the bell, and the arena
    const ax = x + Math.floor(w / 2), ay = y + 5;
    disc(c, ax, ay, 4, { t: T.MARBLE });
    c.put(ax, ay - 1, { o: O.ALTAR });
    c.put(ax - 3, ay, { o: O.BRAZIER });
    c.put(ax + 3, ay, { o: O.BRAZIER });
    c.put(ax - 5, ay + 2, { o: O.STATUE_SAINT, h: 3 });
    c.put(ax + 5, ay + 2, { o: O.STATUE_SAINT, h: 3 });
    c.put(x + 4, y + 4, { o: O.BELL, h: 4 });

    // fog wall across the transept, boss beyond it
    for (let i = x + 7; i < x + w - 7; i++) c.put(i, y + h - 11, { o: O.FOG_WALL });

    // lantern just inside the doors, before the fog
    c.put(door - 2, y + h - 6, { o: O.LANTERN });
    c.mark({ kind: 'lantern', x: door - 2, y: y + h - 6, id: 'cathedral_nave' });

    // the choir itself, rotted in their stalls
    for (let i = 0; i < 7; i++) c.mark({ kind: 'spawn', x: x + 9 + ((i * 5) % (w - 18)), y: y + 10 + ((i * 3) % 8), id: 'choirman' });
    c.mark({ kind: 'chest', x: ax - 4, y: ay + 1, tier: 3 });
    c.mark({ kind: 'note', x: ax + 2, y: ay + 3, id: 'cathedral' });
    c.put(ax - 4, ay + 1, { o: O.CHEST });
    c.put(ax + 2, ay + 3, { o: O.NOTE });
  },
};

// --------------------------------------------------------------------- keep
const keep: StructDef = {
  id: 'keep', name: 'Ruined Keep', w: 30, h: 26, clear: true,
  stamp: (c) => {
    const { x, y, w, h } = c;
    rect(c, x, y, w, h, { t: T.DIRT });
    rect(c, x + 3, y + 3, w - 6, h - 6, { t: T.COBBLE });
    const gate = x + Math.floor(w / 2);
    frame(c, x + 1, y + 1, w - 2, h - 2, { o: O.BATTLEMENT, h: 3 }, [[gate, y + h - 2], [gate + 1, y + h - 2]]);
    for (let i = 3; i < w - 3; i += 5) { c.put(x + i, y + 1, { o: O.WALL_WINDOW, h: 3 }); c.put(x + i, y + h - 2, { o: O.WALL_WINDOW, h: 3 }); }
    c.put(gate, y + h - 2, { o: O.GATE, t: T.COBBLE });
    c.put(gate + 1, y + h - 2, { t: T.COBBLE });
    // corner towers
    for (const [tx, ty] of [[x + 1, y + 1], [x + w - 2, y + 1], [x + 1, y + h - 2], [x + w - 2, y + h - 2]]) {
      c.put(tx, ty, { o: O.SPIRE, h: 5 });
      c.put(tx + (tx === x + 1 ? 1 : -1), ty, { o: O.WALL, h: 3 });
    }
    // breached section — the wall has fallen in somewhere
    const bx = x + 2 + Math.floor(c.rng() * (w - 8));
    for (let i = 0; i < 4; i++) { c.put(bx + i, y + 1, { o: O.RUBBLE }); c.put(bx + i, y + 2, { o: chance(c, 0.5) ? O.RUBBLE : O.NONE, t: T.DIRT }); }

    // inner hall
    const ix = x + 8, iy = y + 6, iw = w - 16, ih = h - 14;
    rect(c, ix, iy, iw, ih, { t: T.FLAG });
    frame(c, ix, iy, iw, ih, { o: O.WALL_RUIN, h: 2 }, [[ix + 2, iy + ih - 1]]);
    c.put(ix + 2, iy + ih - 1, { t: T.FLAG });
    colonnade(c, ix + 1, iy + 1, iw - 2, 3, ih - 3);
    c.put(ix + 1, iy + 1, { o: O.TABLE });
    c.put(ix + iw - 2, iy + 1, { o: O.BOOKSHELF });

    // garrison and loot
    c.put(x + 5, y + h - 6, { o: O.BRAZIER });
    c.put(x + w - 6, y + h - 6, { o: O.BRAZIER });
    c.put(x + 5, y + h - 8, { o: O.LANTERN });
    c.mark({ kind: 'lantern', x: x + 5, y: y + h - 8, id: 'keep' });
    for (let i = 0; i < 6; i++) c.mark({ kind: 'spawn', x: x + 6 + ((i * 4) % (w - 12)), y: y + 8 + ((i * 5) % (h - 14)) });
    c.put(ix + Math.floor(iw / 2), iy + 1, { o: O.CHEST });
    c.mark({ kind: 'chest', x: ix + Math.floor(iw / 2), y: iy + 1, tier: 2 });
    for (let i = x + 4; i < x + w - 4; i += 7) c.put(i, y + 4, { o: O.BANNER, h: 3 });
  },
};

// ---------------------------------------------------------------- catacomb
const catacomb: StructDef = {
  id: 'catacomb', name: 'Catacomb', w: 26, h: 22, clear: true,
  stamp: (c) => {
    const { x, y, w, h } = c;
    rect(c, x, y, w, h, { t: T.GRAVE_DIRT });
    frame(c, x, y, w, h, { o: O.IRON_FENCE }, [[x + Math.floor(w / 2), y + h - 1]]);
    // grave rows
    for (let j = y + 3; j < y + h - 6; j += 3) {
      for (let i = x + 2; i < x + w - 2; i += 2) {
        if (chance(c, 0.78)) c.put(i, j, { o: chance(c, 0.3) ? O.GRAVE_SLAB : O.GRAVE_CROSS, v: (i + j) & 3 });
      }
    }
    // mausoleum at the head of the yard
    const mx = x + Math.floor(w / 2) - 4, my = y + h - 8;
    rect(c, mx, my, 9, 6, { t: T.FLAG });
    frame(c, mx, my, 9, 6, { o: O.WALL, h: 2 }, [[mx + 4, my + 5]]);
    c.put(mx + 4, my + 5, { o: O.DOOR, t: T.FLAG });
    c.put(mx + 2, my + 2, { o: O.COFFIN });
    c.put(mx + 6, my + 2, { o: O.COFFIN });
    c.put(mx + 4, my + 1, { o: O.TOMB, h: 2 });
    c.put(mx + 1, my + 1, { o: O.OSSUARY });
    c.put(mx + 7, my + 1, { o: O.OSSUARY });
    c.put(mx - 2, my + 2, { o: O.BRAZIER });
    c.put(mx + 10, my + 2, { o: O.BRAZIER });
    c.put(mx + 4, my + 3, { o: O.NOTE });
    c.mark({ kind: 'note', x: mx + 4, y: my + 3, id: 'catacomb' });
    c.mark({ kind: 'chest', x: mx + 2, y: my + 2, tier: 2 });
    for (let i = 0; i < 5; i++) c.mark({ kind: 'spawn', x: x + 3 + ((i * 5) % (w - 6)), y: y + 3 + ((i * 4) % (h - 10)), id: 'ghoul' });
    for (let i = 0; i < 2; i++) c.mark({ kind: 'spawn', x: mx + 2 + i * 5, y: my + 3, id: 'gravewarden' });
  },
};

// ------------------------------------------------------------------ hamlet
const hamlet: StructDef = {
  id: 'hamlet', name: 'Hamlet', w: 32, h: 26, clear: true,
  stamp: (c) => {
    const { x, y, w, h } = c;
    // a crooked street
    const sy = y + Math.floor(h / 2);
    for (let i = 0; i < w; i++) {
      const wob = Math.round(Math.sin(i * 0.4) * 1.6);
      for (let k = -1; k <= 1; k++) c.put(x + i, sy + wob + k, { t: T.COBBLE });
    }
    const houses = 4 + Math.floor(c.rng() * 4);
    for (let n = 0; n < houses; n++) {
      const hw = 5 + Math.floor(c.rng() * 4), hh = 4 + Math.floor(c.rng() * 3);
      const above = n % 2 === 0;
      const hx = x + 2 + Math.floor((c.rng() * (w - hw - 4)));
      const hy = above ? sy - 4 - hh + Math.round(Math.sin(hx * 0.4) * 1.6) : sy + 4 + Math.round(Math.sin(hx * 0.4) * 1.6);
      if (hy < y || hy + hh > y + h) continue;
      rect(c, hx, hy, hw, hh, { t: T.PLANK });
      const dy = above ? hy + hh - 1 : hy;
      const dx = hx + 1 + Math.floor(c.rng() * (hw - 2));
      frame(c, hx, hy, hw, hh, { o: O.WALL, h: 3 }, [[dx, dy]]);
      c.put(dx, dy, { o: O.DOOR, t: T.PLANK });
      // windows + a lantern by the door
      c.put(hx, hy + 1, { o: O.WALL_WINDOW, h: 3 });
      c.put(hx + hw - 1, hy + 1, { o: O.WALL_WINDOW, h: 3 });
      c.put(dx + (dx > hx + hw / 2 ? -1 : 1), dy + (above ? 1 : -1), { o: O.LAMP_POST, h: 3 });
      if (chance(c, 0.6)) c.put(hx + 1, hy + 1, { o: O.BED });
      if (chance(c, 0.6)) c.put(hx + hw - 2, hy + 1, { o: O.TABLE });
      if (chance(c, 0.45)) { c.put(hx + 1, hy + hh - 2, { o: O.CRATE }); c.mark({ kind: 'chest', x: hx + 1, y: hy + hh - 2, tier: 0 }); }
    }
    // street dressing
    for (let i = x + 3; i < x + w - 3; i += 7) {
      const wob = Math.round(Math.sin((i - x) * 0.4) * 1.6);
      c.put(i, sy + wob - 2, { o: O.LAMP_POST, h: 3 });
      if (chance(c, 0.4)) c.put(i + 3, sy + wob + 2, { o: O.CART });
    }
    c.put(x + Math.floor(w / 2), sy - 1, { o: O.WELL });
    c.put(x + 4, sy + 1, { o: O.LANTERN });
    c.mark({ kind: 'lantern', x: x + 4, y: sy + 1, id: 'hamlet' });
    for (let i = 0; i < 5; i++) c.mark({ kind: 'spawn', x: x + 4 + ((i * 6) % (w - 8)), y: sy + ((i % 3) - 1) * 4 });
  },
};

// ------------------------------------------------------------------- forge
const forge: StructDef = {
  id: 'forge', name: 'The Ember Forge', w: 22, h: 18, clear: true,
  stamp: (c) => {
    const { x, y, w, h } = c;
    rect(c, x, y, w, h, { t: T.STONE });
    rect(c, x + 2, y + 2, w - 4, h - 4, { t: T.FLAG });
    frame(c, x + 2, y + 2, w - 4, h - 4, { o: O.WALL_RUIN, h: 2 }, [[x + Math.floor(w / 2), y + h - 3]]);
    c.put(x + Math.floor(w / 2), y + h - 3, { t: T.FLAG });
    c.put(x + 5, y + 5, { o: O.ANVIL });
    c.put(x + 8, y + 5, { o: O.CAULDRON });
    c.put(x + 4, y + 4, { o: O.PYRE });
    c.put(x + w - 5, y + 5, { o: O.BRAZIER });
    c.put(x + w - 6, y + h - 6, { o: O.CRATE });
    c.put(x + 3, y + h - 5, { o: O.BARREL });
    c.put(x + Math.floor(w / 2), y + 3, { o: O.LANTERN });
    c.mark({ kind: 'lantern', x: x + Math.floor(w / 2), y: y + 3, id: 'forge' });
    c.mark({ kind: 'npc', x: x + 6, y: y + 6, id: 'smith' });
    c.mark({ kind: 'note', x: x + 9, y: y + 7, id: 'forge' });
    c.put(x + 9, y + 7, { o: O.NOTE });
  },
};

// -------------------------------------------------------------- watchtower
const watchtower: StructDef = {
  id: 'watchtower', name: 'Watchtower', w: 12, h: 12, clear: true,
  stamp: (c) => {
    const { x, y } = c;
    const cx = x + 6, cy = y + 6;
    disc(c, cx, cy, 5, { t: T.COBBLE });
    ring(c, cx, cy, 4, 16, { o: O.WALL, h: 4 });
    c.put(cx, cy + 4, { o: O.NONE, t: T.COBBLE });
    c.put(cx, cy, { o: O.SPIRE, h: 7 });
    c.put(cx - 2, cy - 1, { o: O.BRAZIER });
    c.put(cx + 2, cy - 1, { o: O.LADDER });
    ring(c, cx, cy, 6, 10, { o: O.IRON_FENCE });
    c.mark({ kind: 'spawn', x: cx - 1, y: cy + 2, id: 'redhand_bow' });
    c.mark({ kind: 'spawn', x: cx + 1, y: cy + 2 });
    c.put(cx + 1, cy - 2, { o: O.CHEST });
    c.mark({ kind: 'chest', x: cx + 1, y: cy - 2, tier: 1 });
  },
};

// ------------------------------------------------------------------ menhir
const menhir: StructDef = {
  id: 'menhir', name: 'Standing Stones', w: 16, h: 16, clear: true,
  stamp: (c) => {
    const { x, y } = c;
    const cx = x + 8, cy = y + 8;
    disc(c, cx, cy, 6, { t: T.MOSS });
    disc(c, cx, cy, 2, { t: T.STONE });
    ring(c, cx, cy, 5, 8, { o: O.CRAG, h: 4 });
    c.put(cx, cy, { o: O.ALTAR });
    c.put(cx - 1, cy + 3, { o: O.NOTE });
    c.mark({ kind: 'note', x: cx - 1, y: cy + 3, id: 'menhir' });
    c.mark({ kind: 'poi', x: cx, y: cy, id: 'menhir' });
    if (chance(c, 0.4)) { c.put(cx + 2, cy + 2, { o: O.LANTERN }); c.mark({ kind: 'lantern', x: cx + 2, y: cy + 2, id: 'menhir' }); }
    for (let i = 0; i < 3; i++) c.mark({ kind: 'spawn', x: cx + ((i * 3) % 7) - 3, y: cy + ((i * 5) % 7) - 3, id: 'wraith' });
  },
};

// ------------------------------------------------------------------ bridge
const bridge: StructDef = {
  id: 'bridge', name: 'The Long Bridge', w: 40, h: 10, clear: true,
  stamp: (c) => {
    const { x, y, w } = c;
    const my = y + 5;
    for (let i = 0; i < w; i++) {
      for (let k = -2; k <= 2; k++) c.put(x + i, my + k, { t: T.STONE });
      c.put(x + i, my - 3, { o: O.BRIDGE_RAIL });
      c.put(x + i, my + 3, { o: O.BRIDGE_RAIL });
      if (i % 9 === 4) { c.put(x + i, my - 3, { o: O.LAMP_POST, h: 3 }); c.put(x + i, my + 3, { o: O.LAMP_POST, h: 3 }); }
    }
    c.put(x + 1, my, { o: O.GATE });
    c.put(x + w - 2, my, { o: O.GATE });
    c.mark({ kind: 'lantern', x: x + 3, y: my + 1, id: 'bridge' });
    c.put(x + 3, my + 1, { o: O.LANTERN });
    for (let i = 0; i < 4; i++) c.mark({ kind: 'spawn', x: x + 8 + i * 7, y: my + (i % 2 ? 1 : -1) });
  },
};

// ---------------------------------------------------------------- aqueduct
const aqueduct: StructDef = {
  id: 'aqueduct', name: 'Broken Aqueduct', w: 36, h: 8, clear: true,
  stamp: (c) => {
    const { x, y, w } = c;
    const my = y + 4;
    for (let i = 0; i < w; i += 4) {
      const fallen = chance(c, 0.25);
      c.put(x + i, my, { o: fallen ? O.RUBBLE : O.ARCH, h: 5 });
      c.put(x + i, my - 1, { o: fallen ? O.NONE : O.PILLAR, h: 5 });
      if (fallen) for (let k = 0; k < 3; k++) c.put(x + i + k - 1, my + 2, { o: O.RUBBLE });
    }
    for (let i = 0; i < w; i++) c.put(x + i, my + 3, { t: T.STONE });
  },
};

// ------------------------------------------------------------- gibbet road
const gibbetRoad: StructDef = {
  id: 'gibbet_road', name: 'The Hanging Road', w: 30, h: 8, clear: true,
  stamp: (c) => {
    const { x, y, w } = c;
    const my = y + 4;
    for (let i = 0; i < w; i++) for (let k = -1; k <= 1; k++) c.put(x + i, my + k, { t: T.ROAD });
    for (let i = 2; i < w - 2; i += 5) {
      c.put(x + i, my - 2, { o: O.GIBBET, h: 4 });
      if (chance(c, 0.5)) c.put(x + i + 2, my + 2, { o: O.WHEEL, h: 3 });
      if (chance(c, 0.35)) { c.put(x + i + 1, my + 2, { o: O.CORPSE }); c.mark({ kind: 'chest', x: x + i + 1, y: my + 2, tier: 1 }); }
    }
    c.put(x + Math.floor(w / 2), my + 2, { o: O.SIGN });
    c.mark({ kind: 'note', x: x + Math.floor(w / 2), y: my + 2, id: 'road' });
    for (let i = 0; i < 3; i++) c.mark({ kind: 'spawn', x: x + 6 + i * 8, y: my + (i % 2 ? 1 : -1) });
  },
};

// --------------------------------------------------------- sunken chapel
const sunkenChapel: StructDef = {
  id: 'sunken_chapel', name: 'Sunken Chapel', w: 20, h: 16, clear: true,
  stamp: (c) => {
    const { x, y, w, h } = c;
    rect(c, x, y, w, h, { t: T.BOG });
    rect(c, x + 3, y + 3, w - 6, h - 6, { t: T.FLAG });
    frame(c, x + 3, y + 3, w - 6, h - 6, { o: O.WALL_RUIN, h: 2 }, [[x + Math.floor(w / 2), y + h - 4]]);
    c.put(x + Math.floor(w / 2), y + h - 4, { t: T.FLAG });
    colonnade(c, x + 5, y + 5, w - 10, 3, h - 11);
    c.put(x + Math.floor(w / 2), y + 4, { o: O.ALTAR });
    c.put(x + Math.floor(w / 2) - 3, y + 5, { o: O.STATUE_SAINT, h: 3 });
    // half of it has gone under
    for (let i = x; i < x + w; i++) for (let j = y + h - 4; j < y + h; j++) if (chance(c, 0.7)) c.put(i, j, { t: T.WATER });
    c.put(x + 4, y + 5, { o: O.LANTERN });
    c.mark({ kind: 'lantern', x: x + 4, y: y + 5, id: 'chapel' });
    c.put(x + w - 5, y + 5, { o: O.CHEST });
    c.mark({ kind: 'chest', x: x + w - 5, y: y + 5, tier: 2 });
    for (let i = 0; i < 4; i++) c.mark({ kind: 'spawn', x: x + 5 + i * 3, y: y + 7 + (i % 2) * 3, id: 'drowned' });
  },
};

// ------------------------------------------------------------- well shrine
const wellShrine: StructDef = {
  id: 'well_shrine', name: 'Roadside Shrine', w: 10, h: 10, clear: true,
  stamp: (c) => {
    const { x, y } = c;
    const cx = x + 5, cy = y + 5;
    disc(c, cx, cy, 4, { t: T.COBBLE });
    c.put(cx, cy, { o: O.WELL });
    c.put(cx - 2, cy - 2, { o: O.STATUE_SAINT, h: 3 });
    c.put(cx + 2, cy + 2, { o: O.LANTERN });
    c.mark({ kind: 'lantern', x: cx + 2, y: cy + 2, id: 'shrine' });
    if (chance(c, 0.5)) { c.put(cx + 2, cy - 2, { o: O.NOTE }); c.mark({ kind: 'note', x: cx + 2, y: cy - 2, id: 'shrine' }); }
  },
};

// -------------------------------------------------------------------- camp
const camp: StructDef = {
  id: 'camp', name: 'Redhand Camp', w: 16, h: 14, clear: false,
  stamp: (c) => {
    const { x, y, w, h } = c;
    const cx = x + Math.floor(w / 2), cy = y + Math.floor(h / 2);
    disc(c, cx, cy, 5, { t: T.DIRT });
    c.put(cx, cy, { o: O.PYRE });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      c.put(Math.round(cx + Math.cos(a) * 4), Math.round(cy + Math.sin(a) * 4), { o: i % 2 ? O.CRATE : O.BARREL });
    }
    ring(c, cx, cy, 6, 12, { o: O.WOOD_FENCE });
    c.put(cx + 6, cy, { o: O.NONE, t: T.DIRT });
    c.put(cx - 3, cy - 3, { o: O.CHEST });
    c.mark({ kind: 'chest', x: cx - 3, y: cy - 3, tier: 1 });
    for (let i = 0; i < 5; i++) c.mark({ kind: 'spawn', x: cx + ((i * 3) % 7) - 3, y: cy + ((i * 5) % 7) - 3, id: i === 0 ? 'redhand_bow' : 'redhand' });
    if (chance(c, 0.3)) { c.put(cx + 2, cy - 4, { o: O.GIBBET, h: 4 }); }
  },
};

// -------------------------------------------------------------- Lanternhold
// The hub. Walled, lit, and the only place in the valley that is safe.
const lanternhold: StructDef = {
  id: 'lanternhold', name: 'Lanternhold', w: 40, h: 34, clear: true,
  stamp: (c) => {
    const { x, y, w, h } = c;
    rect(c, x, y, w, h, { t: T.DIRT });
    rect(c, x + 3, y + 3, w - 6, h - 6, { t: T.COBBLE });
    const gateS = x + Math.floor(w / 2), gateN = x + Math.floor(w / 2);
    curtain(c, x + 2, y + 2, w - 4, h - 4, 3,
      [[gateS, y + h - 3], [gateS + 1, y + h - 3], [gateN, y + 2], [gateN + 1, y + 2]]);
    c.put(gateS, y + h - 3, { o: O.GATE, t: T.COBBLE });
    c.put(gateS + 1, y + h - 3, { t: T.COBBLE });
    c.put(gateN, y + 2, { o: O.GATE, t: T.COBBLE });
    c.put(gateN + 1, y + 2, { t: T.COBBLE });
    for (const [tx, ty] of [[x + 2, y + 2], [x + w - 3, y + 2], [x + 2, y + h - 3], [x + w - 3, y + h - 3]]) c.put(tx, ty, { o: O.SPIRE, h: 5 });

    // central plaza with the First Lantern
    const cx = x + Math.floor(w / 2), cy = y + Math.floor(h / 2);
    disc(c, cx, cy, 6, { t: T.FLAG });
    c.put(cx, cy, { o: O.LANTERN });
    c.mark({ kind: 'lantern', x: cx, y: cy, id: 'lanternhold' });
    c.mark({ kind: 'poi', x: cx, y: cy, id: 'lanternhold' });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      c.put(Math.round(cx + Math.cos(a) * 5), Math.round(cy + Math.sin(a) * 5), { o: O.LAMP_POST, h: 3 });
    }
    c.put(cx - 7, cy, { o: O.WELL });

    // four buildings around the plaza, each with a resident
    const house = (hx: number, hy: number, hw: number, hh: number, doorSide: 'n' | 's', npc?: string, fit?: O[]) => {
      rect(c, hx, hy, hw, hh, { t: T.PLANK });
      const dx = hx + Math.floor(hw / 2);
      const dy = doorSide === 's' ? hy + hh - 1 : hy;
      frame(c, hx, hy, hw, hh, { o: O.WALL, h: 3 }, [[dx, dy]]);
      c.put(dx, dy, { o: O.DOOR, t: T.PLANK });
      c.put(hx, hy + 1, { o: O.WALL_WINDOW, h: 3 });
      c.put(hx + hw - 1, hy + 1, { o: O.WALL_WINDOW, h: 3 });
      c.put(dx - 1, dy + (doorSide === 's' ? 1 : -1), { o: O.LAMP_POST, h: 3 });
      (fit ?? []).forEach((o, i) => c.put(hx + 1 + i * 2, hy + 1, { o }));
      if (npc) c.mark({ kind: 'npc', x: dx, y: hy + Math.floor(hh / 2), id: npc });
    };
    house(x + 5, y + 5, 8, 6, 's', 'elder', [O.TABLE, O.BOOKSHELF, O.CANDLE_RACK]);
    house(x + w - 13, y + 5, 8, 6, 's', 'merchant', [O.CRATE, O.BARREL, O.TABLE]);
    house(x + 5, y + h - 11, 8, 6, 'n', 'herbalist', [O.CAULDRON, O.TABLE, O.BOOKSHELF]);
    house(x + w - 13, y + h - 11, 8, 6, 'n', 'warden', [O.TABLE, O.BED]);
    house(x + Math.floor(w / 2) - 4, y + 4, 7, 5, 's', undefined, [O.BED, O.TABLE]);

    c.mark({ kind: 'npc', x: cx + 4, y: cy + 3, id: 'bellkeeper' });
    c.mark({ kind: 'merchant', x: cx - 4, y: cy + 4, id: 'merchant' });
    c.put(cx + 6, cy - 4, { o: O.NOTE });
    c.mark({ kind: 'note', x: cx + 6, y: cy - 4, id: 'opening' });
    c.put(cx - 2, cy + 6, { o: O.SIGN });
    c.put(cx + 3, cy - 5, { o: O.BOARD });
    c.mark({ kind: 'poi', x: cx + 3, y: cy - 5, id: 'board' });
  },
};

export const STRUCTS: Record<string, StructDef> = {
  lanternhold,
  cathedral, keep, catacomb, hamlet, forge, watchtower, menhir, bridge, aqueduct,
  gibbet_road: gibbetRoad, sunken_chapel: sunkenChapel, well_shrine: wellShrine, camp,
};

export { pickW, mulberry32 };
