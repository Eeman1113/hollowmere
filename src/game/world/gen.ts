// Infinite, seed-deterministic world. Chunks are generated on demand from
// noise fields plus structures hashed out of the region grid, so the same seed
// always rebuilds the same valley no matter which way you walk.

import { makeNoise, mulberry32, type Rng } from '../core';
import { BIOMES, BLOCKING as BLOCKING_SET, LIQUID, O, T, type Biome } from './types';
import { STRUCTS, pickW, type Cell, type Marker, type StampCtx } from './structures';

export const CHUNK = 24;
/** One structure may be placed per region. */
export const REGION = 58;
/** Road graph nodes sit on this coarser grid. */
export const ROAD_CELL = 52;

export interface Chunk {
  cx: number; cy: number;
  ground: Uint8Array;
  variant: Uint8Array;
  obj: Uint8Array;
  /** Per-tile prop height in wall units (architecture verticality). */
  oh: Uint8Array;
  /** Per-tile prop variant for texture selection. */
  ov: Uint8Array;
  biome: Uint8Array;
  markers: Marker[];
}

export interface PlacedStruct { id: string; x: number; y: number; w: number; h: number; seed: number; name: string; story?: string }

/** Which boss waits at each story site. */
const BOSS_AT: Record<string, string> = { choir: 'choir', bride: 'bride', first: 'first', forge: 'emberwright' };

const BIOME_IDS: Biome[] = ['fen', 'moor', 'palewood', 'cinder', 'lowland', 'bonehill', 'rotwood', 'reach'];
export const biomeIndex = (b: Biome) => BIOME_IDS.indexOf(b);
export const biomeOf = (i: number) => BIOME_IDS[i] ?? 'fen';

const hash2 = (x: number, y: number, s: number) => {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};
const rngAt = (x: number, y: number, s: number) => mulberry32(hash2(x, y, s));

export interface StorySite { id: string; x: number; y: number; struct: string; biome?: Biome; radius: number; name: string }

export class WorldGen {
  seed: number;
  private nE: (x: number, y: number, o?: number) => number;
  private nM: (x: number, y: number, o?: number) => number;
  private nT: (x: number, y: number, o?: number) => number;
  private nD: (x: number, y: number, o?: number) => number;
  private nW: (x: number, y: number, o?: number) => number;
  private cache = new Map<string, Chunk>();
  sites: StorySite[];
  /** Player-made changes layered on top of generation. */
  edits = new Map<number, number>();
  editH = new Map<number, number>();

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.nE = makeNoise(this.seed + 11);
    this.nM = makeNoise(this.seed + 23);
    this.nT = makeNoise(this.seed + 37);
    this.nD = makeNoise(this.seed + 51);
    this.nW = makeNoise(this.seed + 67);
    this.sites = this.layOutStory();
  }

  /** The fixed spine of the game: hub plus three boss sites, placed by seed. */
  private layOutStory(): StorySite[] {
    const r = mulberry32(this.seed ^ 0x5eed);
    const at = (dist: number, turn: number) => {
      const a = turn * Math.PI * 2 + r() * 0.6;
      return { x: Math.round(Math.cos(a) * dist), y: Math.round(Math.sin(a) * dist) };
    };
    const a = at(190, r());
    const b = at(330, r());
    const c = at(470, r());
    const f = at(120, r());
    return [
      { id: 'hub', x: 0, y: 0, struct: 'lanternhold', radius: 34, name: 'Lanternhold', biome: 'fen' },
      { id: 'forge', x: f.x, y: f.y, struct: 'forge', radius: 20, name: 'The Ember Forge', biome: 'cinder' },
      { id: 'choir', x: a.x, y: a.y, struct: 'cathedral', radius: 52, name: 'Cathedral of the Drowned Choir', biome: 'reach' },
      { id: 'bride', x: b.x, y: b.y, struct: 'sunken_chapel', radius: 46, name: 'The Pale Hall', biome: 'lowland' },
      { id: 'first', x: c.x, y: c.y, struct: 'keep', radius: 58, name: 'The Hollow Crown', biome: 'bonehill' },
    ];
  }

  siteNear(x: number, y: number) {
    for (const s of this.sites) {
      // wobble the boundary so a biome island never reads as a drawn circle
      const r = s.radius * (0.82 + this.nW(x / 14 + s.x, y / 14 + s.y, 2) * 0.36);
      if (Math.hypot(x - s.x, y - s.y) < r) return s;
    }
    return null;
  }

  // -------------------------------------------------------------- fields
  elevation(x: number, y: number) {
    // Domain warp keeps coastlines and ridges from looking like noise blobs.
    const wx = x + (this.nW(x / 90, y / 90, 2) - 0.5) * 46;
    const wy = y + (this.nW(x / 90 + 40, y / 90 + 40, 2) - 0.5) * 46;
    let e = this.nE(wx / 150, wy / 150, 5);
    e = e * 0.72 + this.nE(wx / 38, wy / 38, 3) * 0.28;
    // The hub sits on dependable dry ground — lifted clear of water, but not
    // so far that the start zone turns into highlands.
    const d = Math.hypot(x, y);
    if (d < 100) {
      const k = 1 - d / 100;
      e = e * (1 - k * 0.55) + 0.46 * k;
    }
    return Math.max(0, Math.min(1, e));
  }
  moisture(x: number, y: number) { return this.nM(x / 130, y / 130, 4); }
  temperature(x: number, y: number) { return this.nT(x / 170, y / 170, 3); }
  /** How far the Hollow has eaten into the land; drives tier and enemy density. */
  blight(x: number, y: number) {
    const d = Math.hypot(x, y);
    return Math.min(1, this.nD(x / 110, y / 110, 3) * 0.55 + Math.min(1, d / 620) * 0.6);
  }

  biomeAt(x: number, y: number): Biome {
    const site = this.siteNear(x, y);
    if (site?.biome) return site.biome;
    const e = this.elevation(x, y);
    if (e < 0.325) return 'lowland';
    if (e > 0.715) return 'bonehill';
    const m = this.moisture(x, y), t = this.temperature(x, y);
    if (m > 0.615) return t < 0.5 ? 'fen' : 'rotwood';
    if (m < 0.385) return t > 0.545 ? 'cinder' : 'moor';
    return 'palewood';
  }

  /** Danger tier at a position: biome base lifted by distance from the hub. */
  tierAt(x: number, y: number) {
    const b = BIOMES[this.biomeAt(x, y)];
    const d = Math.hypot(x, y);
    return Math.min(9, b.tier + Math.floor(d / 150));
  }

  isWater(x: number, y: number) {
    return this.elevation(x, y) < 0.3 && !this.siteNear(x, y);
  }

  // ----------------------------------------------------------- structures
  /** All structures whose footprint might touch this chunk. */
  structsNear(cx: number, cy: number): PlacedStruct[] {
    const out: PlacedStruct[] = [];
    const r0x = Math.floor((cx * CHUNK) / REGION) - 1, r0y = Math.floor((cy * CHUNK) / REGION) - 1;
    for (let ry = r0y; ry <= r0y + 2; ry++) for (let rx = r0x; rx <= r0x + 2; rx++) {
      const s = this.structAtRegion(rx, ry);
      if (s) out.push(s);
    }
    // Story sites always win their ground.
    for (const site of this.sites) {
      const def = STRUCTS[site.struct];
      if (!def) continue;
      const sx = site.x - (def.w >> 1), sy = site.y - (def.h >> 1);
      if (sx + def.w < cx * CHUNK - 2 || sx > (cx + 1) * CHUNK + 2) continue;
      if (sy + def.h < cy * CHUNK - 2 || sy > (cy + 1) * CHUNK + 2) continue;
      for (let i = out.length - 1; i >= 0; i--) if (Math.abs(out[i].x - sx) < def.w && Math.abs(out[i].y - sy) < def.h) out.splice(i, 1);
      out.push({ id: site.struct, x: sx, y: sy, w: def.w, h: def.h, seed: hash2(site.x, site.y, this.seed), name: site.name, story: site.id });
    }
    return out;
  }

  private structAtRegion(rx: number, ry: number): PlacedStruct | null {
    const h = hash2(rx, ry, this.seed + 909);
    const r = mulberry32(h);
    const cxTile = rx * REGION, cyTile = ry * REGION;
    if (r() > 0.5) return null;
    const probe = { x: cxTile + (REGION >> 1), y: cyTile + (REGION >> 1) };
    if (this.isWater(probe.x, probe.y)) return null;
    const biome = this.biomeAt(probe.x, probe.y);
    const id = pickW(r, BIOMES[biome].structures);
    const def = STRUCTS[id];
    if (!def) return null;
    // Centre it with enough margin that neighbouring regions can never collide.
    const mx = Math.max(2, (REGION - def.w) >> 1), my = Math.max(2, (REGION - def.h) >> 1);
    const sx = cxTile + mx + Math.floor(r() * Math.max(1, REGION - def.w - mx * 2 + 1));
    const sy = cyTile + my + Math.floor(r() * Math.max(1, REGION - def.h - my * 2 + 1));
    const cx2 = sx + (def.w >> 1), cy2 = sy + (def.h >> 1);
    if (this.sites.some(s => Math.hypot(cx2 - s.x, cy2 - s.y) < s.radius + Math.max(def.w, def.h))) return null;
    if (this.isWater(cx2, cy2)) return null;
    return { id, x: sx, y: sy, w: def.w, h: def.h, seed: h, name: def.name };
  }

  // ---------------------------------------------------------------- roads
  /** Jittered node position for a road-graph cell. */
  private roadNode(gx: number, gy: number) {
    const r = rngAt(gx, gy, this.seed + 404);
    return { x: gx * ROAD_CELL + Math.floor(r() * ROAD_CELL), y: gy * ROAD_CELL + Math.floor(r() * ROAD_CELL) };
  }
  private roadSegments(cx: number, cy: number) {
    const segs: [number, number, number, number][] = [];
    const g0x = Math.floor((cx * CHUNK) / ROAD_CELL) - 1, g0y = Math.floor((cy * CHUNK) / ROAD_CELL) - 1;
    for (let gy = g0y; gy <= g0y + 2; gy++) for (let gx = g0x; gx <= g0x + 2; gx++) {
      const a = this.roadNode(gx, gy);
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]] as const) {
        if (hash2(gx, gy, this.seed + 505 + dx * 7 + dy * 13) % 100 > (dx && dy ? 8 : 40)) continue;
        const b = this.roadNode(gx + dx, gy + dy);
        segs.push([a.x, a.y, b.x, b.y]);
      }
    }
    return segs;
  }

  // ---------------------------------------------------------------- chunk
  key(cx: number, cy: number) { return `${cx},${cy}`; }

  get(cx: number, cy: number): Chunk {
    const k = this.key(cx, cy);
    let c = this.cache.get(k);
    if (c) return c;
    c = this.build(cx, cy);
    this.cache.set(k, c);
    if (this.cache.size > 160) {
      // keep memory bounded; distant chunks regenerate identically
      const first = this.cache.keys().next().value;
      if (first !== undefined && first !== k) this.cache.delete(first);
    }
    return c;
  }
  /** Drop cached chunks so edits or a reseed take effect. */
  invalidate() { this.cache.clear(); }

  private build(cx: number, cy: number): Chunk {
    const N = CHUNK * CHUNK;
    const ch: Chunk = {
      cx, cy,
      ground: new Uint8Array(N), variant: new Uint8Array(N), obj: new Uint8Array(N),
      oh: new Uint8Array(N), ov: new Uint8Array(N), biome: new Uint8Array(N), markers: [],
    };
    const ox = cx * CHUNK, oy = cy * CHUNK;
    const idx = (x: number, y: number) => (y - oy) * CHUNK + (x - ox);
    const inside = (x: number, y: number) => x >= ox && y >= oy && x < ox + CHUNK && y < oy + CHUNK;

    // ---- terrain + scatter
    for (let y = oy; y < oy + CHUNK; y++) for (let x = ox; x < ox + CHUNK; x++) {
      const i = idx(x, y);
      const b = this.biomeAt(x, y);
      ch.biome[i] = biomeIndex(b);
      const def = BIOMES[b];
      const e = this.elevation(x, y);
      const r = rngAt(x, y, this.seed + 1);
      if (e < 0.288 && !this.siteNear(x, y)) ch.ground[i] = e < 0.255 ? T.DEEP : T.WATER;
      else if (e < 0.312 && !this.siteNear(x, y)) ch.ground[i] = b === 'bonehill' ? T.STONE : T.SAND;
      else ch.ground[i] = pickW(r, def.ground);
      ch.variant[i] = (hash2(x, y, this.seed + 3) % 4) | 0;
      if (LIQUID.has(ch.ground[i] as T)) continue;
      // scatter
      const dens = 1 + this.blight(x, y) * 0.4;
      for (const [o, p] of def.scatter) {
        if (r() < p * dens) { ch.obj[i] = o; ch.ov[i] = hash2(x, y, this.seed + 5) % 4; ch.oh[i] = 1; break; }
      }
    }

    // ---- roads
    for (const [ax, ay, bx, by] of this.roadSegments(cx, cy)) {
      const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const px = Math.round(ax + (bx - ax) * t + Math.sin(t * 7 + ax) * 1.8);
        const py = Math.round(ay + (by - ay) * t + Math.cos(t * 6 + ay) * 1.8);
        for (let k = 0; k <= 1; k++) for (let j = 0; j <= 1; j++) {
          const qx = px + k, qy = py + j;
          if (!inside(qx, qy)) continue;
          const q = idx(qx, qy);
          if (LIQUID.has(ch.ground[q] as T)) continue;
          ch.ground[q] = T.ROAD;
          ch.obj[q] = O.NONE; ch.oh[q] = 0;
        }
      }
    }

    // ---- structures
    for (const ps of this.structsNear(cx, cy)) {
      const def = STRUCTS[ps.id];
      if (!def) continue;
      const rng: Rng = mulberry32(ps.seed);
      const biome = this.biomeAt(ps.x + (ps.w >> 1), ps.y + (ps.h >> 1));
      // Clear the footprint of scatter first so buildings read as built.
      if (def.clear !== false) {
        for (let y = ps.y - 1; y < ps.y + ps.h + 1; y++) for (let x = ps.x - 1; x < ps.x + ps.w + 1; x++) {
          if (!inside(x, y)) continue;
          const i = idx(x, y);
          ch.obj[i] = O.NONE; ch.oh[i] = 0;
          if (LIQUID.has(ch.ground[i] as T)) ch.ground[i] = T.MUD;
        }
      }
      const ctx: StampCtx = {
        x: ps.x, y: ps.y, w: ps.w, h: ps.h, rng, biome, tier: this.tierAt(ps.x, ps.y),
        put: (x, y, cell: Cell) => {
          if (!inside(x, y)) return;
          const i = idx(x, y);
          if (cell.t !== undefined) ch.ground[i] = cell.t;
          if (cell.o !== undefined) { ch.obj[i] = cell.o; ch.oh[i] = cell.h ?? 1; ch.ov[i] = cell.v ?? (hash2(x, y, ps.seed) % 4); }
          else if (cell.h !== undefined) ch.oh[i] = cell.h;
        },
        mark: (m) => { if (inside(m.x, m.y)) ch.markers.push(m); },
      };
      def.stamp(ctx);

      // Story sites host the bosses, with a fog wall across the approach.
      const boss = BOSS_AT[ps.story ?? ''];
      if (boss) {
        const bx = ps.x + (ps.w >> 1), by = ps.y + (ps.h >> 1);
        if (inside(bx, by)) ch.markers.push({ kind: 'boss', x: bx, y: by, id: boss });
        for (let i = -4; i <= 4; i++) {
          const fx = bx + i, fy = by + (ps.h >> 1) - 2;
          if (!inside(fx, fy)) continue;
          const q = idx(fx, fy);
          if (!ch.obj[q]) { ch.obj[q] = O.FOG_WALL; ch.oh[q] = 3; }
        }
      }
    }

    // ---- player edits win over everything
    for (let y = oy; y < oy + CHUNK; y++) for (let x = ox; x < ox + CHUNK; x++) {
      const kk = packKey(x, y);
      const ed = this.edits.get(kk);
      if (ed !== undefined) { const i = idx(x, y); ch.obj[i] = ed; ch.oh[i] = this.editH.get(kk) ?? 1; }
    }
    return ch;
  }

  // ------------------------------------------------------- tile accessors
  private at(x: number, y: number) {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    const c = this.get(cx, cy);
    return { c, i: (y - cy * CHUNK) * CHUNK + (x - cx * CHUNK) };
  }
  ground(x: number, y: number): T { const { c, i } = this.at(x, y); return c.ground[i] as T; }
  obj(x: number, y: number): O { const { c, i } = this.at(x, y); return c.obj[i] as O; }
  objH(x: number, y: number) { const { c, i } = this.at(x, y); return c.oh[i]; }
  objV(x: number, y: number) { const { c, i } = this.at(x, y); return c.ov[i]; }
  biomeTile(x: number, y: number): Biome { const { c, i } = this.at(x, y); return biomeOf(c.biome[i]); }

  setObj(x: number, y: number, o: O, h = 1) {
    const kk = packKey(x, y);
    this.edits.set(kk, o);
    this.editH.set(kk, h);
    const { c, i } = this.at(x, y);
    c.obj[i] = o; c.oh[i] = h;
  }

  walkable(x: number, y: number) {
    const g = this.ground(x, y);
    if (LIQUID.has(g)) return false;
    return !BLOCKING_SET.has(this.obj(x, y));
  }

  /** Nearest standable tile to a target, searched in rings. */
  findOpen(x: number, y: number, maxR = 24) {
    for (let r = 0; r < maxR; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (this.walkable(x + dx, y + dy)) return { x: x + dx, y: y + dy };
      }
    }
    return { x, y };
  }

  serializeEdits() { return Array.from(this.edits.entries()).map(([k, v]) => [k, v, this.editH.get(k) ?? 1] as [number, number, number]); }
  loadEdits(list: [number, number, number][]) {
    this.edits.clear(); this.editH.clear();
    for (const [k, v, h] of list) { this.edits.set(k, v); this.editH.set(k, h); }
    this.invalidate();
  }
}

/** Pack a signed tile coordinate pair into one number key. */
export const packKey = (x: number, y: number) => (x + 0x40000) * 0x80000 + (y + 0x40000);
