import * as Phaser from 'phaser';
import { TW, TH, toScreen, depthOf, clamp, mulberry32 } from '../core';
import { WorldGen, CHUNK, packKey } from '../world/gen';
import { Streamer } from '../world/stream';
import { BIOMES, CONTAINERS, HARVEST, O, OBJ_NAME, T, type Biome } from '../world/types';
import type { Marker } from '../world/structures';
import { Actor } from '../actor';
import { bakeNow, getBaked, makeGlow, makeLightMask, makeShadow, makeSwatch, pumpBake, bakeQueued, type Baked } from '../art/bake';
import { makeTileAtlas } from '../art/tiles';
import { makeIconAtlas } from '../art/icons';
import { ENEMY_CLIPS, NPC_CLIPS, PLAYER_CLIPS } from '../art/anim';
import { BEASTS, LOOKS } from '../art/looks';
import { bakeBeast } from '../art/bakebeast';
import { P } from '../art/palette';
import type { Look } from '../art/look';
import { ENEMIES, scaled, type Attack, type EnemyDef } from '../content/enemies';
import { BOSSES, type BossDef, type Phase } from '../content/bosses';
import { ITEMS, MOVESETS, type ItemDef } from '../content/items';
import { NPCS, REMNANTS, remnantFor } from '../content/lore';
import { CHAPTERS, currentChapter } from '../content/story';
import {
  addItem, armorTotals, clearSave, itemOf, loadGame, maxHp, maxStam, removeItem,
  newPlayer, saveGame, staminaRegen, talismanMods, weaponPenalty, weaponPower, loadTier,
  type PlayerState, type SaveData,
} from '../state';
import { armorReduction, BACKSTEP, inCone, resolveDamage, ROLL, SPRINT_DRAIN } from '../combat';
import { sfx } from '../sfx';
import type { UIScene } from './UIScene';

const MIN_PER_SEC = 1.2;   // in-game minutes per real second
const PLAYER_KEY = 'bake_player';

interface Projectile {
  img: Phaser.GameObjects.Image;
  x: number; y: number; vx: number; vy: number;
  life: number; dmg: number; impact: number; from: Actor; hostile: boolean;
}
interface Telegraph { g: Phaser.GameObjects.Graphics; t: number; dur: number; x: number; y: number; r: number; col: number }
interface Pickup { img: Phaser.GameObjects.Image; x: number; y: number; id: string; qty: number; t: number }

export class GameScene extends Phaser.Scene {
  gen!: WorldGen;
  stream!: Streamer;
  P!: PlayerState;
  player!: Actor;
  actors: Actor[] = [];
  npcs: Actor[] = [];
  projectiles: Projectile[] = [];
  telegraphs: Telegraph[] = [];
  pickups: Pickup[] = [];
  ui!: UIScene;

  now = 0;
  minutes = 9 * 60;
  killed = new Set<string>();
  spawnedKeys = new Set<string>();

  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  moveX = 0; moveY = 0;
  sprinting = false;
  blocking = false;
  chain = 0; chainT = 0;
  attackQueued: 'light' | 'heavy' | null = null;
  rollT = 0; rollDx = 0; rollDy = 0;
  lockOn: Actor | null = null;
  lockRet!: Phaser.GameObjects.Image;
  interactTarget: null | { kind: string; x: number; y: number; label: string; data?: unknown } = null;

  boss: Actor | null = null;
  bossDef: BossDef | null = null;
  fogWalls = new Map<number, Phaser.GameObjects.Image>();
  pendingBoss: { id: string; x: number; y: number } | null = null;

  dead = false; deadT = 0;
  resting = false;
  rain = 0; rainTarget = 0; weatherT = 20;
  lightSources: { x: number; y: number; r: number }[] = [];
  biome: Biome = 'fen';
  saveT = 0;
  hitStop = 0;

  constructor() { super('game'); }

  // =================================================================== boot
  create(data: { load?: boolean; seed?: number }) {
    this.actors = []; this.npcs = []; this.projectiles = []; this.telegraphs = []; this.pickups = [];
    this.killed.clear(); this.spawnedKeys.clear(); this.fogWalls.clear();
    this.boss = null; this.bossDef = null; this.dead = false; this.deadT = 0; this.resting = false;
    this.now = 0; this.chain = 0; this.lockOn = null; this.hitStop = 0;

    const save = data?.load ? loadGame() : null;
    const seed = save?.seed ?? data?.seed ?? ((Math.random() * 0xffffff) | 0);
    this.gen = new WorldGen(seed);
    if (save) { this.gen.loadEdits(save.edits); this.killed = new Set(save.killed); }

    makeTileAtlas(this);
    makeIconAtlas(this);
    makeShadow(this);
    makeGlow(this, 'glow_warm', P.flame, 96);
    makeGlow(this, 'glow_cold', P.hollow, 80);
    makeLightMask(this);
    makeSwatch(this, 'spark', [255, 255, 255], 3, 3, true);
    makeSwatch(this, 'blood', P.crimson, 3, 3, true);
    makeSwatch(this, 'bolt', P.moonPale, 6, 6, true);
    makeSwatch(this, 'rune', P.goldLit, 5, 5, true);

    this.cameras.main.setBackgroundColor('#090c12');
    this.cameras.main.setRoundPixels(true);

    const start = save ? { x: save.player.x, y: save.player.y } : this.gen.findOpen(0, 2);
    this.P = save ? save.player : newPlayer(start.x + 0.5, start.y + 0.5);
    this.minutes = save?.minutes ?? 9 * 60;

    this.stream = new Streamer(this, this.gen, (ch, markers) => this.onChunkLoaded(ch.cx, ch.cy, markers));
    this.stream.update(this.P.x, this.P.y);

    const baked = this.bakePlayer(true);
    this.player = new Actor(this, { key: PLAYER_KEY, baked, x: this.P.x, y: this.P.y, faction: 'player', hp: maxHp(this.P), name: 'you' });
    this.player.hp = this.P.hp || maxHp(this.P);
    this.player.maxHp = maxHp(this.P);
    this.player.poise = this.player.poiseCur = 18 + armorTotals(this.P).poise;

    this.lockRet = this.add.image(0, 0, 'spark').setDepth(1e6).setVisible(false).setScale(3).setTint(0xffe0a0);

    const cam = this.cameras.main;
    cam.startFollow(this.player.sprite, true, 0.14, 0.14, 0, 14);
    cam.setZoom(1.7);

    this.keys = this.input.keyboard!.addKeys(
      'W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,SPACE,E,R,Q,F,TAB,ONE,TWO,THREE,CTRL',
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown-TAB', (e: KeyboardEvent) => { e.preventDefault(); this.toggleLock(); });
    this.input.keyboard!.on('keydown-E', () => this.interact());
    this.input.keyboard!.on('keydown-R', () => this.drinkFlask());
    this.input.keyboard!.on('keydown-F', () => this.toggleTwoHand());
    this.input.keyboard!.on('keydown-SPACE', () => this.tryRoll());
    this.input.keyboard!.on('keydown-ONE', () => this.quickUse(0));
    this.input.keyboard!.on('keydown-TWO', () => this.quickUse(1));
    this.input.keyboard!.on('keydown-THREE', () => this.quickUse(2));
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.ui?.blocksWorld() || this.dead) return;
      if (p.rightButtonDown()) this.queueAttack('heavy');
      else this.queueAttack('light');
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      cam.setZoom(clamp(cam.zoom * (dy > 0 ? 0.92 : 1.08), 1.1, 3.0));
    });

    this.scene.launch('ui', { game: this });
    this.ui = this.scene.get('ui') as UIScene;

    this.time.delayedCall(300, () => {
      if (!save) {
        this.ui.log('You wake on the stones of Lanternhold. The lamp in the plaza is still burning.', '#e8d4a0');
        this.ui.log('Someone has been keeping it.', '#9aa4b8');
      } else this.ui.log('Hollowmere remembers you.', '#9aa4b8');
    });
  }

  // ============================================================ appearance
  /** Build the Look for the player from equipped gear. */
  playerLook(): Look {
    const base = LOOKS.player;
    const g = (slot: keyof PlayerState['equip']) => itemOf(this.P.equip[slot]);
    const chest = g('chest'), helm = g('helm'), arms = g('arms'), legs = g('legs');
    const wep = g('weapon'), off = g('offhand');
    return {
      ...base,
      helm: helm?.helmVis,
      body: chest?.armVis,
      arms: arms?.armVis,
      legs: legs?.armVis,
      weapon: wep?.vis ?? { shape: 'none', len: 0, blade: P.iron, edge: P.steelLit, grip: P.wood, guard: 'none' },
      shield: this.P.twoHand ? undefined : off?.shieldVis,
      cape: chest?.setId === 'crown' ? { main: P.ink2, trim: P.hollowDim, len: 22, tatter: 1 }
        : chest?.setId === 'lantern' ? { main: P.wine, trim: P.gold, len: 18 } : undefined,
    };
  }

  bakePlayer(sync = false): Baked {
    const look = this.playerLook();
    const spec = { key: PLAYER_KEY, look, clips: PLAYER_CLIPS, mirror: false, seed: 11 };
    if (sync) return bakeNow(this, spec);
    bakeQueued(this, spec, b => this.player?.rebind(b));
    return getBaked(PLAYER_KEY)!;
  }
  /** Called by the UI after any equipment change. */
  refreshAppearance() {
    const b = bakeNow(this, { key: PLAYER_KEY, look: this.playerLook(), clips: PLAYER_CLIPS, mirror: false, seed: 11 });
    this.player.rebind(b);
    this.player.maxHp = maxHp(this.P);
    this.player.hp = Math.min(this.player.hp, this.player.maxHp);
    this.player.poise = this.player.poiseCur = 18 + armorTotals(this.P).poise;
    this.ui?.refresh();
  }

  bakeFor(lookName: string, clips = ENEMY_CLIPS, scale = 1, box = 1, rig: 'humanoid' | 'beast' = 'humanoid'): Baked {
    const key = `bake_${lookName}`;
    const got = getBaked(key);
    if (got) return got;
    if (rig === 'beast') {
      const bl = BEASTS[lookName] ?? BEASTS.wolf;
      return bakeBeast(this, { key, look: bl, mirror: true, scale, box });
    }
    const look = LOOKS[lookName] ?? LOOKS.hollow;
    return bakeNow(this, { key, look, clips, mirror: true, scale, box, seed: lookName.length * 17 });
  }

  // ========================================================== chunk events
  onChunkLoaded(cx: number, cy: number, markers: Marker[]) {
    if (!this.stream.chunkSpawned(cx, cy)) return;
    const tier = this.gen.tierAt(cx * CHUNK, cy * CHUNK);
    for (const m of markers) {
      const key = `${m.kind}:${m.x},${m.y}`;
      if (this.spawnedKeys.has(key)) continue;
      this.spawnedKeys.add(key);
      switch (m.kind) {
        case 'spawn': {
          if (this.killed.has(key)) continue;
          this.spawnEnemy(m.id ?? this.pickMob(m.x, m.y), m.x + 0.5, m.y + 0.5, tier, key);
          break;
        }
        case 'npc': case 'merchant': {
          if (m.id && NPCS[m.id]) this.spawnNpc(m.id, m.x + 0.5, m.y + 0.5);
          break;
        }
        case 'boss': {
          if (m.id) this.pendingBoss = { id: m.id, x: m.x + 0.5, y: m.y + 0.5 };
          break;
        }
        case 'lantern': {
          const lk = `${m.x},${m.y}`;
          if (!this.P.lanterns[lk]) { /* discovered on interaction, not on load */ }
          break;
        }
      }
    }
    // ambient wandering enemies away from structures
    const r = mulberry32((cx * 73856093) ^ (cy * 19349663) ^ this.gen.seed);
    const biome = this.gen.biomeAt(cx * CHUNK + 12, cy * CHUNK + 12);
    const density = BIOMES[biome].tier >= 3 ? 3 : 2;
    for (let i = 0; i < density; i++) {
      const x = cx * CHUNK + Math.floor(r() * CHUNK), y = cy * CHUNK + Math.floor(r() * CHUNK);
      if (Math.hypot(x, y) < 40) continue;          // keep the hub clear
      if (!this.gen.walkable(x, y)) continue;
      const key = `wild:${x},${y}`;
      if (this.killed.has(key) || this.spawnedKeys.has(key)) continue;
      this.spawnedKeys.add(key);
      this.spawnEnemy(this.pickMob(x, y), x + 0.5, y + 0.5, tier, key);
    }
  }

  pickMob(x: number, y: number) {
    const b = BIOMES[this.gen.biomeAt(x, y)];
    const night = this.isNight();
    const pool = b.mobs.filter(([id]) => !ENEMIES[id]?.night || night);
    const list = pool.length ? pool : b.mobs;
    let total = 0;
    for (const [, w] of list) total += w;
    let n = Math.random() * total;
    for (const [id, w] of list) { n -= w; if (n <= 0) return id; }
    return list[0][0];
  }

  spawnEnemy(id: string, x: number, y: number, tier: number, spawnKey?: string) {
    const def: EnemyDef | undefined = ENEMIES[id];
    if (!def) return null;
    const s = scaled(def, tier);
    const baked = this.bakeFor(def.look, ENEMY_CLIPS, 1, 1, def.rig ?? 'humanoid');
    const a = new Actor(this, { key: `e_${id}`, baked, x, y, faction: 'enemy', hp: s.hp, scale: def.scale ?? 1, def, name: def.name });
    a.dmg = s.dmg; a.runes = s.runes; a.poise = a.poiseCur = s.poise;
    (a as Actor & { spawnKey?: string }).spawnKey = spawnKey;
    this.actors.push(a);
    return a;
  }

  spawnNpc(id: string, x: number, y: number) {
    const def = NPCS[id];
    if (!def || this.npcs.some(n => n.npc === id)) return;
    const baked = this.bakeFor(def.look, NPC_CLIPS);
    const a = new Actor(this, { key: `n_${id}`, baked, x, y, faction: 'npc', hp: 9999, npc: id, name: def.name });
    this.npcs.push(a);
  }

  // =================================================================== loop
  update(_time: number, deltaMs: number) {
    const raw = Math.min(0.05, deltaMs / 1000);
    pumpBake(this, 3);
    if (this.ui?.pausesGame()) return;
    if (this.hitStop > 0) { this.hitStop -= raw; return; }
    const dt = raw;
    this.now += dt;
    this.P.playSecs += dt;
    this.minutes = (this.minutes + dt * MIN_PER_SEC) % 1440;

    if (this.dead) { this.deadT += dt; this.stepActors(dt); return; }
    if (this.resting) { this.stepActors(dt); return; }

    this.readInput();
    this.stepPlayer(dt);
    this.stepActors(dt);
    this.stepProjectiles(dt);
    this.stepTelegraphs(dt);
    this.stepPickups(dt);
    this.stream.update(this.P.x, this.P.y);
    this.stream.fadeAround(this.P.x, this.P.y);
    this.updateLockOn();
    this.updateInteract();
    this.updateBoss(dt);
    this.updateWeather(dt);
    this.cullActors();

    this.biome = this.gen.biomeTile(Math.floor(this.P.x), Math.floor(this.P.y));
    this.P.x = this.player.x; this.P.y = this.player.y;
    this.P.hp = this.player.hp;

    this.saveT += dt;
    if (this.saveT > 25) { this.saveT = 0; this.save(); }
  }

  // ================================================================= input
  readInput() {
    const k = this.keys;
    const down = (a: Phaser.Input.Keyboard.Key, b?: Phaser.Input.Keyboard.Key) => a?.isDown || b?.isDown;
    let sx = 0, sy = 0;
    if (down(k.W, k.UP)) sy -= 1;
    if (down(k.S, k.DOWN)) sy += 1;
    if (down(k.A, k.LEFT)) sx -= 1;
    if (down(k.D, k.RIGHT)) sx += 1;
    // screen-space input mapped onto the isometric grid
    let dx = (sy + sx) * 0.7071, dy = (sy - sx) * 0.7071;
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    this.moveX = dx; this.moveY = dy;
    this.sprinting = !!k.SHIFT?.isDown && (dx !== 0 || dy !== 0) && this.P.stam > 2;
    const offh = itemOf(this.P.equip.offhand);
    this.blocking = !!k.Q?.isDown && !this.P.twoHand && !!offh?.block && this.P.stam > 0;
  }

  queueAttack(kind: 'light' | 'heavy') {
    if (this.dead || this.resting) return;
    this.attackQueued = kind;
  }

  toggleLock() {
    if (this.lockOn) { this.lockOn = null; this.lockRet.setVisible(false); return; }
    let best: Actor | null = null, bd = 13;
    for (const a of this.actors) {
      if (!a.hostile || a.dead) continue;
      const d = Math.hypot(a.x - this.player.x, a.y - this.player.y);
      if (d < bd) { bd = d; best = a; }
    }
    this.lockOn = best;
    if (best) sfx.click();
  }

  toggleTwoHand() {
    const w = itemOf(this.P.equip.weapon);
    if (!w) return;
    this.P.twoHand = !this.P.twoHand;
    if (w.twoHandOnly) this.P.twoHand = true;
    this.refreshAppearance();
    this.ui.log(this.P.twoHand ? 'Two-handed.' : 'One-handed.', '#9aa4b8');
  }

  drinkFlask() {
    if (this.dead || this.P.flaskCur <= 0 || this.player.state === 'roll') return;
    this.P.flaskCur--;
    const it = ITEMS.lantern_oil;
    const sets = this.P.equip.chest && itemOf(this.P.equip.chest)?.setId === 'lantern' ? 0.1 : 0;
    const heal = Math.round(this.player.maxHp * ((it.healPct ?? 0.5) + sets));
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
    this.player.play('cast', true);
    this.player.state = 'cast';
    this.player.lock = 0.55;
    sfx.heal();
    this.popText(this.player.x, this.player.y, `+${heal}`, '#7ee0a0');
    this.ui.refresh();
  }

  /** The three quick slots hold whatever consumables you are carrying. */
  quickSlots() {
    return this.P.inv.filter(st => ITEMS[st.id]?.kind === 'consumable' && ITEMS[st.id].id !== 'lantern_oil').slice(0, 3);
  }

  quickUse(i: number) {
    if (this.dead || this.resting || this.ui.blocksWorld()) return;
    const st = this.quickSlots()[i];
    if (!st) return;
    const it = ITEMS[st.id];
    if (!removeItem(this.P, it.id, 1)) return;
    if (it.throwDmg) {
      const p = this.player;
      p.play('cast', true); p.state = 'cast'; p.lock = 0.4;
      const target = this.lockOn && !this.lockOn.dead ? this.lockOn : null;
      const a = target ? Math.atan2(target.y - p.y, target.x - p.x) : p.yaw;
      const s = toScreen(p.x, p.y);
      const img = this.add.image(s.x, s.y - 20, it.id === 'firebomb' ? 'blood' : 'bolt').setDepth(1e5).setScale(1.5);
      if (it.id === 'firebomb') img.setTint(0xff9a3c);
      this.projectiles.push({
        img, x: p.x, y: p.y, vx: Math.cos(a) * 14, vy: Math.sin(a) * 14,
        life: 1.6, dmg: it.throwDmg, impact: it.id === 'firebomb' ? 30 : 12, from: p, hostile: false,
      });
      sfx.shoot();
    } else {
      if (it.heal) this.player.hp = Math.min(this.player.maxHp, this.player.hp + it.heal);
      if (it.buff) this.P.buffs[it.id] = { mul: it.buff.mul, until: this.P.playSecs + it.buff.secs };
      sfx.heal();
      this.popText(this.P.x, this.P.y, it.name, '#9fd0a0');
    }
    this.ui.log(`Used ${it.name}.`, '#c8d0a0');
    this.ui.refresh();
  }

  tryRoll() {
    if (this.dead || this.resting || this.ui.blocksWorld()) return;
    const p = this.player;
    if (p.state === 'roll' || p.lock > 0) return;
    const tier = loadTier(this.P);
    if (tier >= 3) { this.ui.log('Too heavily burdened to roll.', '#c87070'); return; }
    const hunterSet = itemOf(this.P.equip.chest)?.setId === 'hunter' ? 0.85 : 1;
    const cost = (this.moveX || this.moveY ? ROLL.stamina : BACKSTEP.stamina) * hunterSet;
    if (this.P.stam < cost) return;
    this.P.stam -= cost;
    p.cancelAttack();
    this.chain = 0;
    let dx = this.moveX, dy = this.moveY;
    if (!dx && !dy) { dx = -Math.cos(p.yaw); dy = -Math.sin(p.yaw); }
    else p.face(dx, dy);
    const dist = (this.moveX || this.moveY ? ROLL.dist : BACKSTEP.dist) * (tier === 0 ? 1.18 : tier === 1 ? 1 : 0.82);
    const dur = (this.moveX || this.moveY ? ROLL.dur : BACKSTEP.dur) * (tier === 2 ? 1.2 : 1);
    this.rollDx = dx * (dist / dur); this.rollDy = dy * (dist / dur);
    this.rollT = dur;
    p.state = 'roll';
    p.play('roll', true);
    p.iframes = (ROLL.iframes + talismanMods(this.P).rollIFrames) * (tier === 0 ? 1.12 : 1);
    sfx.roll();
  }

  // ================================================================ player
  stepPlayer(dt: number) {
    const p = this.player;
    const pen = weaponPenalty(this.P);

    // stamina
    const regenBlocked = this.blocking || this.sprinting || p.state === 'attack' || p.state === 'roll';
    if (!regenBlocked) this.P.stam = Math.min(maxStam(this.P), this.P.stam + staminaRegen(this.P) * dt);
    else if (this.blocking) this.P.stam = Math.min(maxStam(this.P), this.P.stam + staminaRegen(this.P) * 0.35 * dt);
    if (this.sprinting) {
      this.P.stam -= SPRINT_DRAIN * dt;
      if (this.P.stam <= 0) { this.P.stam = 0; this.sprinting = false; }
    }
    // buffs expire
    for (const [k, b] of Object.entries(this.P.buffs)) if (this.P.playSecs > b.until) delete this.P.buffs[k];

    if (this.rollT > 0) {
      this.rollT -= dt;
      p.moveBy(this.rollDx * dt, this.rollDy * dt);
      p.advanceClip(dt);
      if (this.rollT <= 0) { p.state = 'idle'; p.play('idle'); }
      p.update(dt);
      return;
    }

    if (p.state === 'cast' || p.state === 'hurt') {
      p.advanceClip(dt);
      if (p.lock <= 0) { p.state = 'idle'; p.play('idle'); }
      p.update(dt);
      return;
    }

    // attacks
    if (p.atk) {
      if (this.attackQueued && p.atkPhase === 'recover') {
        // buffer the next hit of the chain
        const q = this.attackQueued;
        this.attackQueued = null;
        p.cancelAttack();
        this.startPlayerAttack(q);
      } else {
        p.update(dt);
        if (!p.atk) { p.state = 'idle'; p.play('idle'); }
        return;
      }
    } else if (this.attackQueued) {
      const q = this.attackQueued;
      this.attackQueued = null;
      this.startPlayerAttack(q);
      p.update(dt);
      return;
    }

    this.chainT -= dt;
    if (this.chainT <= 0) this.chain = 0;

    // movement
    const tier = loadTier(this.P);
    const speedBase = 3.1 * (tier === 0 ? 1.08 : tier === 1 ? 1 : tier === 2 ? 0.88 : 0.6);
    const speed = (this.sprinting ? speedBase * 1.72 : this.blocking ? speedBase * 0.52 : speedBase) * (0.8 + pen * 0.2);
    let moved = false;
    if (this.moveX || this.moveY) {
      moved = p.moveBy(this.moveX * speed * dt, this.moveY * speed * dt);
      if (this.lockOn && !this.lockOn.dead) p.face(this.lockOn.x - p.x, this.lockOn.y - p.y);
      else p.face(this.moveX, this.moveY);
    } else if (this.lockOn && !this.lockOn.dead) {
      p.face(this.lockOn.x - p.x, this.lockOn.y - p.y);
    }
    p.blocking = this.blocking;
    const clip = this.blocking ? (moved ? 'blockwalk' : 'block') : moved ? (this.sprinting ? 'run' : 'walk') : 'idle';
    p.play(clip);
    p.advanceClip(dt, moved && this.sprinting ? 1.05 : 1);
    p.separate([...this.actors, ...this.npcs]);
    p.update(dt);
  }

  startPlayerAttack(kind: 'light' | 'heavy') {
    const p = this.player;
    const w = itemOf(this.P.equip.weapon);
    const ms = MOVESETS[w?.moveset ?? 'light'];
    const stam = (w?.stam ?? 14) * (kind === 'heavy' ? 1.9 : 1) * (this.P.twoHand ? 1.1 : 1);
    if (this.P.stam < stam * 0.5) { sfx.fail(); return; }
    this.P.stam = Math.max(0, this.P.stam - stam);

    if (this.lockOn && !this.lockOn.dead) p.face(this.lockOn.x - p.x, this.lockOn.y - p.y);
    else if (this.moveX || this.moveY) p.face(this.moveX, this.moveY);

    const speed = w?.speed ?? 0.45;
    const clipName = kind === 'heavy' ? 'heavy' : ms.light[this.chain % ms.light.length];
    const a: Attack = {
      id: `p_${clipName}_${this.chain}`,
      clip: clipName as Attack['clip'],
      windup: speed * (kind === 'heavy' ? 1.25 : 0.62),
      active: 0.13,
      recover: speed * (kind === 'heavy' ? 1.15 : 0.72),
      range: (w?.reach ?? 1.4) + (kind === 'heavy' ? 0.3 : 0),
      arc: ms.arc * (kind === 'heavy' ? 1.1 : 1),
      dmgMul: kind === 'heavy' ? 1.75 : 1,
      impact: Math.round((w?.impact ?? 12) * (kind === 'heavy' ? 2.1 : 1)),
      kind: 'melee',
      lunge: ms.lunge * (kind === 'heavy' ? 1.3 : 1) * (this.moveX || this.moveY ? 1.3 : 1),
    };
    this.chain = kind === 'heavy' ? 0 : this.chain + 1;
    this.chainT = 0.9;
    p.startAttack(a, 1);
    sfx.swing(kind === 'heavy');
  }

  // =============================================================== actors
  stepActors(dt: number) {
    for (const a of this.actors) {
      if (a.dead) { a.update(dt); continue; }
      if (a.lock <= 0 && a.state !== 'hurt') a.updateAI(dt, this.player);
      a.separate(this.actors);
      a.update(dt);
    }
    for (const n of this.npcs) { n.idleWander(dt * 0.4); n.update(dt); }
    // reap
    for (let i = this.actors.length - 1; i >= 0; i--) {
      const a = this.actors[i];
      if (a.dead && a.deathT > 3.8) { a.destroy(); this.actors.splice(i, 1); }
    }
  }

  cullActors() {
    for (let i = this.actors.length - 1; i >= 0; i--) {
      const a = this.actors[i];
      if (a === this.boss) continue;
      if (Math.hypot(a.x - this.P.x, a.y - this.P.y) > CHUNK * 3.2) {
        const k = (a as Actor & { spawnKey?: string }).spawnKey;
        if (k) this.spawnedKeys.delete(k);
        a.destroy();
        this.actors.splice(i, 1);
      }
    }
  }

  // ============================================================== combat
  onAttackActive(a: Actor, atk: Attack) {
    if (atk.kind === 'ranged') { this.fireProjectile(a, atk); return; }
    if (atk.kind === 'aoe') {
      this.addTelegraph(a.x, a.y, atk.radius ?? 3, atk.tell ? 0xffffff : 0xff8040, 0.3);
      this.cameras.main.shake(180, 0.006);
      sfx.boom();
      const targets = a.faction === 'enemy' ? [this.player] : this.actors;
      for (const t of targets) {
        if (t.dead) continue;
        if (Math.hypot(t.x - a.x, t.y - a.y) > (atk.radius ?? 3) + t.radius) continue;
        this.applyHit(a, t, atk);
      }
      return;
    }
    if (a === this.player) sfx.swing(atk.clip === 'heavy');
  }

  /** Called every frame an attack is live. */
  resolveAttackHits(a: Actor, atk: Attack) {
    if (atk.kind !== 'melee' && atk.kind !== 'dash') return;
    const targets: Actor[] = a.faction === 'enemy' ? [this.player] : this.actors;
    for (const t of targets) {
      if (t === a || t.dead || a.atkHit.has(t)) continue;
      if (!inCone(a.x, a.y, a.yaw, atk.range * a.scaleMul, atk.arc, t.x, t.y, t.radius)) continue;
      a.atkHit.add(t);
      this.applyHit(a, t, atk);
    }
  }

  applyHit(from: Actor, to: Actor, atk: Attack) {
    if (to.dead) return;
    if (to === this.player) {
      if (to.iframes > 0) return;
      const arm = armorTotals(this.P);
      const red = armorReduction(arm.phys) * talismanMods(this.P).defMul;
      let blocked = 0;
      const off = itemOf(this.P.equip.offhand);
      if (this.blocking && off?.block && !atk.unblockable) {
        const ang = Math.atan2(from.y - to.y, from.x - to.x);
        const facingIt = Math.abs(Math.atan2(Math.sin(ang - to.yaw), Math.cos(ang - to.yaw))) < 1.25;
        if (facingIt) {
          blocked = off.block;
          const drain = (off.guard ?? 14) * atk.dmgMul * 2.2;
          this.P.stam -= drain;
          sfx.block();
          this.addSpark(to.x, to.y, 0xffe8b0, 6);
          if (this.P.stam <= 0) {
            this.P.stam = 0;
            to.stagger(ang);
            this.ui.log('Guard broken.', '#d08050');
            blocked = 0.2;
          }
        }
      }
      let buffDef = 1;
      for (const b of Object.values(this.P.buffs)) if (b.mul < 1) buffDef *= b.mul;
      const out = resolveDamage({
        raw: from.dmg * atk.dmgMul, armor: 0, reduce: 1 - (1 - red) * buffDef, blocked: blocked || undefined,
      });
      to.takeHit(out.dmg, blocked ? 0 : atk.impact, from.x, from.y);
      this.ui.hurtFlash(out.dmg / this.player.maxHp);
      this.cameras.main.shake(120, 0.004);
      if (!blocked) { this.addSpark(to.x, to.y, 0xc02020, 10); sfx.hurt(); }
      this.popText(to.x, to.y, `${out.dmg}`, blocked ? '#d8d0a0' : '#ff8080');
      if (this.player.hp <= 0) this.onPlayerDeath();
      this.ui.refresh();
      return;
    }

    // player (or an ally) hitting something
    const pw = weaponPower(this.P);
    const pen = weaponPenalty(this.P);
    const def = to.def ?? to.boss;
    const backstab = Math.abs(Math.atan2(Math.sin(from.yaw - to.yaw), Math.cos(from.yaw - to.yaw))) < 0.9;
    const out = resolveDamage({
      raw: pw.dmg * atk.dmgMul * pen,
      holy: pw.holy,
      hollowMul: def?.hollow ?? 1,
      armor: 0,
      reduce: to.armorFrac,
      back: backstab,
      staggered: to.state === 'hurt',
    });
    const dealt = to.takeHit(out.dmg, atk.impact, from.x, from.y);
    if (dealt > 0) {
      this.addSpark(to.x, to.y, out.crit ? 0xffe0a0 : 0xd0d8e8, out.crit ? 14 : 8);
      this.popText(to.x, to.y, `${out.dmg}`, out.crit ? '#ffd880' : '#ffffff');
      sfx.hit(out.crit);
      this.hitStop = out.crit ? 0.06 : 0.025;
      const w = itemOf(this.P.equip.weapon);
      if (w?.bleed && Math.random() < w.bleed) this.addSpark(to.x, to.y, 0x901820, 10);
      this.ui.refresh();
    }
  }

  fireProjectile(from: Actor, atk: Attack) {
    const target = from.faction === 'enemy' ? this.player : this.lockOn;
    const tx = target ? target.x : from.x + Math.cos(from.yaw) * 5;
    const ty = target ? target.y : from.y + Math.sin(from.yaw) * 5;
    const a = Math.atan2(ty - from.y, tx - from.x);
    const sp = atk.speed ?? 10;
    const s = toScreen(from.x, from.y);
    const img = this.add.image(s.x, s.y - 20, 'bolt').setDepth(1e5).setScale(1.4);
    if (atk.tell) img.setTint(Phaser.Display.Color.GetColor(atk.tell[0], atk.tell[1], atk.tell[2]));
    this.projectiles.push({
      img, x: from.x, y: from.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 2.6, dmg: from.dmg * atk.dmgMul, impact: atk.impact, from, hostile: from.faction === 'enemy',
    });
    sfx.shoot();
  }

  stepProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      const s = toScreen(p.x, p.y);
      p.img.setPosition(s.x, s.y - 20).setDepth(depthOf(p.x, p.y) + 10);
      let hit = false;
      if (p.hostile) {
        if (Math.hypot(p.x - this.player.x, p.y - this.player.y) < 0.6) {
          hit = true;
          this.applyHit(p.from, this.player, { id: 'proj', clip: 'attack1', windup: 0, active: 0, recover: 0, range: 1, arc: 3.2, dmgMul: 1, impact: p.impact, kind: 'melee' });
        }
      } else {
        for (const a of this.actors) {
          if (a.dead || !a.hostile) continue;
          if (Math.hypot(p.x - a.x, p.y - a.y) < 0.6) {
            hit = true;
            const out = resolveDamage({ raw: p.dmg, armor: 0, reduce: a.armorFrac });
            a.takeHit(out.dmg, p.impact, p.x, p.y);
            this.popText(a.x, a.y, `${out.dmg}`, '#ffffff');
            break;
          }
        }
      }
      if (!hit && !this.gen.walkable(Math.floor(p.x), Math.floor(p.y))) hit = true;
      if (hit || p.life <= 0) { this.addSpark(p.x, p.y, 0xd0e0ff, 5); p.img.destroy(); this.projectiles.splice(i, 1); }
    }
  }

  addTelegraph(x: number, y: number, r: number, col: number, dur: number) {
    const g = this.add.graphics().setDepth(depthOf(x, y) - 1);
    this.telegraphs.push({ g, t: 0, dur, x, y, r, col });
  }
  stepTelegraphs(dt: number) {
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const t = this.telegraphs[i];
      t.t += dt;
      const k = t.t / t.dur;
      t.g.clear();
      if (k >= 1) { t.g.destroy(); this.telegraphs.splice(i, 1); continue; }
      const s = toScreen(t.x, t.y);
      t.g.lineStyle(3, t.col, 0.8 * (1 - k));
      t.g.strokeEllipse(s.x, s.y, t.r * TW * k * 2, t.r * TH * k * 2);
      t.g.fillStyle(t.col, 0.12 * (1 - k));
      t.g.fillEllipse(s.x, s.y, t.r * TW * k * 2, t.r * TH * k * 2);
    }
  }

  addSpark(x: number, y: number, tint: number, n: number) {
    const s = toScreen(x, y);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 20 + Math.random() * 60;
      const img = this.add.image(s.x, s.y - 18, 'spark').setTint(tint).setDepth(1e5).setScale(0.6 + Math.random());
      this.tweens.add({
        targets: img, x: s.x + Math.cos(a) * v, y: s.y - 18 + Math.sin(a) * v * 0.6,
        alpha: 0, scale: 0.1, duration: 260 + Math.random() * 240, onComplete: () => img.destroy(),
      });
    }
  }

  popText(x: number, y: number, msg: string, color: string) {
    const s = toScreen(x, y);
    const t = this.add.text(s.x, s.y - 40, msg, { fontFamily: 'monospace', fontSize: '15px', color, stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5).setDepth(1e6);
    this.tweens.add({ targets: t, y: s.y - 70, alpha: 0, duration: 760, onComplete: () => t.destroy() });
  }

  // =============================================================== death
  onActorDeath(a: Actor) {
    if (a === this.player) return;
    if (a === this.boss) { this.onBossDeath(a); return; }
    const key = (a as Actor & { spawnKey?: string }).spawnKey;
    if (key) this.killed.add(key);
    const def = a.def;
    if (!def) return;
    this.P.kills[def.id] = (this.P.kills[def.id] ?? 0) + 1;
    const gained = Math.round(a.runes * talismanMods(this.P).runeMul);
    this.P.runes += gained;
    this.P.earned += gained;
    this.popText(a.x, a.y, `+${a.runes}`, '#e8c070');
    for (const [id, chance, lo, hi] of def.drops) {
      if (Math.random() > chance) continue;
      const qty = lo + Math.floor(Math.random() * (hi - lo + 1));
      if (id === 'rune_shard') { this.P.runes += qty * 10; continue; }
      this.dropPickup(a.x, a.y, id, qty);
    }
    sfx.die();
    this.ui.refresh();
  }

  dropPickup(x: number, y: number, id: string, qty: number) {
    if (!ITEMS[id]) return;
    const s = toScreen(x, y);
    const img = this.add.image(s.x, s.y - 8, 'rune').setDepth(depthOf(x, y) + 2).setScale(2);
    this.tweens.add({ targets: img, y: s.y - 14, duration: 700, yoyo: true, repeat: -1 });
    this.pickups.push({ img, x, y, id, qty, t: 0 });
  }

  stepPickups(dt: number) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.t += dt;
      if (Math.hypot(p.x - this.player.x, p.y - this.player.y) < 0.9) {
        addItem(this.P, p.id, p.qty);
        this.ui.log(`Picked up ${ITEMS[p.id].name}${p.qty > 1 ? ` ×${p.qty}` : ''}.`, '#c8d0a0');
        sfx.pickup();
        p.img.destroy();
        this.pickups.splice(i, 1);
        this.ui.refresh();
      } else if (p.t > 180) { p.img.destroy(); this.pickups.splice(i, 1); }
    }
  }

  onPlayerDeath() {
    if (this.dead) return;
    this.dead = true;
    this.P.deaths++;
    const keep = itemOf(this.P.equip.chest)?.setId === 'crown' ? 0.5 : 0;
    const lost = Math.round(this.P.runes * (1 - keep));
    this.P.bloodstain = lost > 0 ? { x: this.player.x, y: this.player.y, runes: lost } : null;
    this.P.runes -= lost;
    this.player.die();
    sfx.death();
    this.ui.showDeath();
    this.save();
  }

  respawn() {
    const l = this.P.lastLantern ?? { x: 0.5, y: 2.5 };
    this.player.dead = false;
    this.player.deathT = 0;
    this.player.sprite.setAlpha(1);
    this.player.hp = maxHp(this.P);
    this.P.stam = maxStam(this.P);
    this.P.flaskCur = this.P.flaskMax;
    this.player.x = l.x; this.player.y = l.y;
    this.P.x = l.x; this.P.y = l.y;
    this.player.state = 'idle';
    this.player.play('idle', true);
    this.dead = false;
    this.deadT = 0;
    this.resetWorld();
    this.ui.closeAll();
    this.ui.refresh();
  }

  /** Enemies return, bosses stay dead. */
  resetWorld() {
    for (const a of this.actors) a.destroy();
    this.actors = [];
    this.boss = null; this.bossDef = null;
    this.killed = new Set([...this.killed].filter(k => k.startsWith('boss:')));
    this.spawnedKeys.clear();
    this.stream.clear();
    this.stream.update(this.P.x, this.P.y);
  }

  // ================================================================ bosses
  updateBoss(dt: number) {
    if (this.pendingBoss && !this.boss) {
      const pb = this.pendingBoss;
      if (!this.P.flags[`boss_${pb.id}`] && Math.hypot(pb.x - this.P.x, pb.y - this.P.y) < 9) {
        this.startBoss(pb.id, pb.x, pb.y);
        this.pendingBoss = null;
      } else if (Math.hypot(pb.x - this.P.x, pb.y - this.P.y) > CHUNK * 3) this.pendingBoss = null;
    }
    if (this.boss && !this.boss.dead) {
      if (Math.hypot(this.boss.x - this.P.x, this.boss.y - this.P.y) > (this.bossDef?.arena ?? 12) + 8) this.endBossFight(false);
    }
    void dt;
  }

  startBoss(id: string, x: number, y: number) {
    const def = BOSSES[id];
    if (!def || this.P.flags[`boss_${id}`]) return;
    const baked = this.bakeFor(def.look, ENEMY_CLIPS, def.scale ?? 1, 1.9);
    const a = new Actor(this, { key: `b_${id}`, baked, x, y, faction: 'enemy', hp: def.hp, scale: def.scale ?? 1, boss: def, name: def.name });
    a.dmg = def.dmg; a.runes = def.runes; a.arena = { x, y, r: def.arena };
    a.aggroed = true;
    this.actors.push(a);
    this.boss = a;
    this.bossDef = def;
    this.ui.showBoss(def.name, def.title);
    this.ui.log(def.intro, '#c8b0d8');
    sfx.bossHorn();
  }

  onBossPhase(a: Actor, phase: Phase) {
    if (phase.line) this.ui.log(phase.line, '#e0b0b0');
    if (phase.burst) {
      this.addTelegraph(a.x, a.y, phase.burst.radius, 0xffc080, 0.5);
      this.cameras.main.shake(400, 0.012);
      sfx.boom();
      if (Math.hypot(this.player.x - a.x, this.player.y - a.y) < phase.burst.radius) {
        this.applyHit(a, this.player, { id: 'burst', clip: 'cast', windup: 0, active: 0, recover: 0, range: 1, arc: 3.2, dmgMul: phase.burst.dmgMul, impact: 40, kind: 'melee', unblockable: true });
      }
    }
    if (phase.summon) {
      const tier = this.gen.tierAt(Math.floor(a.x), Math.floor(a.y));
      for (let i = 0; i < phase.summon.count; i++) {
        const ang = (i / phase.summon.count) * Math.PI * 2;
        this.spawnEnemy(phase.summon.id, a.x + Math.cos(ang) * 4, a.y + Math.sin(ang) * 4, tier);
      }
    }
    a.iframes = 0.8;
  }

  onBossDeath(a: Actor) {
    const def = this.bossDef;
    if (!def || a !== this.boss) return;
    this.P.flags[`boss_${def.id}`] = true;
    this.P.runes += Math.round(def.runes * talismanMods(this.P).runeMul);
    addItem(this.P, def.remembrance, 1);
    this.killed.add(`boss:${def.id}`);
    this.ui.showBossDown(def.title, def.epitaph);
    this.ui.log(`${def.title} has fallen. ${def.epitaph}`, '#e8d8a0');
    this.ui.log(`Obtained: ${ITEMS[def.remembrance]?.name ?? def.remembrance}.`, '#e8c070');
    this.cameras.main.flash(500, 220, 210, 190);
    sfx.bossDown();
    this.endBossFight(true);
    this.save();
  }

  endBossFight(won: boolean) {
    if (!won && this.boss) { this.boss.aggroed = false; }
    this.boss = null;
    this.bossDef = null;
    this.ui.hideBoss();
  }

  // ========================================================== interaction
  updateInteract() {
    const px = Math.floor(this.P.x), py = Math.floor(this.P.y);
    let found: GameScene['interactTarget'] = null;
    // NPCs first
    for (const n of this.npcs) {
      if (Math.hypot(n.x - this.P.x, n.y - this.P.y) < 1.7) {
        found = { kind: 'npc', x: n.x, y: n.y, label: `Speak to ${n.name}`, data: n };
        break;
      }
    }
    if (!found) {
      for (let dy = -1; dy <= 1 && !found; dy++) for (let dx = -1; dx <= 1 && !found; dx++) {
        const x = px + dx, y = py + dy;
        const o = this.gen.obj(x, y);
        if (!o) continue;
        if (o === O.LANTERN) found = { kind: 'lantern', x, y, label: 'Rest at Lantern' };
        else if (o === O.NOTE) found = { kind: 'note', x, y, label: 'Read remnant' };
        else if (o === O.ANVIL) found = { kind: 'smith', x, y, label: 'Use the anvil' };
        else if (o === O.BOARD) found = { kind: 'board', x, y, label: 'Read the notice board' };
        else if (CONTAINERS.has(o)) found = { kind: 'container', x, y, label: `Search ${OBJ_NAME[o] ?? 'it'}` };
        else if (HARVEST.has(o)) found = { kind: 'harvest', x, y, label: `Gather ${OBJ_NAME[o] ?? 'it'}` };
        else if (o === O.SIGN) found = { kind: 'note', x, y, label: 'Read the sign' };
      }
    }
    if (!found && this.P.bloodstain && Math.hypot(this.P.bloodstain.x - this.P.x, this.P.bloodstain.y - this.P.y) < 1.4) {
      found = { kind: 'blood', x: this.P.bloodstain.x, y: this.P.bloodstain.y, label: `Reclaim ${this.P.bloodstain.runes} runes` };
    }
    this.interactTarget = found;
    this.ui.setPrompt(found ? `[E] ${found.label}` : null);
  }

  interact() {
    const t = this.interactTarget;
    if (!t || this.dead || this.ui.blocksWorld()) return;
    switch (t.kind) {
      case 'npc': this.ui.openDialog(t.data as Actor); break;
      case 'lantern': this.restAtLantern(t.x, t.y); break;
      case 'note': this.readNote(t.x, t.y); break;
      case 'smith': this.ui.openPanel('smith'); break;
      case 'board': this.ui.openPanel('contracts'); break;
      case 'container': this.searchContainer(t.x, t.y); break;
      case 'harvest': this.harvest(t.x, t.y); break;
      case 'blood': {
        const b = this.P.bloodstain!;
        this.P.runes += b.runes;
        this.P.bloodstain = null;
        this.ui.log(`Reclaimed ${b.runes} runes.`, '#e8c070');
        sfx.pickup();
        this.ui.refresh();
        break;
      }
    }
  }

  restAtLantern(x: number, y: number) {
    const key = `${x},${y}`;
    const site = this.gen.siteNear(x, y);
    const name = site?.name ?? `${BIOMES[this.gen.biomeAt(x, y)].name} Lantern`;
    const isNew = !this.P.lanterns[key];
    this.P.lanterns[key] = name;
    this.P.lastLantern = { x: x + 0.5, y: y + 0.5 };
    if (isNew) {
      this.ui.banner('LANTERN KINDLED', name);
      sfx.lantern();
    }
    this.player.hp = maxHp(this.P);
    this.P.stam = maxStam(this.P);
    this.P.flaskCur = this.P.flaskMax;
    this.resting = true;
    this.player.state = 'rest';
    this.player.play('rest', true);
    this.resetWorld();
    this.save();
    this.ui.openPanel('lantern');
  }

  leaveLantern() {
    this.resting = false;
    this.player.state = 'idle';
    this.player.play('idle', true);
  }

  readNote(x: number, y: number) {
    const salt = (x * 73856093) ^ (y * 19349663) ^ this.gen.seed;
    const site = this.gen.siteNear(x, y);
    let r = site && REMNANTS[site.id] ? REMNANTS[site.id] : null;
    if (!r) {
      const structural = ['opening', 'shrine', 'road', 'menhir', 'catacomb', 'cathedral', 'forge'];
      void structural;
      r = remnantFor(this.gen.tierAt(x, y), salt);
    }
    if (!this.P.remnants.includes(r.id)) this.P.remnants.push(r.id);
    this.ui.showRemnant(r);
  }

  searchContainer(x: number, y: number) {
    const k = packKey(x, y);
    if (this.P.flags[`looted_${k}`]) { this.ui.log('Already emptied.', '#8a90a0'); return; }
    this.P.flags[`looted_${k}`] = true;
    const tier = this.gen.tierAt(x, y);
    const r = mulberry32(k ^ this.gen.seed);
    const n = 1 + Math.floor(r() * 2);
    const pool = Object.values(ITEMS).filter(i => i.tier <= Math.min(4, tier) && (i.kind === 'consumable' || i.kind === 'material' || (i.tier > 0 && r() < 0.4)));
    let got = false;
    for (let i = 0; i < n; i++) {
      const it = pool[Math.floor(r() * pool.length)];
      if (!it) continue;
      const qty = it.stack ? 1 + Math.floor(r() * 2) : 1;
      addItem(this.P, it.id, qty);
      this.ui.log(`Found ${it.name}${qty > 1 ? ` ×${qty}` : ''}.`, '#c8d0a0');
      got = true;
    }
    const runes = Math.round((20 + tier * 40) * (0.5 + r()));
    this.P.runes += runes;
    this.ui.log(`Found ${runes} runes.`, '#e8c070');
    if (!got) this.ui.log('Mostly dust.', '#8a90a0');
    sfx.pickup();
    const o = this.gen.obj(x, y);
    if (o === O.CHEST || o === O.COFFIN) this.stream.swapProp(x, y, O.RUBBLE);
    else this.stream.swapProp(x, y, O.NONE);
    this.ui.refresh();
  }

  harvest(x: number, y: number) {
    const o = this.gen.obj(x, y);
    const table: Partial<Record<O, [string, number]>> = {
      [O.BUSH]: ['bloodwort_tonic', 1], [O.HERB]: ['bloodwort_tonic', 1],
      [O.FUNGUS]: ['pale_ash', 1], [O.ORE]: ['emberglass', 2], [O.SHARD]: ['rune_shard', 3],
      [O.REED]: ['bandage', 1],
    };
    const e = table[o];
    if (!e) return;
    if (e[0] === 'rune_shard') { this.P.runes += e[1] * 25; this.ui.log(`+${e[1] * 25} runes.`, '#e8c070'); }
    else { addItem(this.P, e[0], e[1]); this.ui.log(`Gathered ${ITEMS[e[0]].name}.`, '#c8d0a0'); }
    this.stream.swapProp(x, y, o === O.BUSH ? O.BUSH_BARE : O.NONE);
    sfx.pickup();
    this.ui.refresh();
  }

  // ================================================================ lock-on
  updateLockOn() {
    if (this.lockOn && (this.lockOn.dead || Math.hypot(this.lockOn.x - this.P.x, this.lockOn.y - this.P.y) > 18)) {
      this.lockOn = null;
    }
    if (!this.lockOn) { this.lockRet.setVisible(false); return; }
    const s = toScreen(this.lockOn.x, this.lockOn.y);
    this.lockRet.setVisible(true).setPosition(s.x, s.y - 52 * this.lockOn.scaleMul).setDepth(1e6);
    this.lockRet.setRotation(this.now * 2);
  }

  // ============================================================= ambience
  isNight() { const h = this.minutes / 60; return h < 6 || h > 19.5; }
  /** 0 = noon, 1 = deepest night. */
  darkness() {
    const h = this.minutes / 60;
    if (h >= 7 && h <= 18) return 0.12;
    if (h > 18 && h < 21) return 0.12 + ((h - 18) / 3) * 0.66;
    if (h >= 21 || h < 4) return 0.78;
    return 0.78 - ((h - 4) / 3) * 0.66;
  }

  updateWeather(dt: number) {
    this.weatherT -= dt;
    if (this.weatherT <= 0) {
      this.weatherT = 40 + Math.random() * 90;
      const wet = this.biome === 'fen' || this.biome === 'lowland' || this.biome === 'rotwood';
      this.rainTarget = Math.random() < (wet ? 0.5 : 0.22) ? 0.4 + Math.random() * 0.6 : 0;
    }
    this.rain += (this.rainTarget - this.rain) * Math.min(1, dt * 0.35);
    // Light sources for the UI darkness pass.
    this.lightSources.length = 0;
    for (const p of this.stream.props.values()) {
      if (p.o === O.LANTERN) this.lightSources.push({ x: p.x + 0.5, y: p.y + 0.5, r: 7 });
      else if (p.o === O.BRAZIER || p.o === O.PYRE) this.lightSources.push({ x: p.x + 0.5, y: p.y + 0.5, r: 5.5 });
      else if (p.o === O.LAMP_POST || p.o === O.CANDLE_RACK || p.o === O.CHANDELIER) this.lightSources.push({ x: p.x + 0.5, y: p.y + 0.5, r: 4 });
    }
  }

  // ================================================================= save
  save() {
    const d: SaveData = {
      v: 2, seed: this.gen.seed, player: this.P, minutes: this.minutes,
      edits: this.gen.serializeEdits(), killed: [...this.killed].filter(k => k.startsWith('boss:')),
    };
    saveGame(d);
  }

  quitToTitle() {
    this.save();
    this.scene.stop('ui');
    this.scene.start('title');
  }

  newGamePlus() {
    clearSave();
    this.scene.stop('ui');
    this.scene.start('title');
  }

  chapter() { return currentChapter(this.P.flags); }
  chapters() { return CHAPTERS; }
}

// re-exported so the UI can reach them without another import hop
export { ITEMS, NPCS, BIOMES, O, T };
export type { ItemDef, Marker };
