import { makeNoise, mulberry32, randInt, pick, type Rng } from './core';
import { BLOCKING, O, T, type NpcId } from './data';

export const W = 100;
export const H = 100;

export interface Stack { id: string; qty: number }
export interface House { x: number; y: number; w: number; h: number; door: [number, number]; owner?: NpcId; name: string; ruined?: boolean }
export interface NpcSpawn { id: NpcId; x: number; y: number; house?: number }

export const VILLAGE = { x: 50, y: 50 };
export const BANDIT_CAMP = { x: 82, y: 18 };
export const CHAPEL = { x: 18, y: 18 };
export const FARMSTEAD = { x: 20, y: 80 };

export class World {
  ground = new Uint8Array(W * H);
  variant = new Uint8Array(W * H);
  obj = new Uint8Array(W * H);
  containers = new Map<number, Stack[]>();
  houses: House[] = [];
  npcs: NpcSpawn[] = [];
  lamps: number[] = [];
  regrow: { i: number; o: O; at: number }[] = [];
  playerStart = { x: 0, y: 0 };
  bossSpawn = { x: CHAPEL.x + 0.5, y: CHAPEL.y - 1.5 };

  constructor(public seed: number) {}

  idx = (x: number, y: number) => y * W + x;
  inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  g = (x: number, y: number) => (this.inBounds(x, y) ? this.ground[this.idx(x, y)] : T.DEEP);
  o = (x: number, y: number) => (this.inBounds(x, y) ? this.obj[this.idx(x, y)] : O.NONE);

  walkable(x: number, y: number) {
    if (!this.inBounds(x, y)) return false;
    const gr = this.ground[this.idx(x, y)];
    if (gr === T.WATER || gr === T.DEEP) return false;
    return !BLOCKING.has(this.obj[this.idx(x, y)]);
  }
  /** Is a float world position inside a house interior? Returns house index or -1. */
  houseAt(x: number, y: number) {
    for (let i = 0; i < this.houses.length; i++) {
      const h = this.houses[i];
      if (x >= h.x + 1 && x < h.x + h.w - 1 && y >= h.y + 1 && y < h.y + h.h - 1) return i;
    }
    return -1;
  }

  generate() {
    const r = mulberry32(this.seed);
    const nz = makeNoise(this.seed + 1);
    const nzF = makeNoise(this.seed + 2);
    const nzW = makeNoise(this.seed + 3);

    // ---- base terrain
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = this.idx(x, y);
      const n = nz(x / 9, y / 9);
      this.ground[i] = n < 0.42 ? T.GRASS2 : n > 0.62 ? T.GRASS3 : T.GRASS;
      this.variant[i] = Math.floor(r() * 4);
    }
    // ---- lakes: one guaranteed + noise ponds
    const lakes: [number, number, number][] = [[74, 74, 8], [31, 31, 4], [86, 64, 5]];
    for (const [lx, ly, lr] of lakes) {
      for (let y = ly - lr - 3; y <= ly + lr + 3; y++) for (let x = lx - lr - 3; x <= lx + lr + 3; x++) {
        if (!this.inBounds(x, y)) continue;
        const d = Math.hypot(x - lx, (y - ly) * 1.1) + (nzW(x / 3, y / 3) - 0.5) * 4;
        const i = this.idx(x, y);
        if (d < lr - 2) this.ground[i] = T.DEEP;
        else if (d < lr) this.ground[i] = T.WATER;
        else if (d < lr + 1.5) this.ground[i] = T.SAND;
      }
    }
    // map border: deep water ring so the world feels like an island valley
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const e = Math.min(x, y, W - 1 - x, H - 1 - y) + (nzW(x / 5, y / 5) - 0.5) * 3;
      if (e < 2) this.ground[this.idx(x, y)] = T.DEEP;
      else if (e < 3.2) this.ground[this.idx(x, y)] = T.WATER;
      else if (e < 4.4) this.ground[this.idx(x, y)] = T.SAND;
    }

    // ---- village plaza
    for (let y = VILLAGE.y - 5; y <= VILLAGE.y + 6; y++) for (let x = VILLAGE.x - 5; x <= VILLAGE.x + 6; x++) {
      const d = Math.hypot(x - VILLAGE.x - 0.5, y - VILLAGE.y - 0.5);
      if (d < 6.2) this.ground[this.idx(x, y)] = T.STONE;
    }
    this.set(VILLAGE.x - 2, VILLAGE.y - 2, O.WELL);

    // ---- houses
    const vx = VILLAGE.x, vy = VILLAGE.y;
    this.addHouse(r, { x: vx - 13, y: vy - 12, w: 6, h: 5, door: [vx - 10, vy - 8], name: 'Your Cottage' }, 'player');
    this.addHouse(r, { x: vx + 6, y: vy - 13, w: 7, h: 6, door: [vx + 9, vy - 8], name: 'Elder\'s Hall', owner: 'elder' }, 'home');
    this.addHouse(r, { x: vx - 13, y: vy + 6, w: 7, h: 6, door: [vx - 10, vy + 6], name: 'Trading Post', owner: 'merchant' }, 'shop');
    this.addHouse(r, { x: vx + 7, y: vy + 7, w: 7, h: 6, door: [vx + 10, vy + 7], name: 'Guard House', owner: 'captain' }, 'home');
    this.addHouse(r, { x: vx - 22, y: vy - 9, w: 6, h: 5, door: [vx - 17, vy - 7], name: 'Hunter\'s Lodge', owner: 'hunter' }, 'home');
    this.addHouse(r, { x: vx + 15, y: vy + 2, w: 6, h: 5, door: [vx + 15, vy + 4], name: 'Herbalist\'s Hut', owner: 'herbalist' }, 'home');
    this.addHouse(r, { x: vx - 8, y: vy - 22, w: 6, h: 5, door: [vx - 5, vy - 18], name: 'Empty House' }, 'home');
    this.addHouse(r, { x: FARMSTEAD.x - 3, y: FARMSTEAD.y - 2, w: 7, h: 5, door: [FARMSTEAD.x, FARMSTEAD.y - 2], name: 'Abandoned Farmstead', ruined: true }, 'ruin');

    // ---- roads
    const road = (x: number, y: number) => {
      if (!this.inBounds(x, y)) return;
      const gr = this.g(x, y);
      if (gr === T.DEEP || gr === T.WATER || gr === T.FLOOR || gr === T.STONE || this.o(x, y) !== O.NONE) return;
      this.ground[this.idx(x, y)] = T.DIRT;
    };
    const path = (ax: number, ay: number, bx: number, by: number, wobble = 0) => {
      let x = ax, y = ay;
      const pr = mulberry32(ax * 31 + ay * 17 + bx);
      while (x !== bx || y !== by) {
        road(x, y); road(x + 1, y); road(x, y + 1);
        if (x !== bx && (y === by || pr() < 0.5 + wobble)) x += Math.sign(bx - x);
        else y += Math.sign(by - y);
      }
    };
    path(8, 50, 92, 50, 0); path(50, 8, 50, 92, 0);
    path(50, 50, BANDIT_CAMP.x, BANDIT_CAMP.y, 0.1);
    path(50, 50, CHAPEL.x + 2, CHAPEL.y + 6, -0.1);
    path(50, 50, FARMSTEAD.x + 2, FARMSTEAD.y - 4, 0.05);

    for (const [x, y] of [[vx - 6, vy - 6], [vx + 7, vy - 6], [vx - 6, vy + 7], [vx + 7, vy + 7], [vx - 1, vy - 8], [vx - 1, vy + 9], [vx - 9, vy + 1], [vx + 10, vy + 1]]) {
      if (this.o(x, y) === O.NONE && this.g(x, y) !== T.FLOOR) { this.set(x, y, O.LAMP); this.lamps.push(this.idx(x, y)); }
    }
    // villagers on the plaza
    this.npcs.push({ id: 'villager', x: vx + 2.5, y: vy + 2.5 }, { id: 'villager', x: vx - 3.5, y: vy + 3.5 });

    // farm fields
    for (let y = vy + 16; y <= vy + 23; y++) for (let x = vx + 3; x <= vx + 13; x++) {
      if (x === vx + 3 || x === vx + 13 || y === vy + 16 || y === vy + 23) { if (x !== vx + 8) this.set(x, y, O.FENCE); }
      else this.ground[this.idx(x, y)] = T.FARM;
    }

    // ---- bandit camp
    {
      const { x: cx, y: cy } = BANDIT_CAMP;
      for (let y = cy - 7; y <= cy + 7; y++) for (let x = cx - 7; x <= cx + 7; x++) if (Math.hypot(x - cx, y - cy) < 6.5 && this.g(x, y) !== T.DEEP) this.ground[this.idx(x, y)] = T.DIRT;
      this.set(cx, cy, O.CAMPFIRE);
      for (const [dx, dy] of [[-4, -3], [3, -4], [-4, 3], [4, 2]]) this.set(cx + dx, cy + dy, O.TENT);
      this.addContainer(r, cx - 2, cy - 5, O.CRATE, 'bandit');
      this.addContainer(r, cx + 5, cy - 1, O.CRATE, 'bandit');
      this.addContainer(r, cx + 1, cy + 5, O.BARREL, 'bandit');
      this.addContainer(r, cx - 5, cy, O.CHEST, 'banditchest');
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const x = Math.round(cx + Math.cos(a) * 7.5), y = Math.round(cy + Math.sin(a) * 7.5);
        if (i % 3 !== 0 && this.g(x, y) !== T.DEEP && this.g(x, y) !== T.WATER && this.g(x, y) !== T.DIRT) this.set(x, y, O.FENCE);
      }
    }

    // ---- hollow chapel ruin
    {
      const { x: cx, y: cy } = CHAPEL;
      for (let y = cy - 6; y <= cy + 5; y++) for (let x = cx - 5; x <= cx + 5; x++) this.ground[this.idx(x, y)] = T.STONE;
      for (let y = cy - 6; y <= cy + 5; y++) for (let x = cx - 5; x <= cx + 5; x++) {
        const edge = x === cx - 5 || x === cx + 5 || y === cy - 6 || y === cy + 5;
        if (edge && !(y === cy + 5 && Math.abs(x - cx) <= 1) && r() < 0.72) this.set(x, y, O.RUIN);
      }
      this.set(cx, cy - 4, O.ALTAR);
      this.addContainer(r, cx + 3, cy - 4, O.CHEST, 'chapel');
      for (let i = 0; i < 14; i++) {
        const x = cx - 9 + randInt(r, 0, 18), y = cy + 6 + randInt(r, 0, 5);
        if (this.o(x, y) === O.NONE && this.g(x, y) !== T.DIRT) this.set(x, y, O.GRAVE);
      }
    }

    // ---- clearings (no trees)
    const clear = [
      [VILLAGE.x, VILLAGE.y, 26], [BANDIT_CAMP.x, BANDIT_CAMP.y, 9], [CHAPEL.x, CHAPEL.y, 10], [FARMSTEAD.x, FARMSTEAD.y, 7],
    ];
    const inClearing = (x: number, y: number) => clear.some(([cx, cy, cr]) => Math.hypot(x - cx, y - cy) < cr);

    // ---- forest + flora
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = this.idx(x, y);
      const gr = this.ground[i];
      if (this.obj[i] !== O.NONE || gr === T.WATER || gr === T.DEEP || gr === T.DIRT || gr === T.STONE || gr === T.FARM || gr === T.FLOOR) continue;
      if (inClearing(x, y)) {
        const villageEdge = Math.hypot(x - VILLAGE.x, y - VILLAGE.y) > 18;
        if (villageEdge && r() < 0.03) this.obj[i] = O.TREE;
        else if (r() < 0.012) this.obj[i] = O.BUSH;
        continue;
      }
      if (gr === T.SAND) { if (r() < 0.03) this.obj[i] = O.ROCK; continue; }
      const f = nzF(x / 11, y / 11);
      const northBias = y < 40 ? 0.08 : 0;
      const density = Math.max(0, (f - 0.38) * 1.3 + northBias);
      const roll = r();
      if (roll < density * 0.75) this.obj[i] = (y < 45 || f > 0.66) && r() < 0.6 ? O.PINE : O.TREE;
      else if (roll < density * 0.75 + 0.025) this.obj[i] = O.BUSH;
      else if (roll < density * 0.75 + 0.04) this.obj[i] = O.HERB;
      else if (roll < density * 0.75 + 0.05) this.obj[i] = O.ROCK;
    }
    // keep road shoulders passable
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (this.g(x, y) === T.DIRT) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const o = this.o(x + dx, y + dy);
        if (o === O.TREE || o === O.PINE) this.obj[this.idx(x + dx, y + dy)] = O.NONE;
      }
    }

    // NPC spawns inside their houses
    this.houses.forEach((h, hi) => {
      if (h.owner) this.npcs.push({ id: h.owner, x: h.x + h.w / 2, y: h.y + h.h / 2, house: hi });
    });
    const ph = this.houses[0];
    this.playerStart = { x: ph.x + 2.5, y: ph.y + 2.5 };
  }

  set(x: number, y: number, o: O) { if (this.inBounds(x, y)) this.obj[this.idx(x, y)] = o; }

  private addHouse(r: Rng, h: House, kind: 'player' | 'home' | 'shop' | 'ruin') {
    for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) {
      const i = this.idx(x, y);
      this.ground[i] = T.FLOOR;
      this.obj[i] = O.NONE;
      const edge = x === h.x || y === h.y || x === h.x + h.w - 1 || y === h.y + h.h - 1;
      if (edge && !(x === h.door[0] && y === h.door[1])) {
        if (!h.ruined || r() < 0.65) this.obj[i] = h.ruined ? O.RUIN : O.WALL;
      }
    }
    // path from door outwards
    const [dx, dy] = h.door;
    const outX = dx === h.x ? -1 : dx === h.x + h.w - 1 ? 1 : 0;
    const outY = dy === h.y ? -1 : dy === h.y + h.h - 1 ? 1 : 0;
    for (let k = 1; k <= 2; k++) { const x = dx + outX * k, y = dy + outY * k; if (this.inBounds(x, y)) { this.ground[this.idx(x, y)] = T.DIRT; this.obj[this.idx(x, y)] = O.NONE; } }

    // furnish interior: back wall gets cupboard/bed
    const ix0 = h.x + 1, iy0 = h.y + 1, ix1 = h.x + h.w - 2, iy1 = h.y + h.h - 2;
    const free = (x: number, y: number) => this.obj[this.idx(x, y)] === O.NONE && Math.abs(x - dx) + Math.abs(y - dy) > 1;
    const lootKind = kind === 'shop' ? 'shop' : kind === 'ruin' ? 'ruin' : kind === 'player' ? 'player' : 'house';
    if (free(ix0, iy0)) this.addContainer(r, ix0, iy0, O.CUPBOARD, lootKind);
    if (free(ix1, iy0)) this.set(ix1, iy0, O.BED);
    if (free(ix0, iy1)) this.addContainer(r, ix0, iy1, O.CRATE, kind === 'player' ? 'playercrate' : lootKind);
    if (h.w >= 7 && free(ix0 + 2, iy0 + 1)) this.set(ix0 + 2, iy0 + 1, O.TABLE);
    this.houses.push(h);
  }

  private addContainer(r: Rng, x: number, y: number, kind: O, table: string) {
    this.set(x, y, kind);
    this.containers.set(this.idx(x, y), rollLoot(r, table));
  }
}

const LOOT: Record<string, [string, number, number, number][]> = {
  house: [['bread', 0.5, 1, 2], ['apple', 0.5, 1, 3], ['water', 0.5, 1, 2], ['bottle', 0.3, 1, 1], ['cloth', 0.5, 1, 3], ['bandage', 0.3, 1, 1], ['ale', 0.2, 1, 1], ['gold', 0.4, 2, 10]],
  player: [['bread', 1, 2, 2], ['water', 1, 2, 2], ['bandage', 1, 1, 1], ['apple', 1, 2, 2]],
  playercrate: [['axe', 1, 1, 1], ['wood', 1, 2, 2], ['stone', 1, 2, 2], ['cloth', 1, 2, 2]],
  shop: [['cloth', 0.8, 2, 4], ['bottle', 0.7, 1, 2], ['stone', 0.4, 1, 3]],
  ruin: [['cloth', 0.6, 1, 3], ['bottle', 0.5, 1, 2], ['club', 0.4, 1, 1], ['herb', 0.4, 1, 2], ['gold', 0.6, 5, 20], ['tonic', 0.3, 1, 1]],
  bandit: [['gold', 0.8, 5, 25], ['ale', 0.5, 1, 2], ['bread', 0.4, 1, 2], ['cloth', 0.5, 1, 3], ['token', 0.4, 1, 1], ['bandage', 0.4, 1, 2]],
  banditchest: [['gold', 1, 30, 60], ['spear', 1, 1, 1], ['tonic', 1, 1, 2], ['token', 1, 1, 1]],
  chapel: [['gold', 1, 40, 80], ['tonic', 1, 2, 3], ['ecto', 1, 2, 3]],
};

export function rollLoot(r: Rng, table: string): Stack[] {
  const out: Stack[] = [];
  for (const [id, ch, a, b] of LOOT[table] ?? []) if (r() < ch) out.push({ id, qty: randInt(r, a, b) });
  if (!out.length && table === 'house') out.push({ id: pick(r, ['cloth', 'apple', 'bottle']), qty: 1 });
  return out;
}
