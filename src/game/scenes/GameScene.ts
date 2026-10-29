import * as Phaser from 'phaser';
import { TW, TH, toScreen, toWorld, depthOf, clamp, dist, mulberry32, randInt } from '../core';
import { CONTAINERS, ITEMS, MOBS, NPCS, O, OBJ_NAMES, QUESTS, T, TALL, type MobDef, type NpcId, type Recipe, type Skill } from '../data';
import { World, W, H, VILLAGE, BANDIT_CAMP, CHAPEL, type Stack } from '../world';
import {
  addItem, carryWeight, clearSave, countItem, decodeBytes, encodeBytes, loadGame, maxCarry, newPlayer, removeItem,
  saveGame, skillXpFor, xpForLevel, type PlayerState,
} from '../state';
import { sfx } from '../sfx';
import type { UIScene } from './UIScene';

const MIN_PER_SEC = 2; // game minutes per real second (a day ≈ 12 real minutes)
const OBJ_TEX: Partial<Record<O, string>> = {
  [O.WALL]: 'wall', [O.RUIN]: 'ruin', [O.TREE]: 'tree', [O.PINE]: 'pine', [O.BUSH]: 'bush', [O.BUSH_EMPTY]: 'bush_empty',
  [O.ROCK]: 'rock', [O.CRATE]: 'crate', [O.CUPBOARD]: 'cupboard', [O.BED]: 'bed', [O.WELL]: 'well', [O.FENCE]: 'fence',
  [O.CAMPFIRE]: 'campfire', [O.TABLE]: 'table', [O.STUMP]: 'stump', [O.LAMP]: 'lamp', [O.TENT]: 'tent', [O.BARREL]: 'barrel',
  [O.GRAVE]: 'grave', [O.ALTAR]: 'altar', [O.HERB]: 'herb', [O.CHEST]: 'chest',
};
/** Optional coded-sprite overrides for props (from the asset-generation pipeline). */
const OBJ_SPRITE: Partial<Record<O, string>> = { [O.TREE]: 'tree_oak_idle_0', [O.PINE]: 'tree_pine_idle_0', [O.BUSH]: 'bush_berries', [O.BUSH_EMPTY]: 'bush_idle_0', [O.ROCK]: 'rock_idle_0' };

type Anim = 'front' | 'back' | 'side';

export class Actor {
  x: number; y: number;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  label?: Phaser.GameObjects.Text;
  bar?: Phaser.GameObjects.Graphics;
  anim: Anim = 'front';
  frame = 0; frameT = 0; moving = false; flip = false;
  hp = 1; maxHp = 1;
  vx = 0; vy = 0;
  // AI
  def?: MobDef; npc?: NpcId; home = { x: 0, y: 0 }; wanderT = 0; target: { x: number; y: number } | null = null;
  cd = 0; provoked = false; dead = false; hurtT = 0; leash = 22; bob = 0; house = -1;
  constructor(public scene: GameScene, public base: string, x: number, y: number, public kind: 'player' | 'npc' | 'mob') {
    this.x = x; this.y = y;
    this.shadow = scene.add.image(0, 0, 'shadow');
    this.sprite = scene.add.image(0, 0, scene.frameKey(base, 'front', 0)).setOrigin(0.5, 1);
    this.home = { x, y };
    this.sync();
  }
  get speedMul() { return 1; }
  setAnimFromVelocity(dx: number, dy: number) {
    const sdx = dx - dy, sdy = (dx + dy) / 2;
    let a: Anim;
    if (Math.abs(sdx) > Math.abs(sdy) * 1.1) a = 'side';
    else a = sdy > 0 ? 'front' : 'back';
    if (!this.scene.hasAnim(this.base, a)) a = this.scene.hasAnim(this.base, 'side') ? 'side' : 'front';
    if (a === 'side' || !this.scene.hasAnim(this.base, 'back')) this.flip = sdx < 0;
    else this.flip = false;
    this.anim = a;
  }
  sync() {
    const s = toScreen(this.x, this.y);
    const bob = this.def?.id === 'wraith' ? Math.sin(this.bob) * 3 - 6 : 0;
    this.sprite.setPosition(Math.round(s.x), Math.round(s.y + bob));
    this.sprite.setDepth(depthOf(this.x, this.y) + 5);
    this.sprite.setFlipX(this.flip);
    const n = this.scene.frameCount(this.base, this.anim);
    const f = this.moving ? this.frame % n : 0;
    const key = this.scene.frameKey(this.base, this.anim, f);
    if (this.sprite.texture.key !== key) this.sprite.setTexture(key);
    this.shadow.setPosition(s.x, s.y).setDepth(depthOf(this.x, this.y) + 4);
    this.shadow.setScale(this.sprite.width / 30, 1);
    if (this.label) this.label.setPosition(s.x, s.y - this.sprite.height - 6).setDepth(1e7);
    if (this.bar) {
      this.bar.clear();
      if (this.hp < this.maxHp && !this.dead) {
        const w = Math.max(24, this.sprite.width * 0.8);
        const bx = s.x - w / 2, by = s.y - this.sprite.height - 8;
        this.bar.fillStyle(0x000000, 0.6).fillRect(bx - 1, by - 1, w + 2, 5);
        this.bar.fillStyle(this.def?.id === 'knight' ? 0x40e0c0 : 0xc83030, 1).fillRect(bx, by, w * (this.hp / this.maxHp), 3);
      }
      this.bar.setDepth(1e7);
    }
  }
  destroy() { this.sprite.destroy(); this.shadow.destroy(); this.label?.destroy(); this.bar?.destroy(); }
}

export class GameScene extends Phaser.Scene {
  world!: World;
  P!: PlayerState;
  player!: Actor;
  mobs: Actor[] = [];
  npcs: Actor[] = [];
  minutes = 8 * 60;
  ui!: UIScene;
  objSprites = new Map<number, Phaser.GameObjects.Image>();
  roofs: { img: Phaser.GameObjects.Image; house: number }[] = [];
  flames = new Map<number, { flame: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image }>();
  lampGlows: Phaser.GameObjects.Image[] = [];
  faded = new Set<Phaser.GameObjects.Image>();
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  chop = new Map<number, number>();
  attackCd = 0;
  facing = { x: 1, y: 1 };
  dead = false;
  bossSpawned = false;
  bossDead = false;
  banditRespawnAt = 0;
  spawnT = 0; fadeT = 0; promptT = 0;
  rng = mulberry32(Date.now() & 0xffffff);
  interactTarget: null | { kind: 'obj'; i: number } | { kind: 'npc'; a: Actor } | { kind: 'water' } = null;
  sleeping = false;
  rain = 0; rainTarget = 0; weatherT = 0;
  frameCounts = new Map<string, number>();
  selector!: Phaser.GameObjects.Image;

  constructor() { super('game'); }

  // ---------- sprite helpers ----------
  frameKey(base: string, anim: string, f: number) {
    const k = `${base}_${anim}_${f}`;
    if (this.textures.exists(k)) return k;
    for (const a of ['side', 'front']) if (this.textures.exists(`${base}_${a}_0`)) return `${base}_${a}_0`;
    return 'px';
  }
  hasAnim(base: string, anim: string) { return this.textures.exists(`${base}_${anim}_0`); }
  frameCount(base: string, anim: string) {
    const k = base + anim;
    let n = this.frameCounts.get(k);
    if (n === undefined) { n = 0; while (this.textures.exists(`${base}_${anim}_${n}`)) n++; n = Math.max(1, n); this.frameCounts.set(k, n); }
    return n;
  }

  create(data: { load?: boolean }) {
    this.mobs = []; this.npcs = []; this.objSprites.clear(); this.roofs = []; this.flames.clear(); this.lampGlows = []; this.faded.clear();
    this.dead = false; this.bossSpawned = false; this.sleeping = false;
    const save = data?.load ? loadGame() : null;
    const seed = save?.seed ?? 1337;
    this.world = new World(seed);
    this.world.generate();
    if (save) {
      decodeBytes(save.obj, this.world.obj);
      this.world.containers = new Map(save.containers);
      this.world.regrow = save.regrow;
      this.minutes = save.minutes;
      this.P = save.player;
      this.bossDead = save.bossDead;
    } else {
      this.minutes = 8 * 60;
      this.P = newPlayer(this.world.playerStart.x, this.world.playerStart.y);
      this.bossDead = false;
    }

    this.cameras.main.setBackgroundColor('#0e1a24');
    this.buildGround();
    for (let i = 0; i < W * H; i++) this.refreshObj(i);
    this.buildRoofs();
    this.selector = this.add.image(0, 0, 'select').setVisible(false).setDepth(1);

    this.player = new Actor(this, 'player', this.P.x, this.P.y, 'player');
    for (const n of this.world.npcs) this.spawnNpc(n.id, n.x, n.y, n.house ?? -1);
    for (let i = 0; i < 5; i++) this.spawnBandit();

    const cam = this.cameras.main;
    cam.startFollow(this.player.sprite, true, 0.12, 0.12, 0, 20);
    cam.setZoom(1.6);
    cam.setRoundPixels(true);
    const a = toScreen(0, 0), b = toScreen(W, H), l = toScreen(0, H), r = toScreen(W, 0);
    cam.setBounds(l.x - 200, a.y - 300, r.x - l.x + 400, b.y - a.y + 500);

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,E,SPACE,F') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!p.leftButtonDown() || this.dead || this.sleeping || this.ui?.blocksWorldClick()) return;
      const wpt = toWorld(p.worldX, p.worldY);
      this.attack(wpt.x - this.P.x, wpt.y - this.P.y);
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      cam.setZoom(clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 1, 2.6));
    });
    this.input.keyboard!.on('keydown-E', () => this.interact());

    this.scene.launch('ui', { game: this });
    this.ui = this.scene.get('ui') as UIScene;
    this.time.addEvent({ delay: 60000, loop: true, callback: () => this.save(true) });
    if (!save) this.time.delayedCall(400, () => {
      this.ui.log('You wake in your cottage in Hollowmere. The valley has grown dark of late...', '#e8d8a8');
      this.ui.log('Speak to Elder Maren in the hall north-east of the well.', '#e8d8a8');
      this.ui.log('Press H for help. WASD to move, click to attack, E to interact.', '#a8c8e8');
    });
    else this.time.delayedCall(300, () => this.ui.log(`Welcome back. Day ${this.day}.`, '#e8d8a8'));
  }

  get day() { return Math.floor(this.minutes / 1440) + 1; }
  get hour() { return (this.minutes / 60) % 24; }
  /** 0 = full daylight, 1 = deepest night */
  get night() {
    const h = this.hour;
    if (h >= 6.5 && h < 18.5) return 0;
    if (h >= 21 || h < 4.5) return 1;
    if (h >= 18.5) return (h - 18.5) / 2.5;
    return 1 - (h - 4.5) / 2;
  }

  // ---------- world rendering ----------
  buildGround() {
    const bl = this.add.blitter(0, 0, 'ground').setDepth(-10);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = this.world.idx(x, y);
      const s = toScreen(x, y);
      bl.create(s.x - TW / 2, s.y - 1, `${this.world.ground[i]}_${this.world.variant[i]}`);
    }
    // a little shimmer on deep water edges
    this.time.addEvent({ delay: 1600, loop: true, callback: () => bl.setAlpha(1) });
  }

  refreshObj(i: number) {
    const old = this.objSprites.get(i);
    if (old) { old.destroy(); this.objSprites.delete(i); this.faded.delete(old); }
    const fl = this.flames.get(i);
    if (fl) { fl.flame.destroy(); fl.glow.destroy(); this.flames.delete(i); }
    const o = this.world.obj[i] as O;
    if (o === O.NONE) return;
    const x = i % W, y = Math.floor(i / W);
    let key = OBJ_TEX[o];
    const alt = OBJ_SPRITE[o];
    if (alt && this.textures.exists(alt)) key = alt;
    if (!key) return;
    let img: Phaser.GameObjects.Image;
    if (o === O.WALL || o === O.RUIN) {
      const s = toScreen(x + 1, y + 1);
      img = this.add.image(s.x, s.y, key).setOrigin(0.5, 1);
    } else if (o === O.FENCE) {
      const s = toScreen(x + 0.5, y + 0.5);
      img = this.add.image(s.x, s.y + 14, key).setOrigin(0.5, 1);
    } else {
      const s = toScreen(x + 0.5, y + 0.5);
      const jitter = o === O.TREE || o === O.PINE ? ((x * 7 + y * 13) % 9) - 4 : 0;
      img = this.add.image(s.x + jitter, s.y + (o === O.TREE || o === O.PINE ? 8 : 6), key).setOrigin(0.5, 1);
      if ((o === O.TREE || o === O.PINE) && (x + y) % 3 === 0) img.setFlipX(true);
    }
    img.setDepth(depthOf(x + 0.5, y + 0.5) + (o === O.WALL || o === O.RUIN ? 3 : 2));
    this.objSprites.set(i, img);
    if (o === O.CAMPFIRE) this.addFlame(i, x, y);
    if (o === O.LAMP) {
      const s = toScreen(x + 0.5, y + 0.5);
      this.lampGlows.push(this.add.image(s.x, s.y - 60, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(1.6).setDepth(1e6).setAlpha(0));
    }
  }

  addFlame(i: number, x: number, y: number) {
    const s = toScreen(x + 0.5, y + 0.5);
    const flame = this.add.image(s.x, s.y + 2, 'flame').setOrigin(0.5, 1).setDepth(depthOf(x + 0.5, y + 0.5) + 3).setBlendMode(Phaser.BlendModes.ADD);
    const glow = this.add.image(s.x, s.y - 10, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(2.2).setDepth(1e6);
    this.tweens.add({ targets: flame, scaleY: { from: 0.85, to: 1.15 }, scaleX: { from: 1.05, to: 0.9 }, duration: 180, yoyo: true, repeat: -1 });
    this.flames.set(i, { flame, glow });
  }

  buildRoofs() {
    this.world.houses.forEach((h, hi) => {
      if (h.ruined) return;
      const x0 = h.x, y0 = h.y, x1 = h.x + h.w, y1 = h.y + h.h;
      const WH = 44, RH = 26;
      const pts = [toScreen(x0, y0), toScreen(x1, y0), toScreen(x1, y1), toScreen(x0, y1)].map(p => ({ x: p.x, y: p.y - WH }));
      const longX = h.w >= h.h;
      const half = Math.min(h.w, h.h) / 2;
      const r1 = longX ? toScreen(x0 + half, (y0 + y1) / 2) : toScreen((x0 + x1) / 2, y0 + half);
      const r2 = longX ? toScreen(x1 - half, (y0 + y1) / 2) : toScreen((x0 + x1) / 2, y1 - half);
      r1.y -= WH + RH; r2.y -= WH + RH;
      const all = [...pts, r1, r2];
      const minX = Math.min(...all.map(p => p.x)) - 4, minY = Math.min(...all.map(p => p.y)) - 4;
      const maxX = Math.max(...all.map(p => p.x)) + 4, maxY = Math.max(...all.map(p => p.y)) + 4;
      const key = `roof_${hi}`;
      if (this.textures.exists(key)) this.textures.remove(key);
      const tex = this.textures.createCanvas(key, Math.ceil(maxX - minX), Math.ceil(maxY - minY))!;
      const c = tex.getContext();
      const P = (p: { x: number; y: number }) => [p.x - minX, p.y - minY] as const;
      const face = (ps: { x: number; y: number }[], col: string) => {
        c.beginPath(); ps.forEach((p, k) => { const [px, py] = P(p); if (k) c.lineTo(px, py); else c.moveTo(px, py); }); c.closePath();
        c.fillStyle = col; c.fill(); c.strokeStyle = 'rgba(25,15,10,0.8)'; c.stroke();
      };
      const [A, B, C, D] = pts;
      const palette = [['#6a3a2a', '#7a4a32', '#8a5a3a', '#5a3022'], ['#4a4a52', '#5a5a64', '#6a6a74', '#3a3a44'], ['#5a4a2a', '#6a5a32', '#7a6a3a', '#4a3a22']][hi % 3];
      if (longX) {
        face([A, B, r2, r1], palette[0]); face([D, A, r1], palette[3]);
        face([B, C, r2], palette[1]); face([C, D, r1, r2], palette[2]);
      } else {
        face([A, B, r1], palette[0]); face([D, A, r1, r2], palette[3]);
        face([B, C, r2, r1], palette[1]); face([C, D, r2], palette[2]);
      }
      // shingles
      c.strokeStyle = 'rgba(0,0,0,0.18)';
      for (let k = 1; k < 8; k++) {
        const t = k / 8;
        const l = { x: D.x + (r1.x - D.x) * t, y: D.y + (r1.y - D.y) * t }, rr = { x: C.x + (r2.x - C.x) * t, y: C.y + (r2.y - C.y) * t };
        c.beginPath(); c.moveTo(...P(l)); c.lineTo(...P(rr)); c.stroke();
      }
      // chimney
      c.fillStyle = '#5a5a58';
      const [chx, chy] = P(r2);
      c.fillRect(chx - 10, chy - 4, 8, 16);
      tex.refresh();
      const img = this.add.image(minX, minY, key).setOrigin(0, 0).setDepth(depthOf(x1, y1) + 10);
      this.roofs.push({ img, house: hi });
    });
  }

  // ---------- actors ----------
  spawnNpc(id: NpcId, x: number, y: number, house: number) {
    const a = new Actor(this, NPCS[id].sprite, x, y, 'npc');
    a.npc = id; a.house = house; a.leash = house >= 0 ? 1.6 : 5;
    a.label = this.add.text(0, 0, NPCS[id].name, { fontFamily: 'monospace', fontSize: '10px', color: '#f0e6c8', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 1).setResolution(2);
    a.sync();
    this.npcs.push(a);
  }

  spawnMob(id: string, x: number, y: number) {
    const def = MOBS[id];
    const a = new Actor(this, id, x, y, 'mob');
    a.def = def; a.hp = a.maxHp = def.hp;
    a.bar = this.add.graphics();
    a.wanderT = this.rng() * 3;
    if (id === 'wraith') a.sprite.setAlpha(0.85);
    if (id === 'knight') { a.leash = 14; a.label = this.add.text(0, 0, 'THE HOLLOW KNIGHT', { fontFamily: 'monospace', fontSize: '11px', color: '#60ffe0', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 1).setResolution(2); }
    a.sync();
    this.mobs.push(a);
    return a;
  }

  spawnBandit() {
    const { x: cx, y: cy } = BANDIT_CAMP;
    for (let t = 0; t < 30; t++) {
      const x = cx + randInt(this.rng, -5, 5), y = cy + randInt(this.rng, -5, 5);
      if (this.world.walkable(x, y)) { const b = this.spawnMob('bandit', x + 0.5, y + 0.5); b.leash = 10; return; }
    }
  }

  findSpawn(minFromPlayer: number, maxFromPlayer: number, minFromVillage: number, forest = false) {
    for (let t = 0; t < 40; t++) {
      const a = this.rng() * Math.PI * 2, d = minFromPlayer + this.rng() * (maxFromPlayer - minFromPlayer);
      const x = Math.floor(this.P.x + Math.cos(a) * d), y = Math.floor(this.P.y + Math.sin(a) * d);
      if (!this.world.walkable(x, y)) continue;
      const gr = this.world.g(x, y);
      if (gr === T.FLOOR || gr === T.STONE) continue;
      if (dist(x, y, VILLAGE.x, VILLAGE.y) < minFromVillage) continue;
      if (forest) {
        let trees = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const o = this.world.o(x + dx, y + dy); if (o === O.TREE || o === O.PINE) trees++; }
        if (trees < 3) continue;
      }
      return { x: x + 0.5, y: y + 0.5 };
    }
    return null;
  }

  manageSpawns() {
    const count = (id: string) => this.mobs.filter(m => m.def?.id === id && !m.dead).length;
    const night = this.night > 0.6;
    // despawn far wildlife
    for (const m of this.mobs) {
      if (m.dead || m.def?.id === 'bandit' || m.def?.id === 'knight') continue;
      if (dist(m.x, m.y, this.P.x, this.P.y) > 42) this.removeMob(m);
      else if (m.def?.night && !night && this.night < 0.3) this.killMob(m, true);
    }
    const tryAdd = (id: string, cap: number, forest: boolean) => {
      if (count(id) >= cap) return;
      const p = this.findSpawn(16, 32, 20, forest);
      if (p) this.spawnMob(id, p.x, p.y);
    };
    tryAdd('wolf', night ? 12 : 7, true);
    tryAdd('deer', 6, false);
    tryAdd('boar', 5, true);
    if (night) {
      if (count('wraith') < 6) { const p = this.findSpawn(12, 20, 16); if (p) this.spawnMob('wraith', p.x, p.y); }
    }
    if (count('bandit') < 5 && this.minutes > this.banditRespawnAt && dist(this.P.x, this.P.y, BANDIT_CAMP.x, BANDIT_CAMP.y) > 28) {
      this.spawnBandit();
      if (count('bandit') >= 5) this.banditRespawnAt = this.minutes + 1440;
    }
    // chapel guardians
    const dChapel = dist(this.P.x, this.P.y, CHAPEL.x, CHAPEL.y);
    if (dChapel < 30 && !this.bossDead && this.mobs.filter(m => m.def?.id === 'wraith' && dist(m.x, m.y, CHAPEL.x, CHAPEL.y) < 12).length < 2) {
      const x = CHAPEL.x + randInt(this.rng, -6, 6), y = CHAPEL.y + randInt(this.rng, 6, 9);
      if (this.world.walkable(x, y) && dChapel > 10) { const w = this.spawnMob('wraith', x + 0.5, y + 0.5); w.def = { ...MOBS.wraith, night: false }; w.leash = 12; }
    }
    if (!this.bossSpawned && !this.bossDead && dChapel < 13) {
      this.bossSpawned = true;
      this.spawnMob('knight', this.world.bossSpawn.x, this.world.bossSpawn.y);
      sfx.boss();
      this.cameras.main.shake(600, 0.006);
      this.ui.banner('THE HOLLOW KNIGHT AWAKENS', '#60ffe0');
    }
  }

  removeMob(m: Actor) { m.destroy(); this.mobs.splice(this.mobs.indexOf(m), 1); }

  // ---------- movement / collision ----------
  blocked(x: number, y: number, r = 0.26) {
    for (const [dx, dy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) if (!this.world.walkable(Math.floor(x + dx), Math.floor(y + dy))) return true;
    return false;
  }
  moveActor(a: Actor, dx: number, dy: number) {
    let moved = false;
    if (dx && !this.blocked(a.x + dx, a.y)) { a.x += dx; moved = true; }
    if (dy && !this.blocked(a.x, a.y + dy)) { a.y += dy; moved = true; }
    return moved;
  }

  update(_t: number, dtMs: number) {
    const dt = Math.min(dtMs, 50) / 1000;
    if (!this.dead && !this.sleeping) {
      this.advanceTime(dt * MIN_PER_SEC, false);
      this.updatePlayer(dt);
    }
    this.updateMobs(dt);
    this.updateNpcs(dt);
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawnT = 1.5; this.manageSpawns(); }
    this.fadeT -= dt;
    if (this.fadeT <= 0) { this.fadeT = 0.08; this.updateOcclusion(); }
    this.promptT -= dt;
    if (this.promptT <= 0) { this.promptT = 0.12; this.findInteractTarget(); }
    // weather
    this.weatherT -= dt;
    if (this.weatherT <= 0) { this.weatherT = 90 + this.rng() * 120; this.rainTarget = this.rng() < 0.3 ? 0.5 + this.rng() * 0.5 : 0; }
    this.rain += (this.rainTarget - this.rain) * dt * 0.2;
    // glows follow the night
    const n = this.night;
    for (const g of this.lampGlows) g.setAlpha(n * 0.9);
    for (const { glow } of this.flames.values()) glow.setAlpha(0.25 + n * 0.75 + Math.sin(this.time.now / 90) * 0.05);
  }

  advanceTime(min: number, asleep: boolean) {
    const P = this.P;
    const before = this.minutes;
    this.minutes += min;
    const h = min / 60;
    const rate = asleep ? { hunger: 1.6, thirst: 2.2, fatigue: -13 } : { hunger: 3.6, thirst: this.rain > 0.3 ? 4 : 5, fatigue: 4.2 };
    P.hunger = clamp(P.hunger + rate.hunger * h, 0, 100);
    P.thirst = clamp(P.thirst + rate.thirst * h, 0, 100);
    P.fatigue = clamp(P.fatigue + rate.fatigue * h, 0, 100);
    if (P.bleeding) P.hp -= 14 * h;
    if (P.hunger >= 95) P.hp -= 6 * h;
    if (P.thirst >= 95) P.hp -= 8 * h;
    if (!P.bleeding && P.hunger < 75 && P.thirst < 75) P.hp += (asleep ? 6 : 3) * h;
    P.hp = Math.min(P.hp, P.maxHp);
    if (Math.floor(before / 1440) !== Math.floor(this.minutes / 1440)) {
      P.days++;
      this.ui?.log(`Day ${this.day} begins.`, '#e8d8a8');
    }
    // regrowth
    if (this.world.regrow.length) {
      const due = this.world.regrow.filter(r => r.at <= this.minutes);
      if (due.length) {
        this.world.regrow = this.world.regrow.filter(r => r.at > this.minutes);
        for (const r of due) {
          const cur = this.world.obj[r.i] as O;
          if (cur === O.NONE || cur === O.BUSH_EMPTY || cur === O.STUMP) { this.world.obj[r.i] = r.o; this.refreshObj(r.i); }
        }
      }
    }
    if (P.hp <= 0 && !this.dead) this.die(P.bleeding ? 'You bled out.' : P.thirst >= 95 ? 'You died of thirst.' : 'You starved.');
  }

  updatePlayer(dt: number) {
    const P = this.P, k = this.keys;
    let mx = 0, my = 0;
    if (!this.ui.blocksMovement()) {
      if (k.W.isDown || k.UP.isDown) { mx -= 1; my -= 1; }
      if (k.S.isDown || k.DOWN.isDown) { mx += 1; my += 1; }
      if (k.A.isDown || k.LEFT.isDown) { mx -= 1; my += 1; }
      if (k.D.isDown || k.RIGHT.isDown) { mx += 1; my -= 1; }
    }
    const len = Math.hypot(mx, my);
    const a = this.player;
    const tired = P.fatigue > 85 ? 0.75 : 1;
    const over = carryWeight(P) > maxCarry(P) ? 0.6 : 1;
    const maxSt = P.maxStamina * (P.fatigue > 80 ? 0.6 : 1);
    if (len > 0) {
      mx /= len; my /= len;
      this.facing = { x: mx, y: my };
      const sprint = k.SHIFT.isDown && P.stamina > 3 && over === 1;
      const speed = (sprint ? 4.6 : 3.0) * tired * over * (P.hp < 25 ? 0.8 : 1);
      if (sprint) P.stamina -= 18 * dt;
      a.moving = this.moveActor(a, mx * speed * dt, my * speed * dt);
      a.setAnimFromVelocity(mx, my);
      a.frameT += dt * (sprint ? 1.6 : 1);
      if (a.frameT > 0.14) { a.frameT = 0; a.frame++; }
    } else a.moving = false;
    if (!k.SHIFT.isDown || len === 0) P.stamina = Math.min(maxSt, P.stamina + 14 * dt);
    P.stamina = clamp(P.stamina, 0, maxSt);
    P.x = a.x; P.y = a.y;
    this.attackCd -= dt * 1000;
    if ((Phaser.Input.Keyboard.JustDown(k.SPACE) || Phaser.Input.Keyboard.JustDown(k.F)) && !this.ui.blocksMovement()) this.attack(this.facing.x, this.facing.y);
    if (a.hurtT > 0) { a.hurtT -= dt; a.sprite.setTint(0xff8080); if (a.hurtT <= 0) a.sprite.clearTint(); }
    a.sync();
  }

  updateMobs(dt: number) {
    const P = this.P;
    for (const m of [...this.mobs]) {
      if (m.dead) continue;
      const def = m.def!;
      const d = dist(m.x, m.y, P.x, P.y);
      let tx = 0, ty = 0, speed = 0;
      const hostile = def.behavior === 'hostile' || m.provoked;
      const homeD = dist(m.x, m.y, m.home.x, m.home.y);
      if (this.dead || this.sleeping) m.provoked = false;
      if (hostile && !this.dead && !this.sleeping && (d < def.aggro || (m.provoked && d < 16)) && homeD < m.leash + 8) {
        tx = P.x - m.x; ty = P.y - m.y; speed = def.speed;
        if (this.world.houseAt(P.x, P.y) >= 0 && def.id !== 'wraith' && def.id !== 'knight' && d > 2) speed *= 0.6;
        const reach = def.id === 'knight' ? 1.4 : 0.85;
        if (d < reach) {
          speed = 0;
          m.cd -= dt * 1000;
          if (m.cd <= 0) { m.cd = def.cooldown; this.mobAttack(m); }
        } else m.cd = Math.max(m.cd - dt * 1000, 250);
      } else if (def.behavior === 'passive' && d < def.aggro && !this.dead) {
        tx = m.x - P.x; ty = m.y - P.y; speed = def.speed;
      } else {
        m.wanderT -= dt;
        if (homeD > m.leash) m.target = { x: m.home.x, y: m.home.y };
        else if (m.wanderT <= 0) {
          m.wanderT = 2 + this.rng() * 4;
          m.target = this.rng() < 0.4 ? null : { x: m.home.x + (this.rng() - 0.5) * 8, y: m.home.y + (this.rng() - 0.5) * 8 };
        }
        if (m.target) {
          tx = m.target.x - m.x; ty = m.target.y - m.y;
          if (Math.hypot(tx, ty) < 0.3) m.target = null;
          speed = def.speed * 0.35;
        }
        if (homeD > m.leash + 8) speed = def.speed;
      }
      const l = Math.hypot(tx, ty);
      if (l > 0.01 && speed > 0) {
        const vx = (tx / l) * speed * dt, vy = (ty / l) * speed * dt;
        let ok = this.moveActor(m, vx, vy);
        if (!ok) {
          // simple obstacle steering: try perpendicular directions
          ok = this.moveActor(m, -vy, vx) || this.moveActor(m, vy, -vx);
          if (!ok) m.target = null;
        }
        m.moving = ok;
        m.setAnimFromVelocity(tx, ty);
        m.frameT += dt;
        if (m.frameT > 0.13) { m.frameT = 0; m.frame++; }
      } else m.moving = false;
      m.bob += dt * 3;
      if (m.hurtT > 0) { m.hurtT -= dt; m.sprite.setTint(0xff6060); if (m.hurtT <= 0) m.sprite.clearTint(); }
      m.sync();
    }
  }

  updateNpcs(dt: number) {
    for (const n of this.npcs) {
      n.wanderT -= dt;
      const talkingTo = this.ui?.dialogNpc === n;
      if (talkingTo) {
        n.moving = false;
        n.setAnimFromVelocity(this.P.x - n.x, this.P.y - n.y);
      } else if (n.wanderT <= 0) {
        n.wanderT = 2 + this.rng() * 5;
        n.target = this.rng() < 0.5 ? null : { x: n.home.x + (this.rng() - 0.5) * n.leash * 2, y: n.home.y + (this.rng() - 0.5) * n.leash * 2 };
      }
      if (n.target && !talkingTo) {
        const tx = n.target.x - n.x, ty = n.target.y - n.y, l = Math.hypot(tx, ty);
        if (l < 0.2) { n.target = null; n.moving = false; }
        else {
          n.moving = this.moveActor(n, (tx / l) * 1.2 * dt, (ty / l) * 1.2 * dt);
          if (!n.moving) n.target = null;
          n.setAnimFromVelocity(tx, ty);
          n.frameT += dt;
          if (n.frameT > 0.18) { n.frameT = 0; n.frame++; }
        }
      }
      n.sync();
    }
  }

  // ---------- occlusion (Zomboid-style see-through walls & roofs) ----------
  updateOcclusion() {
    const P = this.P;
    const ps = toScreen(P.x, P.y);
    const pd = depthOf(P.x, P.y);
    const now = new Set<Phaser.GameObjects.Image>();
    const px = Math.floor(P.x), py = Math.floor(P.y);
    for (let y = py - 1; y <= py + 5; y++) for (let x = px - 1; x <= px + 5; x++) {
      if (!this.world.inBounds(x, y)) continue;
      const i = this.world.idx(x, y);
      const o = this.world.obj[i] as O;
      if (!TALL.has(o)) continue;
      const img = this.objSprites.get(i);
      if (!img || img.depth < pd) continue;
      const top = img.y - img.height;
      if (Math.abs(img.x - ps.x) < img.width * 0.5 + 10 && ps.y > top && ps.y - 40 < img.y) now.add(img);
    }
    for (const img of this.faded) if (!now.has(img)) img.setAlpha(1);
    for (const img of now) img.setAlpha(0.3);
    this.faded = now;
    const inside = this.world.houseAt(P.x, P.y);
    for (const r of this.roofs) {
      const h = this.world.houses[r.house];
      let target = 1;
      if (r.house === inside) target = 0;
      else {
        const b = r.img.getBounds();
        const behind = P.x < h.x + h.w + 0.3 && P.y < h.y + h.h + 0.3;
        if (behind && ps.x > b.x && ps.x < b.right && ps.y - 30 < b.bottom && ps.y > b.y) target = 0.3;
      }
      r.img.setAlpha(r.img.alpha + (target - r.img.alpha) * 0.35);
    }
  }

  // ---------- combat ----------
  get weaponDef() { return this.P.weapon ? ITEMS[this.P.weapon] : null; }

  attack(dirX: number, dirY: number) {
    if (this.attackCd > 0 || this.dead) return;
    const P = this.P;
    const w = this.weaponDef;
    const dmgBase = w?.dmg ?? 3, range = w?.range ?? 1.0, cd = w?.cooldown ?? 420;
    this.attackCd = cd;
    const l = Math.hypot(dirX, dirY) || 1;
    const ux = dirX / l, uy = dirY / l;
    this.facing = { x: ux, y: uy };
    this.player.setAnimFromVelocity(ux, uy);
    const tiredMul = P.stamina < 6 ? 0.5 : 1;
    P.stamina = Math.max(0, P.stamina - 7);
    sfx.swing();
    this.slashFx(ux, uy, range);
    let hitAny = false;
    for (const m of this.mobs) {
      if (m.dead) continue;
      const dx = m.x - P.x, dy = m.y - P.y, d = Math.hypot(dx, dy);
      const reach = range + (m.def?.id === 'knight' ? 0.6 : 0.25);
      if (d > reach) continue;
      const dot = d < 0.3 ? 1 : (dx * ux + dy * uy) / d;
      if (dot < 0.42) continue;
      hitAny = true;
      const lvl = P.skills.combat.lvl;
      let dmg = (dmgBase + P.str * 1.5) * (1 + lvl * 0.06) * (0.85 + this.rng() * 0.3) * tiredMul;
      const crit = this.rng() < 0.08 + lvl * 0.01;
      if (crit) dmg *= 1.8;
      this.damageMob(m, Math.round(dmg), ux, uy, crit);
    }
    if (hitAny) { this.gainSkill('combat', 4); this.cameras.main.shake(70, 0.002); }
  }

  slashFx(ux: number, uy: number, range: number) {
    const s = toScreen(this.P.x, this.P.y);
    const dir = toScreen(ux, uy);
    const ang = Math.atan2(dir.y, dir.x);
    const g = this.add.graphics().setDepth(1e6);
    const rad = range * 30;
    g.lineStyle(3, 0xffffff, 0.8);
    g.beginPath();
    g.arc(s.x, s.y - 18, rad, ang - 0.9, ang + 0.9);
    g.strokePath();
    g.lineStyle(1, 0xffe0a0, 0.6);
    g.beginPath(); g.arc(s.x, s.y - 18, rad - 5, ang - 0.7, ang + 0.7); g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
  }

  damageMob(m: Actor, dmg: number, ux: number, uy: number, crit: boolean) {
    m.hp -= dmg;
    m.hurtT = 0.15;
    m.provoked = true;
    sfx.hit();
    const kb = m.def?.id === 'knight' ? 0.05 : 0.35;
    this.moveActor(m, ux * kb, uy * kb);
    this.floatText(m.x, m.y, crit ? `${dmg}!` : `${dmg}`, crit ? '#ffd040' : '#ffffff');
    this.blood(m.x, m.y, m.def?.id === 'wraith' || m.def?.id === 'knight' ? 0x40c0b0 : 0x7a1010);
    // pack behaviour: nearby wolves/bandits join
    for (const o of this.mobs) if (o !== m && o.def?.id === m.def?.id && dist(o.x, o.y, m.x, m.y) < 6) o.provoked = true;
    if (m.hp <= 0) this.killMob(m, false);
  }

  killMob(m: Actor, vanish: boolean) {
    if (m.dead) return;
    m.dead = true;
    m.bar?.clear();
    const def = m.def!;
    if (!vanish) {
      const P = this.P;
      for (const [id, ch, a, b] of def.drops) if (this.rng() < ch) {
        const q = randInt(this.rng, a, b);
        addItem(P, id, q);
        this.ui.log(`+${q} ${ITEMS[id].name}`, '#c8e8a8');
      }
      if (def.gold) { const g = randInt(this.rng, def.gold[0], def.gold[1]); P.gold += g; this.ui.log(`+${g} gold`, '#f0d060'); sfx.coin(); }
      P.kills[def.id] = (P.kills[def.id] ?? 0) + 1;
      for (const q of Object.values(QUESTS)) {
        const st = P.quests[q.id];
        if (q.kind === 'kill' && q.target === def.id && st.status === 'active' && st.progress < q.count) {
          st.progress++;
          this.ui.log(`${q.title}: ${st.progress}/${q.count}`, '#e8c878');
        }
      }
      this.gainXp(def.xp);
      if (def.id === 'knight') {
        this.bossDead = true;
        this.ui.banner('THE HOLLOW KNIGHT FALLS', '#60ffe0');
        this.ui.log('You pry the Hollow Heart from its armor. Return it to Elder Maren.', '#60ffe0');
        if (P.quests.relic.status === 'none') P.quests.relic.status = 'active';
        this.save(true);
      }
    }
    this.tweens.add({
      targets: [m.sprite, m.shadow], alpha: 0, angle: vanish ? 0 : 80, duration: vanish ? 1200 : 600,
      onComplete: () => this.removeMob(m),
    });
    this.ui?.refresh();
  }

  mobAttack(m: Actor) {
    const P = this.P, def = m.def!;
    const s = toScreen(m.x, m.y);
    this.tweens.add({ targets: m.sprite, y: s.y - 6, duration: 90, yoyo: true });
    const armor = this.P.armor ? ITEMS[this.P.armor].armor ?? 0 : 0;
    const dmg = Math.max(1, Math.round(def.dmg * (0.8 + this.rng() * 0.4) - armor));
    P.hp -= dmg;
    this.player.hurtT = 0.2;
    sfx.hurt();
    this.cameras.main.shake(100, 0.004);
    this.floatText(P.x, P.y, `-${dmg}`, '#ff6060');
    this.blood(P.x, P.y, 0x7a1010);
    this.ui.hurtFlash();
    if (!P.bleeding && def.bleed && this.rng() < def.bleed) { P.bleeding = true; this.ui.log('You are bleeding! Use a bandage.', '#ff8080'); }
    if (P.hp <= 0) this.die(`Killed by a ${def.name}.`);
  }

  die(reason: string) {
    if (this.dead) return;
    this.dead = true;
    this.P.hp = 0;
    sfx.death();
    this.tweens.add({ targets: this.player.sprite, angle: -90, alpha: 0.6, duration: 800 });
    clearSave();
    this.ui.showDeath(reason);
  }

  floatText(x: number, y: number, str: string, color: string) {
    const s = toScreen(x, y);
    const t = this.add.text(s.x + (this.rng() - 0.5) * 10, s.y - 50, str, { fontFamily: 'monospace', fontSize: '12px', color, stroke: '#000', strokeThickness: 3, fontStyle: 'bold' }).setOrigin(0.5).setDepth(2e7).setResolution(2);
    this.tweens.add({ targets: t, y: t.y - 26, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  blood(x: number, y: number, col: number) {
    const s = toScreen(x, y);
    for (let i = 0; i < 4; i++) {
      const b = this.add.image(s.x + (this.rng() - 0.5) * 20, s.y + (this.rng() - 0.5) * 8, 'px').setTint(col).setScale(1 + this.rng() * 1.5, 0.6 + this.rng()).setDepth(-5).setAlpha(0.85);
      this.tweens.add({ targets: b, alpha: 0, delay: 15000, duration: 4000, onComplete: () => b.destroy() });
    }
  }

  // ---------- progression ----------
  gainXp(n: number) {
    const P = this.P;
    P.xp += n;
    while (P.xp >= xpForLevel(P.level)) {
      P.xp -= xpForLevel(P.level);
      P.level++;
      P.maxHp += 10; P.hp = P.maxHp; P.maxStamina += 5; P.str += 1;
      sfx.level();
      this.ui.banner(`LEVEL ${P.level}`, '#ffe080');
      this.ui.log(`Level up! Max HP ${P.maxHp}, Strength ${P.str}.`, '#ffe080');
    }
    this.ui.refresh();
  }
  gainSkill(s: Skill, n: number) {
    const sk = this.P.skills[s];
    if (sk.lvl >= 10) return;
    sk.xp += n;
    if (sk.xp >= skillXpFor(sk.lvl)) {
      sk.xp -= skillXpFor(sk.lvl); sk.lvl++;
      this.ui.log(`${s[0].toUpperCase() + s.slice(1)} skill increased to ${sk.lvl}.`, '#a8d8ff');
      this.gainXp(10 * sk.lvl);
    }
  }

  // ---------- interaction ----------
  findInteractTarget() {
    if (this.dead) { this.interactTarget = null; this.ui?.setPrompt(null); return; }
    const P = this.P;
    let best: GameScene['interactTarget'] = null, bestD = 1.75, label = '';
    for (const n of this.npcs) {
      const d = dist(n.x, n.y, P.x, P.y);
      if (d < bestD) { bestD = d; best = { kind: 'npc', a: n }; label = `Talk to ${NPCS[n.npc!].name}`; }
    }
    const px = Math.floor(P.x), py = Math.floor(P.y);
    let nearWater = false;
    for (let y = py - 2; y <= py + 2; y++) for (let x = px - 2; x <= px + 2; x++) {
      if (!this.world.inBounds(x, y)) continue;
      const g = this.world.g(x, y);
      const d = dist(x + 0.5, y + 0.5, P.x, P.y);
      if ((g === T.WATER || g === T.DEEP) && d < 1.4) nearWater = true;
      const o = this.world.o(x, y) as O;
      if (!OBJ_NAMES[o] || d >= bestD) continue;
      bestD = d;
      best = { kind: 'obj', i: this.world.idx(x, y) };
      label = this.objLabel(o, this.world.idx(x, y));
    }
    if (!best && nearWater) { best = { kind: 'water' }; label = 'Drink water' + (countItem(P, 'bottle') ? ' / fill bottles' : ''); }
    this.interactTarget = best;
    this.ui?.setPrompt(best ? `[E] ${label}` : null);
    if (best && best.kind === 'obj') {
      const x = best.i % W, y = Math.floor(best.i / W);
      const s = toScreen(x, y);
      this.selector.setPosition(s.x, s.y + TH / 2).setVisible(true);
    } else this.selector.setVisible(false);
  }

  objLabel(o: O, i: number) {
    const name = OBJ_NAMES[o]!;
    if (CONTAINERS.has(o)) return `Search ${name}${(this.world.containers.get(i)?.length ?? 0) === 0 ? ' (empty)' : ''}`;
    switch (o) {
      case O.TREE: case O.PINE: return `Chop ${name}`;
      case O.BUSH: return 'Pick berries';
      case O.HERB: return 'Gather herbs';
      case O.ROCK: return 'Gather stones';
      case O.WELL: return 'Drink from well' + (countItem(this.P, 'bottle') ? ' / fill bottles' : '');
      case O.BED: return 'Sleep';
      case O.CAMPFIRE: return 'Cook at campfire';
      case O.GRAVE: return 'Read gravestone';
      default: return `Inspect ${name}`;
    }
  }

  interact() {
    if (this.dead || this.sleeping || this.ui.blocksMovement()) return;
    const t = this.interactTarget;
    if (!t) return;
    const P = this.P;
    if (t.kind === 'npc') { this.ui.openDialog(t.a); return; }
    if (t.kind === 'water') { this.drink(30); return; }
    const i = t.i, o = this.world.obj[i] as O;
    if (CONTAINERS.has(o)) { this.ui.openLoot(i); return; }
    switch (o) {
      case O.BUSH: {
        const n = 1 + Math.floor(this.rng() * 2) + Math.floor(P.skills.foraging.lvl / 3);
        addItem(P, 'berries', n); sfx.pickup();
        this.ui.log(`Picked ${n} berries.`, '#c8e8a8');
        this.world.obj[i] = O.BUSH_EMPTY; this.refreshObj(i);
        this.world.regrow.push({ i, o: O.BUSH, at: this.minutes + 1440 * 2 });
        this.gainSkill('foraging', 6);
        break;
      }
      case O.HERB: {
        const n = 1 + Math.floor(this.rng() * 2) + Math.floor(P.skills.foraging.lvl / 4);
        addItem(P, 'herb', n); sfx.pickup();
        this.ui.log(`Gathered ${n} herbs.`, '#c8a8e8');
        this.world.obj[i] = O.NONE; this.refreshObj(i);
        this.world.regrow.push({ i, o: O.HERB, at: this.minutes + 1440 * 3 });
        this.gainSkill('foraging', 8);
        break;
      }
      case O.ROCK: {
        addItem(P, 'stone', 2); sfx.chop();
        this.ui.log('Gathered 2 stones.', '#d8d8d0');
        this.world.obj[i] = O.NONE; this.refreshObj(i);
        this.world.regrow.push({ i, o: O.ROCK, at: this.minutes + 1440 * 3 });
        break;
      }
      case O.TREE: case O.PINE: {
        const tool = this.weaponDef?.chop ? this.weaponDef : countItem(P, 'axe') ? ITEMS.axe : null;
        if (!tool) { this.ui.log('You need an axe to chop trees. (Check the crate in your cottage.)', '#e8a878'); return; }
        if (P.stamina < 8) { this.ui.log('Too exhausted to swing.', '#e8a878'); return; }
        P.stamina -= 8;
        sfx.chop();
        const img = this.objSprites.get(i);
        if (img) this.tweens.add({ targets: img, x: img.x + 3, duration: 50, yoyo: true, repeat: 1 });
        const prog = (this.chop.get(i) ?? 0) + (tool.chop ?? 1) + P.skills.woodcutting.lvl * 0.5;
        this.gainSkill('woodcutting', 3);
        if (prog >= 6) {
          this.chop.delete(i);
          const n = 2 + Math.floor(this.rng() * 2);
          addItem(P, 'wood', n);
          this.ui.log(`The tree falls. +${n} logs.`, '#d8b888');
          this.world.obj[i] = O.STUMP; this.refreshObj(i);
          this.world.regrow.push({ i, o, at: this.minutes + 1440 * 4 });
          if (this.rng() < 0.25) { addItem(P, 'apple', 1); this.ui.log('+1 Apple', '#c8e8a8'); }
        } else this.chop.set(i, prog);
        break;
      }
      case O.WELL: this.drink(45); break;
      case O.BED: this.sleep(); break;
      case O.CAMPFIRE: {
        const n = countItem(P, 'raw_meat');
        if (!n) { this.ui.log('The fire crackles. (Cook raw meat here, or brew via the crafting menu [C].)', '#e8c898'); this.ui.openCraft(); return; }
        removeItem(P, 'raw_meat', n); addItem(P, 'cooked_meat', n);
        this.gainSkill('survival', 5 * n);
        this.ui.log(`Cooked ${n} meat.`, '#e8c898');
        break;
      }
      case O.GRAVE: this.ui.log(['"Here lies Old Abel. He went into the woods at night."', '"Taken by the Hollow. Rest now."', '"Beloved mother. The wolves knew no mercy."'][i % 3], '#b8b8c8'); break;
      case O.ALTAR: this.ui.log(this.bossDead ? 'The altar is cold and silent now.' : 'A foul teal light pulses within the stone.', '#60ffe0'); break;
    }
    this.ui.refresh();
  }

  drink(amount: number) {
    const P = this.P;
    P.thirst = Math.max(0, P.thirst - amount);
    sfx.drink();
    const b = countItem(P, 'bottle');
    if (b) { removeItem(P, 'bottle', b); addItem(P, 'water', b); this.ui.log(`You drink deeply and fill ${b} bottle${b > 1 ? 's' : ''}.`, '#a8c8f8'); }
    else this.ui.log('You drink deeply.', '#a8c8f8');
    this.ui.refresh();
  }

  sleep() {
    const P = this.P;
    if (this.mobs.some(m => !m.dead && m.def!.behavior === 'hostile' && dist(m.x, m.y, P.x, P.y) < 12)) { this.ui.log('You can\'t sleep with enemies nearby.', '#ff9080'); return; }
    if (P.fatigue < 20) { this.ui.log('You are not tired enough to sleep.', '#e8d8a8'); return; }
    this.sleeping = true;
    this.ui.fadeSleep(() => {
      let hours = 0;
      while (P.fatigue > 0 && hours < 10) { this.advanceTime(60, true); hours++; }
      for (const m of [...this.mobs]) if (m.def?.night && this.night < 0.3) this.killMob(m, true);
      this.ui.log(`You slept for ${hours} hours.`, '#e8d8a8');
      this.save(true);
    }, () => { this.sleeping = false; });
  }

  // ---------- inventory actions (called by UI) ----------
  useItem(id: string) {
    const P = this.P, d = ITEMS[id];
    if (!d) return;
    if (d.kind === 'weapon') { P.weapon = P.weapon === id ? null : id; sfx.click(); this.ui.log(P.weapon ? `Equipped ${d.name}.` : `Unequipped ${d.name}.`); return; }
    if (d.kind === 'armor') { P.armor = P.armor === id ? null : id; sfx.click(); this.ui.log(P.armor ? `Wearing ${d.name}.` : `Removed ${d.name}.`); return; }
    if (d.kind === 'food' || d.kind === 'drink' || d.kind === 'medical') {
      if (!removeItem(P, id, 1)) return;
      if (d.hunger) P.hunger = clamp(P.hunger + d.hunger, 0, 100);
      if (d.thirst) P.thirst = clamp(P.thirst + d.thirst, 0, 100);
      if (d.fatigue) P.fatigue = clamp(P.fatigue + d.fatigue, 0, 100);
      if (d.heal) P.hp = clamp(P.hp + d.heal, 0, P.maxHp);
      if (d.stopsBleeding && P.bleeding) { P.bleeding = false; this.ui.log('The bleeding stops.', '#c8e8a8'); }
      if (d.leaves) addItem(P, d.leaves, 1);
      (d.kind === 'drink' ? sfx.drink : sfx.eat)();
      this.ui.log(d.kind === 'medical' ? `Used ${d.name}.` : `${d.kind === 'drink' ? 'Drank' : 'Ate'} ${d.name}.`, '#c8e8a8');
      if (id === 'raw_meat') this.ui.log('That was a bad idea. Your stomach churns.', '#e8a878');
      if (P.hp <= 0) this.die('Food poisoning.');
      return;
    }
    this.ui.log(d.desc, '#c8c8c8');
  }

  dropItem(id: string) {
    if (ITEMS[id]?.kind === 'quest') { this.ui.log('You should hold on to that.'); return; }
    if (removeItem(this.P, id, 1)) this.ui.log(`Dropped ${ITEMS[id].name}.`, '#a8a8a8');
  }

  takeFromContainer(ci: number, stackIdx: number, all = false) {
    const list = this.world.containers.get(ci);
    if (!list) return;
    const take = (s: Stack) => { addItem(this.P, s.id, s.qty); this.ui.log(`+${s.qty} ${s.id === 'gold' ? 'gold' : ITEMS[s.id].name}`, s.id === 'gold' ? '#f0d060' : '#c8e8a8'); };
    if (all) { list.forEach(take); list.length = 0; }
    else { const s = list[stackIdx]; if (!s) return; take(s); list.splice(stackIdx, 1); }
    sfx.pickup();
  }

  putToContainer(ci: number, id: string) {
    const list = this.world.containers.get(ci);
    if (!list || ITEMS[id]?.kind === 'quest') return;
    if (!removeItem(this.P, id, 1)) return;
    const s = list.find(s => s.id === id);
    if (s) s.qty++; else list.push({ id, qty: 1 });
    sfx.click();
  }

  canCraft(r: Recipe) {
    const P = this.P;
    if (P.skills.survival.lvl < r.skill) return false;
    if (r.nearFire && !this.nearFire()) return false;
    return Object.entries(r.needs).every(([id, q]) => countItem(P, id) >= q);
  }

  nearFire() {
    const px = Math.floor(this.P.x), py = Math.floor(this.P.y);
    for (let y = py - 2; y <= py + 2; y++) for (let x = px - 2; x <= px + 2; x++) if (this.world.o(x, y) === O.CAMPFIRE) return true;
    return false;
  }

  craft(r: Recipe) {
    if (!this.canCraft(r)) return;
    const P = this.P;
    if (r.out === 'campfire') {
      const tx = Math.floor(P.x + this.facing.x * 1.2), ty = Math.floor(P.y + this.facing.y * 1.2);
      const g = this.world.g(tx, ty);
      if (!this.world.walkable(tx, ty) || this.world.o(tx, ty) !== O.NONE || g === T.FLOOR || (tx === Math.floor(P.x) && ty === Math.floor(P.y))) { this.ui.log('No room for a campfire there. Face an open patch of ground.', '#e8a878'); return; }
      for (const [id, q] of Object.entries(r.needs)) removeItem(P, id, q);
      this.world.set(tx, ty, O.CAMPFIRE); this.refreshObj(this.world.idx(tx, ty));
      this.ui.log('You build a campfire.', '#e8c898');
    } else {
      for (const [id, q] of Object.entries(r.needs)) removeItem(P, id, q);
      addItem(P, r.out, r.qty);
      this.ui.log(`Crafted ${ITEMS[r.out].name}.`, '#c8e8a8');
    }
    sfx.pickup();
    this.gainSkill('survival', 10 + r.skill * 4);
  }

  buy(id: string) {
    const price = ITEMS[id].value;
    if (this.P.gold < price) { this.ui.log('Not enough gold.', '#e8a878'); return; }
    this.P.gold -= price; addItem(this.P, id, 1); sfx.coin();
  }
  sell(id: string) {
    const d = ITEMS[id];
    if (d.kind === 'quest' || d.value <= 0) { this.ui.log('Tobin won\'t buy that.'); return; }
    if (!removeItem(this.P, id, 1)) return;
    this.P.gold += Math.max(1, Math.floor(d.value / 2)); sfx.coin();
  }

  // ---------- save ----------
  save(silent = false) {
    if (this.dead) return;
    const ok = saveGame({
      v: 1, seed: this.world.seed, minutes: this.minutes, player: this.P, obj: encodeBytes(this.world.obj),
      containers: [...this.world.containers.entries()], regrow: this.world.regrow, bossDead: this.bossDead,
    });
    if (!silent) this.ui.log(ok ? 'Game saved.' : 'Could not save.', '#a8c8e8');
  }

  /** Screen-space light sources for the UI darkness pass. */
  getLights() {
    const cam = this.cameras.main;
    const z = cam.zoom;
    const v = cam.worldView;
    const out: { x: number; y: number; r: number }[] = [];
    const push = (wx: number, wy: number, r: number) => {
      if (wx < v.x - r || wx > v.right + r || wy < v.y - r || wy > v.bottom + r) return;
      out.push({ x: (wx - v.x) * z, y: (wy - v.y) * z, r: r * z });
    };
    const ps = toScreen(this.P.x, this.P.y);
    push(ps.x, ps.y - 20, 150 + Math.sin(this.time.now / 300) * 4);
    for (const i of this.world.lamps) { const s = toScreen((i % W) + 0.5, Math.floor(i / W) + 0.5); push(s.x, s.y - 40, 190); }
    for (const [i] of this.flames) { const s = toScreen((i % W) + 0.5, Math.floor(i / W) + 0.5); push(s.x, s.y - 10, 210 + Math.sin(this.time.now / 70 + i) * 8); }
    for (const m of this.mobs) if (!m.dead && (m.def?.id === 'wraith' || m.def?.id === 'knight')) { const s = toScreen(m.x, m.y); push(s.x, s.y - 20, 60); }
    // windows: houses glow faintly at night
    for (const h of this.world.houses) if (!h.ruined) { const s = toScreen(h.x + h.w / 2, h.y + h.h / 2); push(s.x, s.y, 110); }
    return out;
  }
}


