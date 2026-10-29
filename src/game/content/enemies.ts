// Enemy definitions. Every attack has an explicit windup / active / recovery
// window so fights are readable and dodgeable rather than damage-on-contact.

import type { ClipName } from '../art/anim';
import type { Col } from '../art/raster';
import { P } from '../art/palette';

export type AttackKind = 'melee' | 'ranged' | 'aoe' | 'dash' | 'summon' | 'grab';

export interface Attack {
  id: string;
  clip: ClipName;
  /** Telegraph time in seconds. */
  windup: number;
  /** How long the hitbox is live. */
  active: number;
  /** Lock-out after the swing. */
  recover: number;
  /** Max distance in tiles the attack can start from. */
  range: number;
  /** Half-angle of the hit cone in radians. */
  arc: number;
  dmgMul: number;
  impact: number;
  kind: AttackKind;
  /** Forward movement in tiles over the active window. */
  lunge?: number;
  /** AoE radius in tiles for aoe attacks. */
  radius?: number;
  /** Projectile speed in tiles/s. */
  speed?: number;
  /** Telegraph tint. */
  tell?: Col;
  /** Attacks tagged unblockable force a dodge. */
  unblockable?: boolean;
  /** Minimum range — enemies back off before using it. */
  minRange?: number;
  /** Relative pick weight. */
  weight?: number;
  cooldown?: number;
  summon?: string;
}

const atk = (o: Partial<Attack> & { id: string }): Attack => ({
  clip: 'attack1', windup: 0.45, active: 0.16, recover: 0.5, range: 1.5, arc: 1.1,
  dmgMul: 1, impact: 12, kind: 'melee', weight: 1, ...o,
});

export type Behavior = 'melee' | 'ranged' | 'beast' | 'caster' | 'skittish' | 'sentry';

export interface EnemyDef {
  id: string;
  name: string;
  /** Key into LOOKS, or BEASTS when `rig` is 'beast'. */
  look: string;
  /** Which skeleton drives it. */
  rig?: 'humanoid' | 'beast';
  hp: number;
  dmg: number;
  /** Damage reduction, 0..1. */
  armor: number;
  /** Hits-to-stagger budget. */
  poise: number;
  speed: number;
  runSpeed: number;
  aggro: number;
  leash: number;
  tier: number;
  runes: number;
  behavior: Behavior;
  attacks: Attack[];
  drops: [string, number, number, number][];
  /** Spawns only after dusk. */
  night?: boolean;
  /** Extra sprite scale. */
  scale?: number;
  /** Holy damage multiplier taken — Hollow things burn. */
  hollow?: number;
  /** Seconds between attack attempts. */
  cadence?: number;
  /** How far it strafes before committing. */
  spacing?: number;
}

export const ENEMIES: Record<string, EnemyDef> = {
  hollow: {
    id: 'hollow', name: 'Hollow', look: 'hollow', hp: 120, dmg: 16, armor: 0.02, poise: 14,
    speed: 1.5, runSpeed: 3.0, aggro: 7, leash: 20, tier: 0, runes: 32, behavior: 'melee', hollow: 1.5, cadence: 1.4,
    attacks: [
      atk({ id: 'slash', windup: 0.42, active: 0.14, recover: 0.5, range: 1.4, dmgMul: 1, impact: 10, lunge: 0.6 }),
      atk({ id: 'lunge', clip: 'heavy', windup: 0.62, active: 0.2, recover: 0.78, range: 2.4, dmgMul: 1.5, impact: 22, lunge: 1.8, weight: 0.4, tell: P.crimsonLit }),
    ],
    drops: [['rune_shard', 1, 1, 2], ['bandage', 0.18, 1, 1], ['fen_salt', 0.25, 1, 2], ['rusted_dagger', 0.03, 1, 1]],
  },
  hollow_axe: {
    id: 'hollow_axe', name: 'Hollow Woodsman', look: 'hollow_axe', hp: 165, dmg: 22, armor: 0.06, poise: 22,
    speed: 1.4, runSpeed: 2.7, aggro: 7, leash: 20, tier: 1, runes: 54, behavior: 'melee', hollow: 1.5, cadence: 1.7,
    attacks: [
      atk({ id: 'chop', clip: 'heavy', windup: 0.66, active: 0.18, recover: 0.72, range: 1.5, dmgMul: 1.2, impact: 26, lunge: 0.5 }),
      atk({ id: 'swing', windup: 0.46, active: 0.16, recover: 0.5, range: 1.6, arc: 1.5, dmgMul: 0.9, impact: 16 }),
    ],
    drops: [['rune_shard', 1, 2, 4], ['beast_bone', 0.2, 1, 1], ['fen_salt', 0.3, 1, 2], ['ashen_shortsword', 0.04, 1, 1]],
  },
  fenhound: {
    id: 'fenhound', name: 'Fenhound', look: 'fenhound', rig: 'beast', hp: 95, dmg: 18, armor: 0, poise: 8,
    speed: 2.6, runSpeed: 4.6, aggro: 9, leash: 26, tier: 0, runes: 40, behavior: 'beast', cadence: 1.0, spacing: 3.5,
    scale: 0.82,
    attacks: [
      atk({ id: 'bite', windup: 0.3, active: 0.12, recover: 0.4, range: 1.3, dmgMul: 1, impact: 8, lunge: 1.4 }),
      atk({ id: 'pounce', clip: 'heavy', windup: 0.46, active: 0.2, recover: 0.66, range: 4.0, dmgMul: 1.4, impact: 18, lunge: 3.4, kind: 'dash', weight: 0.6, tell: P.crimsonLit }),
    ],
    drops: [['rune_shard', 1, 1, 3], ['beast_bone', 0.45, 1, 2], ['wolf_pelt', 0.3, 1, 1]],
  },
  emberhound: {
    id: 'emberhound', name: 'Emberhound', look: 'emberhound', rig: 'beast', hp: 150, dmg: 26, armor: 0.04, poise: 12,
    speed: 2.8, runSpeed: 5.0, aggro: 10, leash: 28, tier: 3, runes: 130, behavior: 'beast', cadence: 0.9, spacing: 4,
    scale: 0.9,
    attacks: [
      atk({ id: 'bite', windup: 0.28, active: 0.12, recover: 0.38, range: 1.4, dmgMul: 1, impact: 10, lunge: 1.6 }),
      atk({ id: 'pounce', clip: 'heavy', windup: 0.42, active: 0.2, recover: 0.6, range: 4.6, dmgMul: 1.5, impact: 22, lunge: 4.0, kind: 'dash', weight: 0.7, tell: P.flame }),
      atk({ id: 'burst', clip: 'cast', windup: 0.7, active: 0.22, recover: 0.8, range: 2.4, radius: 2.8, dmgMul: 1.3, impact: 20, kind: 'aoe', weight: 0.3, tell: P.flame, unblockable: true }),
    ],
    drops: [['rune_shard', 1, 4, 7], ['emberglass', 0.4, 1, 2], ['beast_bone', 0.5, 1, 2], ['beast_hide', 0.3, 1, 1]],
  },
  ghoul: {
    id: 'ghoul', name: 'Grave Ghoul', look: 'ghoul', hp: 130, dmg: 20, armor: 0, poise: 10,
    speed: 2.0, runSpeed: 4.0, aggro: 8, leash: 22, tier: 1, runes: 60, behavior: 'beast', hollow: 1.3, cadence: 1.1,
    attacks: [
      atk({ id: 'rake', windup: 0.32, active: 0.14, recover: 0.36, range: 1.4, arc: 1.3, dmgMul: 0.85, impact: 7, lunge: 0.8 }),
      atk({ id: 'rake2', windup: 0.2, active: 0.14, recover: 0.5, range: 1.4, arc: 1.3, dmgMul: 0.85, impact: 7, lunge: 0.6 }),
      atk({ id: 'leap', clip: 'heavy', windup: 0.5, active: 0.18, recover: 0.7, range: 4.2, dmgMul: 1.4, impact: 20, lunge: 3.2, kind: 'dash', weight: 0.5, tell: P.crimsonLit }),
    ],
    drops: [['rune_shard', 1, 2, 4], ['beast_bone', 0.4, 1, 2], ['hollow_tooth', 0.22, 1, 1], ['pale_ash', 0.12, 1, 1]],
  },
  rotspawn: {
    id: 'rotspawn', name: 'Rotspawn', look: 'rotbeast', rig: 'beast', hp: 180, dmg: 22, armor: 0.05, poise: 20,
    speed: 1.2, runSpeed: 2.2, aggro: 6, leash: 16, tier: 2, runes: 90, behavior: 'melee', cadence: 1.8, scale: 1.05,
    attacks: [
      atk({ id: 'swipe', windup: 0.56, active: 0.18, recover: 0.6, range: 1.7, arc: 1.6, dmgMul: 1.1, impact: 20 }),
      atk({ id: 'spores', clip: 'cast', windup: 0.8, active: 0.3, recover: 0.9, range: 3.0, radius: 3.4, dmgMul: 0.9, impact: 10, kind: 'aoe', weight: 0.5, tell: P.rotGlow, unblockable: true }),
    ],
    drops: [['rune_shard', 1, 3, 5], ['bloodwort_tonic', 0.2, 1, 1], ['pale_ash', 0.2, 1, 1], ['fen_salt', 0.3, 1, 2]],
  },
  drowned: {
    id: 'drowned', name: 'The Drowned', look: 'choirman', hp: 160, dmg: 24, armor: 0.08, poise: 18,
    speed: 1.3, runSpeed: 2.4, aggro: 8, leash: 18, tier: 2, runes: 95, behavior: 'melee', hollow: 1.4, cadence: 1.6,
    attacks: [
      atk({ id: 'reap', windup: 0.56, active: 0.2, recover: 0.6, range: 2.2, arc: 1.5, dmgMul: 1.1, impact: 18, lunge: 0.7 }),
      atk({ id: 'drag', clip: 'heavy', windup: 0.74, active: 0.22, recover: 0.84, range: 2.4, dmgMul: 1.5, impact: 28, lunge: 1.2, weight: 0.4, tell: P.moon }),
    ],
    drops: [['rune_shard', 1, 3, 6], ['pale_ash', 0.35, 1, 2], ['drowned_coin', 0.5, 1, 3]],
  },
  // --- wildlife
  deer: {
    id: 'deer', name: 'Fen Deer', look: 'deer', rig: 'beast', hp: 70, dmg: 0, armor: 0, poise: 6,
    speed: 2.4, runSpeed: 5.4, aggro: 6, leash: 30, tier: 0, runes: 18, behavior: 'skittish', cadence: 9, spacing: 10,
    attacks: [atk({ id: 'none', windup: 0.5, active: 0.1, recover: 0.6, range: 0.9, dmgMul: 0, impact: 0 })],
    drops: [['rune_shard', 1, 1, 2], ['beast_bone', 0.6, 1, 2], ['beast_hide', 0.3, 1, 1], ['bandage', 0.3, 1, 1]],
  },
  stag: {
    id: 'stag', name: 'Grey Stag', look: 'stag', rig: 'beast', hp: 160, dmg: 20, armor: 0.04, poise: 26,
    speed: 2.2, runSpeed: 5.0, aggro: 4, leash: 26, tier: 1, runes: 70, behavior: 'beast', cadence: 2.0, spacing: 4,
    attacks: [
      atk({ id: 'gore', clip: 'heavy', windup: 0.6, active: 0.22, recover: 0.8, range: 5, dmgMul: 1.3, impact: 30, lunge: 4.4, kind: 'dash', tell: P.bone }),
      atk({ id: 'buck', windup: 0.44, active: 0.16, recover: 0.5, range: 1.6, dmgMul: 0.9, impact: 18, lunge: 0.6 }),
    ],
    drops: [['rune_shard', 1, 3, 5], ['beast_bone', 1, 2, 3], ['beast_hide', 0.4, 1, 1]],
  },
  wolf: {
    id: 'wolf', name: 'Moor Wolf', look: 'wolf', rig: 'beast', hp: 110, dmg: 19, armor: 0.02, poise: 10,
    speed: 2.7, runSpeed: 4.9, aggro: 10, leash: 28, tier: 1, runes: 56, behavior: 'beast', cadence: 1.0, spacing: 3.6,
    attacks: [
      atk({ id: 'bite', windup: 0.3, active: 0.12, recover: 0.38, range: 1.3, dmgMul: 1, impact: 9, lunge: 1.5 }),
      atk({ id: 'pounce', clip: 'heavy', windup: 0.44, active: 0.2, recover: 0.6, range: 4.4, dmgMul: 1.4, impact: 20, lunge: 3.8, kind: 'dash', weight: 0.7, tell: P.crimsonLit }),
    ],
    drops: [['rune_shard', 1, 2, 4], ['beast_bone', 0.7, 1, 2], ['wolf_pelt', 0.65, 1, 1]],
  },
  boar: {
    id: 'boar', name: 'Black Boar', look: 'boar', rig: 'beast', hp: 190, dmg: 26, armor: 0.1, poise: 40,
    speed: 1.8, runSpeed: 4.6, aggro: 5, leash: 22, tier: 1, runes: 80, behavior: 'beast', cadence: 1.8, spacing: 3,
    attacks: [
      atk({ id: 'tusk', windup: 0.46, active: 0.18, recover: 0.6, range: 1.5, arc: 1.4, dmgMul: 1, impact: 26, lunge: 1.0 }),
      atk({ id: 'charge', clip: 'run', windup: 0.56, active: 0.44, recover: 0.76, range: 7, dmgMul: 1.5, impact: 44, lunge: 6.4, kind: 'dash', weight: 0.5, tell: P.crimsonLit, minRange: 3 }),
    ],
    drops: [['rune_shard', 1, 3, 6], ['beast_bone', 1, 1, 3], ['beast_hide', 0.55, 1, 1]],
  },

  redhand: {
    id: 'redhand', name: 'Redhand Cutthroat', look: 'redhand', hp: 175, dmg: 24, armor: 0.1, poise: 24,
    speed: 1.8, runSpeed: 3.6, aggro: 9, leash: 24, tier: 2, runes: 86, behavior: 'melee', cadence: 1.2, spacing: 2.2,
    attacks: [
      atk({ id: 'slash', windup: 0.36, active: 0.14, recover: 0.4, range: 1.5, dmgMul: 0.95, impact: 14, lunge: 0.8 }),
      atk({ id: 'combo', windup: 0.2, active: 0.14, recover: 0.52, range: 1.5, dmgMul: 0.95, impact: 14, lunge: 0.6 }),
      atk({ id: 'gut', clip: 'heavy', windup: 0.62, active: 0.18, recover: 0.76, range: 1.9, dmgMul: 1.6, impact: 30, lunge: 1.6, weight: 0.4, tell: P.crimsonLit }),
    ],
    drops: [['rune_shard', 1, 3, 6], ['bloodletter', 0.05, 1, 1], ['bandage', 0.3, 1, 2], ['drowned_coin', 0.3, 1, 2], ['throwing_knife', 0.25, 1, 3]],
  },
  redhand_bow: {
    id: 'redhand_bow', name: 'Redhand Marksman', look: 'redhand_bow', hp: 120, dmg: 22, armor: 0.05, poise: 12,
    speed: 1.7, runSpeed: 3.6, aggro: 13, leash: 20, tier: 2, runes: 78, behavior: 'ranged', cadence: 2.0, spacing: 7,
    attacks: [
      atk({ id: 'shot', clip: 'cast', windup: 0.72, active: 0.1, recover: 0.6, range: 11, arc: 0.2, dmgMul: 1, impact: 8, kind: 'ranged', speed: 16, tell: P.crimsonLit }),
      atk({ id: 'kick', windup: 0.34, active: 0.12, recover: 0.5, range: 1.4, dmgMul: 0.6, impact: 18, weight: 0.3 }),
    ],
    drops: [['rune_shard', 1, 2, 5], ['throwing_knife', 0.4, 2, 4], ['drowned_coin', 0.25, 1, 2], ['hunters_buckler', 0.04, 1, 1]],
  },
  beastman: {
    id: 'beastman', name: 'Beast of the Rotwood', look: 'beastman', hp: 330, dmg: 34, armor: 0.12, poise: 46,
    speed: 1.9, runSpeed: 4.2, aggro: 10, leash: 28, tier: 3, runes: 220, behavior: 'beast', cadence: 1.3, scale: 1.1,
    attacks: [
      atk({ id: 'cleave', windup: 0.5, active: 0.18, recover: 0.56, range: 1.9, arc: 1.7, dmgMul: 1, impact: 26, lunge: 1.0 }),
      atk({ id: 'cleave2', windup: 0.24, active: 0.18, recover: 0.7, range: 1.9, arc: 1.7, dmgMul: 1, impact: 26, lunge: 0.8 }),
      atk({ id: 'slam', clip: 'heavy', windup: 0.78, active: 0.22, recover: 0.9, range: 2.2, radius: 3.0, dmgMul: 1.7, impact: 48, kind: 'aoe', weight: 0.4, tell: P.bloodMoon, unblockable: true }),
      atk({ id: 'charge', clip: 'run', windup: 0.56, active: 0.5, recover: 0.7, range: 7, dmgMul: 1.3, impact: 36, lunge: 6.5, kind: 'dash', weight: 0.35, tell: P.bloodMoon, minRange: 3.5 }),
    ],
    drops: [['rune_shard', 1, 6, 10], ['beast_bone', 0.8, 1, 3], ['beast_hide', 0.7, 1, 2], ['beastcleaver', 0.05, 1, 1], ['hunter_tricorn', 0.03, 1, 1]],
  },
  wraith: {
    id: 'wraith', name: 'Hollow Wraith', look: 'wraith', hp: 140, dmg: 28, armor: 0.15, poise: 10,
    speed: 1.6, runSpeed: 3.2, aggro: 10, leash: 24, tier: 2, runes: 110, behavior: 'caster', night: true, hollow: 2.0, cadence: 1.8, spacing: 5,
    attacks: [
      atk({ id: 'reach', windup: 0.5, active: 0.16, recover: 0.5, range: 1.8, dmgMul: 1, impact: 8, lunge: 1.2 }),
      atk({ id: 'bolt', clip: 'cast', windup: 0.8, active: 0.1, recover: 0.7, range: 9, arc: 0.3, dmgMul: 1.2, impact: 10, kind: 'ranged', speed: 9, tell: P.hollow, unblockable: false }),
      atk({ id: 'blink', clip: 'roll', windup: 0.2, active: 0.3, recover: 0.4, range: 6, dmgMul: 0, impact: 0, kind: 'dash', lunge: 4.5, weight: 0.4 }),
    ],
    drops: [['rune_shard', 1, 4, 8], ['hollow_marrow', 0.3, 1, 1], ['hollow_tooth', 0.4, 1, 2], ['pale_ash', 0.4, 1, 2]],
  },
  choirman: {
    id: 'choirman', name: 'Choirman', look: 'choirman', hp: 210, dmg: 30, armor: 0.14, poise: 26,
    speed: 1.4, runSpeed: 2.8, aggro: 9, leash: 22, tier: 4, runes: 190, behavior: 'caster', hollow: 1.3, cadence: 1.7, spacing: 4,
    attacks: [
      atk({ id: 'reap', windup: 0.56, active: 0.2, recover: 0.58, range: 2.3, arc: 1.6, dmgMul: 1, impact: 22, lunge: 0.8 }),
      atk({ id: 'hymn', clip: 'cast', windup: 1.0, active: 0.3, recover: 0.9, range: 5, radius: 4.0, dmgMul: 1.3, impact: 26, kind: 'aoe', weight: 0.4, tell: P.moon, unblockable: true }),
      atk({ id: 'lance', clip: 'cast', windup: 0.76, active: 0.12, recover: 0.6, range: 10, arc: 0.2, dmgMul: 1.1, impact: 12, kind: 'ranged', speed: 12, tell: P.moonPale, weight: 0.6 }),
    ],
    drops: [['rune_shard', 1, 7, 12], ['pale_ash', 0.7, 1, 3], ['choir_bell', 0.3, 1, 1], ['choir_scythe', 0.04, 1, 1], ['choir_veil', 0.04, 1, 1]],
  },
  gravewarden: {
    id: 'gravewarden', name: 'Gravewarden', look: 'gravewarden', hp: 420, dmg: 38, armor: 0.26, poise: 70,
    speed: 1.2, runSpeed: 2.4, aggro: 8, leash: 20, tier: 3, runes: 280, behavior: 'sentry', cadence: 1.9, scale: 1.08,
    attacks: [
      atk({ id: 'sweep', windup: 0.72, active: 0.22, recover: 0.74, range: 2.6, arc: 1.9, dmgMul: 1, impact: 34, lunge: 0.8 }),
      atk({ id: 'thrust', windup: 0.56, active: 0.16, recover: 0.62, range: 3.2, arc: 0.5, dmgMul: 1.1, impact: 28, lunge: 2.0 }),
      atk({ id: 'quake', clip: 'heavy', windup: 0.95, active: 0.26, recover: 1.0, range: 2.6, radius: 3.6, dmgMul: 1.8, impact: 60, kind: 'aoe', weight: 0.35, tell: P.flame, unblockable: true }),
    ],
    drops: [['rune_shard', 1, 9, 15], ['gravewarden_halberd', 0.05, 1, 1], ['grave_helm', 0.04, 1, 1], ['grave_wax', 0.4, 1, 2], ['hollow_marrow', 0.2, 1, 1]],
  },
  inquisitor: {
    id: 'inquisitor', name: 'Inquisitor of the Reach', look: 'inquisitor', hp: 360, dmg: 36, armor: 0.2, poise: 52,
    speed: 1.7, runSpeed: 3.4, aggro: 10, leash: 26, tier: 4, runes: 300, behavior: 'melee', cadence: 1.3, spacing: 2.5,
    attacks: [
      atk({ id: 'lash', windup: 0.44, active: 0.18, recover: 0.46, range: 1.9, arc: 1.4, dmgMul: 0.95, impact: 24, lunge: 1.0 }),
      atk({ id: 'lash2', windup: 0.2, active: 0.18, recover: 0.42, range: 1.9, arc: 1.4, dmgMul: 0.95, impact: 24, lunge: 0.8 }),
      atk({ id: 'lash3', windup: 0.22, active: 0.2, recover: 0.8, range: 2.1, arc: 1.6, dmgMul: 1.2, impact: 32, lunge: 1.2 }),
      atk({ id: 'brand', clip: 'cast', windup: 0.9, active: 0.26, recover: 0.86, range: 3, radius: 3.2, dmgMul: 1.6, impact: 44, kind: 'aoe', weight: 0.3, tell: P.flame, unblockable: true }),
    ],
    drops: [['rune_shard', 1, 10, 16], ['executioners_flail', 0.05, 1, 1], ['silver_reliquary', 0.25, 1, 1], ['ash_resin', 0.3, 1, 2]],
  },
};

export const ENEMY_LIST = Object.values(ENEMIES);

/** Scale an enemy's numbers to the local danger tier. */
export function scaled(def: EnemyDef, tier: number) {
  const d = Math.max(0, tier - def.tier);
  const k = 1 + d * 0.18;
  return {
    hp: Math.round(def.hp * k),
    dmg: Math.round(def.dmg * (1 + d * 0.13)),
    runes: Math.round(def.runes * (1 + d * 0.22)),
    poise: Math.round(def.poise * (1 + d * 0.1)),
  };
}
