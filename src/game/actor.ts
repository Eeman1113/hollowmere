// Actors: the player, enemies, bosses and NPCs all run through this one class.
// Animation state is driven from the baked atlas; AI is a small state machine
// with explicit attack windows so every hit is telegraphed.

import * as Phaser from 'phaser';
import { toScreen, depthOf, clamp } from './core';
import { SPR_H, SPR_W, clipInfo, resolve, type Baked } from './art/bake';
import type { ClipName } from './art/anim';
import { dirFor } from './art/rig';
import type { Attack, EnemyDef } from './content/enemies';
import type { BossDef } from './content/bosses';
import { chooseAttack, inCone, timed } from './combat';
import type { GameScene } from './scenes/GameScene';

export type ActorState = 'idle' | 'move' | 'attack' | 'roll' | 'block' | 'hurt' | 'death' | 'cast' | 'rest';
export type Faction = 'player' | 'enemy' | 'npc';

export interface ActorInit {
  key: string;
  baked: Baked;
  x: number; y: number;
  faction: Faction;
  hp: number;
  scale?: number;
  def?: EnemyDef;
  boss?: BossDef;
  npc?: string;
  name?: string;
}

export class Actor {
  scene: GameScene;
  x: number; y: number;
  vx = 0; vy = 0;
  faction: Faction;
  key: string;
  baked: Baked;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  scaleMul: number;

  dir = 0;
  yaw = 0;
  clip: ClipName = 'idle';
  frame = 0;
  clipT = 0;
  state: ActorState = 'idle';
  stateT = 0;

  hp: number; maxHp: number;
  poise = 20; poiseCur = 20; poiseT = 0;
  iframes = 0;
  hurtFlash = 0;
  dead = false;
  deathT = 0;
  /** Stops the actor acting (stagger, fog-wall intro). */
  lock = 0;

  // --- combat
  atk: Attack | null = null;
  atkT = 0;
  atkPhase: 'windup' | 'active' | 'recover' = 'windup';
  atkHit = new Set<Actor>();
  cd: Record<string, number> = {};
  haste = 1;
  blocking = false;

  // --- AI
  def?: EnemyDef;
  boss?: BossDef;
  npc?: string;
  name?: string;
  home = { x: 0, y: 0 };
  target: Actor | null = null;
  aggroed = false;
  think = 0;
  strafe = 1;
  strafeT = 0;
  phaseIdx = 0;
  /** Boss arena anchor. */
  arena: { x: number; y: number; r: number } | null = null;
  /** Tier-scaled damage. */
  dmg = 10;
  runes = 0;
  armorFrac = 0;

  constructor(scene: GameScene, init: ActorInit) {
    this.scene = scene;
    this.x = init.x; this.y = init.y;
    this.faction = init.faction;
    this.key = init.key;
    this.baked = init.baked;
    this.scaleMul = init.scale ?? 1;
    this.hp = this.maxHp = init.hp;
    this.def = init.def;
    this.boss = init.boss;
    this.npc = init.npc;
    this.name = init.name;
    this.home = { x: init.x, y: init.y };
    if (init.def) { this.poise = this.poiseCur = init.def.poise; this.armorFrac = init.def.armor; }
    if (init.boss) { this.poise = this.poiseCur = init.boss.poise; this.armorFrac = init.boss.armor; }

    this.shadow = scene.add.image(0, 0, 'shadow').setDepth(0);
    const f = resolve(this.baked, 'idle', 0, 0);
    this.sprite = scene.add.image(0, 0, this.baked.key, f.name).setOrigin(0.5, this.baked.originY);
    this.sprite.setScale(this.scaleMul * this.baked.scale);
    this.sync();
  }

  get alive() { return !this.dead; }
  get hostile() { return this.faction === 'enemy'; }
  get radius() { return 0.42 * this.scaleMul; }

  /** Swap the baked atlas (used when the player changes gear). */
  rebind(b: Baked) {
    this.baked = b;
    this.sprite.setOrigin(0.5, b.originY);
    this.sprite.setScale(this.scaleMul * b.scale);
    this.applyFrame();
  }

  face(dx: number, dy: number) {
    if (Math.abs(dx) + Math.abs(dy) < 1e-4) return;
    this.dir = dirFor(dx, dy);
    this.yaw = Math.atan2(dy, dx);
  }
  /** World-space angle this actor is facing, for cone tests. */
  get facing() { return this.yaw; }

  play(clip: ClipName, restart = false) {
    if (this.clip === clip && !restart) return;
    this.clip = clip;
    this.frame = 0;
    this.clipT = 0;
  }

  applyFrame() {
    const f = resolve(this.baked, this.clip, this.dir, this.frame);
    this.sprite.setTexture(this.baked.key, f.name);
    this.sprite.setFlipX(f.flip);
  }

  advanceClip(dt: number, speedMul = 1) {
    const c = clipInfo(this.baked, this.baked.clips.has(this.clip) ? this.clip : 'idle');
    this.clipT += dt * c.fps * speedMul;
    if (this.clipT >= 1) {
      const step = Math.floor(this.clipT);
      this.clipT -= step;
      this.frame += step;
      if (!c.loop && this.frame >= c.n - 1) this.frame = c.n - 1;
    }
  }

  sync() {
    const s = toScreen(this.x, this.y);
    this.sprite.setPosition(Math.round(s.x), Math.round(s.y));
    this.sprite.setDepth(depthOf(this.x, this.y) + 6);
    this.shadow.setPosition(Math.round(s.x), Math.round(s.y));
    this.shadow.setDepth(depthOf(this.x, this.y) + 1);
    this.shadow.setScale(this.scaleMul * (this.state === 'roll' ? 0.8 : 1), this.scaleMul);
    this.shadow.setAlpha(0.55);
  }

  // -------------------------------------------------------------- damage
  /** Returns the damage actually applied. */
  takeHit(dmg: number, impact: number, fromX: number, fromY: number, opts: { ignoreIframes?: boolean } = {}) {
    if (this.dead) return 0;
    if (this.iframes > 0 && !opts.ignoreIframes) return 0;
    this.hp -= dmg;
    this.hurtFlash = 0.1;
    this.poiseCur -= impact;
    this.poiseT = 2.4;
    const ang = Math.atan2(this.y - fromY, this.x - fromX);
    if (this.hp <= 0) { this.die(); return dmg; }
    if (this.poiseCur <= 0) {
      this.poiseCur = this.poise;
      this.stagger(ang);
    } else if (this.faction !== 'player' && this.state !== 'attack') {
      this.vx += Math.cos(ang) * 1.2;
      this.vy += Math.sin(ang) * 1.2;
    }
    return dmg;
  }

  stagger(ang: number) {
    if (this.boss && this.hp > 0) {
      // bosses only flinch, never get looped
      this.lock = Math.max(this.lock, 0.35);
      this.cancelAttack();
      return;
    }
    this.state = 'hurt';
    this.stateT = 0;
    this.cancelAttack();
    this.play('hurt', true);
    this.vx = Math.cos(ang) * 3.2;
    this.vy = Math.sin(ang) * 3.2;
    this.lock = 0.42;
  }

  cancelAttack() { this.atk = null; this.atkHit.clear(); }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.hp = 0;
    this.state = 'death';
    this.deathT = 0;
    this.cancelAttack();
    this.play('death', true);
    this.scene.onActorDeath(this);
  }

  destroy() { this.sprite.destroy(); this.shadow.destroy(); }

  // ------------------------------------------------------------ movement
  /** Move with wall sliding. Returns true if it actually moved. */
  moveBy(dx: number, dy: number) {
    const w = this.scene.gen;
    let moved = false;
    const r = this.radius;
    const free = (x: number, y: number) =>
      w.walkable(Math.floor(x - r), Math.floor(y - r)) && w.walkable(Math.floor(x + r), Math.floor(y - r)) &&
      w.walkable(Math.floor(x - r), Math.floor(y + r)) && w.walkable(Math.floor(x + r), Math.floor(y + r));
    if (dx && free(this.x + dx, this.y)) { this.x += dx; moved = true; }
    if (dy && free(this.x, this.y + dy)) { this.y += dy; moved = true; }
    return moved;
  }

  separate(others: Actor[]) {
    for (const o of others) {
      if (o === this || o.dead) continue;
      const dx = this.x - o.x, dy = this.y - o.y;
      const d2 = dx * dx + dy * dy;
      const min = this.radius + o.radius;
      if (d2 > min * min || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const push = (min - d) * 0.5;
      this.x += (dx / d) * push; this.y += (dy / d) * push;
    }
  }

  // ---------------------------------------------------------- attack run
  startAttack(a: Attack, haste = 1) {
    this.atk = a;
    this.haste = haste;
    this.atkT = 0;
    this.atkPhase = 'windup';
    this.atkHit.clear();
    this.state = 'attack';
    this.play(a.clip, true);
    this.cd[a.id] = this.scene.now + (a.cooldown ?? 0);
  }

  /** Runs the attack timeline. Returns true while still attacking. */
  stepAttack(dt: number) {
    const a = this.atk;
    if (!a) return false;
    const t = timed(a, this.haste);
    this.atkT += dt;
    const prev = this.atkPhase;
    this.atkPhase = this.atkT < t.windup ? 'windup' : this.atkT < t.windup + t.active ? 'active' : 'recover';
    if (prev !== 'active' && this.atkPhase === 'active') this.scene.onAttackActive(this, a);
    if (this.atkPhase === 'active') {
      const lunge = (a.lunge ?? 0) * (dt / Math.max(0.01, t.active));
      if (lunge) this.moveBy(Math.cos(this.yaw) * lunge, Math.sin(this.yaw) * lunge);
      this.scene.resolveAttackHits(this, a);
    }
    if (this.atkT >= t.total) { this.atk = null; this.state = 'idle'; return false; }
    return true;
  }

  canReach(t: Actor, a: Attack) {
    return inCone(this.x, this.y, this.yaw, a.range * this.scaleMul, a.arc, t.x, t.y, t.radius);
  }

  // ------------------------------------------------------------------ AI
  updateAI(dt: number, player: Actor) {
    const def = this.def;
    const boss = this.boss;
    if (!def && !boss) return;
    const stats = boss ?? def!;
    const dist = Math.hypot(player.x - this.x, player.y - this.y);

    if (!this.aggroed) {
      if (dist < stats.aggro && !player.dead) this.aggroed = true;
      else { this.idleWander(dt); return; }
    }
    if (player.dead) { this.aggroed = false; this.target = null; return; }

    // boss phases
    if (boss) {
      const frac = this.hp / this.maxHp;
      let want = 0;
      for (let i = 0; i < boss.phases.length; i++) if (frac <= boss.phases[i].at) want = i;
      if (want > this.phaseIdx) { this.phaseIdx = want; this.scene.onBossPhase(this, boss.phases[want]); }
      this.haste = boss.phases[this.phaseIdx].haste;
    }

    if (this.atk) {
      // keep facing the target during the windup so the telegraph reads
      if (this.atkPhase === 'windup') this.face(player.x - this.x, player.y - this.y);
      return;
    }

    this.think -= dt;
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafeT = 1 + Math.random() * 1.6; this.strafe = Math.random() < 0.5 ? -1 : 1; }

    const list = boss ? boss.phases[this.phaseIdx].attacks : def!.attacks;
    const spacing = (def?.spacing ?? 0) || (stats.behavior === 'ranged' || stats.behavior === 'caster' ? 5 : 0);
    const prefer = spacing || Math.max(1.0, Math.min(...list.map(a => a.range)) * 0.75);

    // leash home when the player runs away
    if (!boss && dist > stats.leash * 1.6) { this.aggroed = false; this.target = null; return; }

    const ang = Math.atan2(player.y - this.y, player.x - this.x);

    // Skittish animals bolt instead of closing; they never attack.
    if (stats.behavior === 'skittish') {
      if (dist > stats.aggro * 2.6) { this.aggroed = false; return; }
      const away = ang + Math.PI + Math.sin(this.scene.now * 1.7 + this.home.x) * 0.5;
      const mvx = Math.cos(away), mvy = Math.sin(away);
      this.face(mvx, mvy);
      const ok = this.moveBy(mvx * stats.runSpeed * dt, mvy * stats.runSpeed * dt);
      this.play(ok ? 'run' : 'idle');
      this.advanceClip(dt, 1.1);
      return;
    }

    this.face(player.x - this.x, player.y - this.y);

    let mx = 0, my = 0;
    const far = dist > prefer + 0.6;
    const close = dist < prefer - 0.8;
    const sp = (far ? stats.runSpeed : stats.speed);
    if (far) { mx = Math.cos(ang); my = Math.sin(ang); }
    else if (close) { mx = -Math.cos(ang) * 0.8; my = -Math.sin(ang) * 0.8; }
    else { mx = -Math.sin(ang) * this.strafe * 0.7; my = Math.cos(ang) * this.strafe * 0.7; }

    // stay inside a boss arena
    if (this.arena) {
      const d = Math.hypot(this.x - this.arena.x, this.y - this.arena.y);
      if (d > this.arena.r) {
        mx += ((this.arena.x - this.x) / d) * 1.5;
        my += ((this.arena.y - this.y) / d) * 1.5;
      }
    }

    const moved = this.moveBy(mx * sp * dt, my * sp * dt);
    this.play(moved ? (far ? (this.baked.clips.has('run') ? 'run' : 'walk') : 'walk') : 'idle');
    this.advanceClip(dt, far ? 1 : 0.9);

    if (this.think <= 0) {
      const a = chooseAttack(list, dist, this.cd, this.scene.now);
      if (a && dist <= a.range * this.scaleMul + 0.5 && dist >= (a.minRange ?? 0)) {
        this.startAttack(a, this.haste);
        this.think = (stats.cadence ?? 1.3) / this.haste;
      } else {
        this.think = 0.22;
      }
    }
  }

  idleWander(dt: number) {
    this.think -= dt;
    if (this.think <= 0) {
      this.think = 2 + Math.random() * 3;
      if (Math.random() < 0.55) {
        const a = Math.random() * Math.PI * 2;
        this.target = { x: this.home.x + Math.cos(a) * 4, y: this.home.y + Math.sin(a) * 4 } as unknown as Actor;
      } else this.target = null;
    }
    if (this.target) {
      const dx = this.target.x - this.x, dy = this.target.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.3) { this.target = null; this.play('idle'); }
      else {
        const sp = (this.def?.speed ?? 1.2) * 0.55;
        this.face(dx, dy);
        if (!this.moveBy((dx / d) * sp * dt, (dy / d) * sp * dt)) this.target = null;
        this.play('walk');
      }
    } else this.play('idle');
    this.advanceClip(dt, 0.8);
  }

  // ---------------------------------------------------------------- frame
  update(dt: number) {
    if (this.hurtFlash > 0) {
      this.hurtFlash -= dt;
      if (this.hurtFlash <= 0) { this.sprite.clearTint(); this.sprite.setTintMode(Phaser.TintModes.MULTIPLY); }
      else { this.sprite.setTint(0xffd0c0); this.sprite.setTintMode(Phaser.TintModes.FILL); }
    }
    if (this.iframes > 0) this.iframes -= dt;
    if (this.lock > 0) this.lock -= dt;
    if (this.poiseT > 0) { this.poiseT -= dt; if (this.poiseT <= 0) this.poiseCur = this.poise; }

    // friction on knockback
    if (this.vx || this.vy) {
      this.moveBy(this.vx * dt, this.vy * dt);
      const k = Math.exp(-dt * 9);
      this.vx *= k; this.vy *= k;
      if (Math.abs(this.vx) < 0.02) this.vx = 0;
      if (Math.abs(this.vy) < 0.02) this.vy = 0;
    }

    if (this.dead) {
      this.deathT += dt;
      this.advanceClip(dt);
      this.shadow.setAlpha(clamp(0.55 - this.deathT * 0.25, 0, 0.55));
      if (this.deathT > 2.2) this.sprite.setAlpha(clamp(1 - (this.deathT - 2.2) / 1.4, 0, 1));
      this.applyFrame();
      this.sync();
      return;
    }

    if (this.state === 'hurt') {
      this.stateT += dt;
      this.advanceClip(dt);
      if (this.lock <= 0) { this.state = 'idle'; this.play('idle'); }
    } else if (this.atk) {
      this.stepAttack(dt);
      this.advanceClip(dt, this.haste);
    }

    this.applyFrame();
    this.sync();
  }
}

export const SPRITE_BOX = { w: SPR_W, h: SPR_H };
