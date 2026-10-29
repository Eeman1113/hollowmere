// Pure combat maths. Kept away from the scene so it can be reasoned about and
// tuned without touching rendering.

import type { Attack } from './content/enemies';

/** Shortest signed difference between two angles. */
export function angDiff(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Does a cone attack from (ax,ay) facing `face` reach (tx,ty)? */
export function inCone(ax: number, ay: number, face: number, range: number, arc: number, tx: number, ty: number, targetR = 0.45) {
  const dx = tx - ax, dy = ty - ay;
  const d = Math.hypot(dx, dy);
  if (d > range + targetR) return false;
  if (d < 0.05) return true;
  return Math.abs(angDiff(Math.atan2(dy, dx), face)) <= arc + targetR / Math.max(0.4, d);
}

export interface DamageIn {
  raw: number;
  holy?: number;
  /** Target's flat physical mitigation. */
  armor: number;
  /** Fractional reduction, 0..1. */
  reduce: number;
  /** Target takes extra holy damage (hollow things). */
  hollowMul?: number;
  /** Attack landed from behind. */
  back?: boolean;
  /** Target was staggered — criticals land. */
  staggered?: boolean;
  /** Blocking absorbs this fraction. */
  blocked?: number;
}

export interface DamageOut { dmg: number; crit: boolean; blocked: boolean }

export function resolveDamage(d: DamageIn): DamageOut {
  let v = d.raw;
  if (d.holy) v += d.holy * (d.hollowMul ?? 1);
  const crit = !!(d.back || d.staggered);
  if (crit) v *= d.staggered ? 2.4 : 1.7;
  v = Math.max(1, v - d.armor) * (1 - Math.min(0.85, d.reduce));
  const blocked = !!d.blocked;
  if (blocked) v *= 1 - d.blocked!;
  return { dmg: Math.max(1, Math.round(v)), crit, blocked };
}

/** Flat armour converted to a fractional reduction with diminishing returns. */
export const armorReduction = (phys: number) => phys / (phys + 95);

export const ROLL = {
  /** Seconds of invulnerability, from roll start. */
  iframes: 0.34,
  /** Total roll duration. */
  dur: 0.52,
  /** Distance covered, in tiles. */
  dist: 3.0,
  stamina: 22,
};
export const BACKSTEP = { dur: 0.3, dist: 1.5, stamina: 11 };
export const SPRINT_DRAIN = 16;
export const BLOCK_REGEN_PENALTY = 0.35;

/** Attack timing scaled by a haste multiplier (boss phases). */
export function timed(a: Attack, haste: number) {
  return {
    windup: a.windup / haste,
    active: a.active,
    recover: a.recover / haste,
    total: a.windup / haste + a.active + a.recover / haste,
  };
}

/** Weighted pick that respects range gates and cooldowns. */
export function chooseAttack(list: Attack[], dist: number, cd: Record<string, number>, now: number) {
  const ok = list.filter(a => dist <= a.range + 0.4 && dist >= (a.minRange ?? 0) && (cd[a.id] ?? 0) <= now);
  const pool = ok.length ? ok : list.filter(a => (cd[a.id] ?? 0) <= now);
  if (!pool.length) return null;
  let total = 0;
  for (const a of pool) total += a.weight ?? 1;
  let n = Math.random() * total;
  for (const a of pool) { n -= a.weight ?? 1; if (n <= 0) return a; }
  return pool[pool.length - 1];
}
