// Bosses. Each is a phased fight: the phase swaps the move pool, speeds the
// enemy up and adds a new mechanic, so the second half reads differently.

import { P } from '../art/palette';
import type { Attack, EnemyDef } from './enemies';

export interface Phase {
  /** Enter this phase when HP drops below this fraction. */
  at: number;
  /** Multiplies move speed and shortens windups. */
  haste: number;
  attacks: Attack[];
  /** Line spoken on entering the phase. */
  line?: string;
  /** Shockwave / arena effect fired on transition. */
  burst?: { radius: number; dmgMul: number };
  summon?: { id: string; count: number };
}

export interface BossDef extends Omit<EnemyDef, 'attacks'> {
  title: string;
  phases: Phase[];
  /** Arena radius in tiles. */
  arena: number;
  /** Awarded on death. */
  remembrance: string;
  /** Short epitaph shown on the victory banner. */
  epitaph: string;
  /** Opening line on fog-wall entry. */
  intro: string;
}

const A = (o: Partial<Attack> & { id: string }): Attack => ({
  clip: 'attack1', windup: 0.5, active: 0.18, recover: 0.6, range: 2, arc: 1.3,
  dmgMul: 1, impact: 30, kind: 'melee', weight: 1, ...o,
});

export const BOSSES: Record<string, BossDef> = {
  // ---------------------------------------------------------------- boss 1
  choir: {
    id: 'choir', name: 'The Warden', title: 'Warden of the Drowned Choir',
    look: 'boss_choir', hp: 2400, dmg: 42, armor: 0.16, poise: 120,
    speed: 1.6, runSpeed: 3.4, aggro: 99, leash: 999, tier: 2, runes: 3200,
    behavior: 'caster', hollow: 1.2, cadence: 1.2, scale: 1.0, arena: 11,
    remembrance: 'rem_choir',
    intro: 'It does not turn to face you. It has been facing the door for nine hundred years.',
    epitaph: 'The singing stops. The water, at last, is only water.',
    drops: [['rune_shard', 1, 40, 60], ['pale_ash', 1, 3, 5]],
    phases: [
      {
        at: 1, haste: 1,
        attacks: [
          A({ id: 'reap', windup: 0.62, active: 0.2, recover: 0.6, range: 3.0, arc: 1.6, dmgMul: 1, impact: 34, lunge: 1.2 }),
          A({ id: 'reap2', windup: 0.26, active: 0.2, recover: 0.78, range: 3.0, arc: 1.8, dmgMul: 1.05, impact: 34, lunge: 1.0 }),
          A({ id: 'dirge', clip: 'cast', windup: 1.05, active: 0.3, recover: 0.95, range: 6, radius: 4.6, dmgMul: 1.5, impact: 60, kind: 'aoe', tell: P.moon, unblockable: true, weight: 0.5 }),
          A({ id: 'lance', clip: 'cast', windup: 0.8, active: 0.12, recover: 0.6, range: 12, arc: 0.18, dmgMul: 1.1, impact: 16, kind: 'ranged', speed: 13, tell: P.moonPale, weight: 0.7 }),
          A({ id: 'glide', clip: 'roll', windup: 0.24, active: 0.34, recover: 0.4, range: 9, dmgMul: 0, impact: 0, kind: 'dash', lunge: 6.0, weight: 0.5 }),
        ],
      },
      {
        at: 0.55, haste: 1.22,
        line: 'The Warden lifts its veil. Underneath, the flood.',
        burst: { radius: 6.5, dmgMul: 1.2 },
        summon: { id: 'drowned', count: 2 },
        attacks: [
          A({ id: 'reap', windup: 0.52, active: 0.2, recover: 0.5, range: 3.2, arc: 1.7, dmgMul: 1.1, impact: 36, lunge: 1.4 }),
          A({ id: 'reap2', windup: 0.22, active: 0.2, recover: 0.5, range: 3.2, arc: 1.8, dmgMul: 1.1, impact: 36, lunge: 1.2 }),
          A({ id: 'reap3', windup: 0.22, active: 0.24, recover: 0.9, range: 3.4, arc: 2.1, dmgMul: 1.3, impact: 48, lunge: 1.6, tell: P.moon }),
          A({ id: 'requiem', clip: 'cast', windup: 1.2, active: 0.4, recover: 1.0, range: 8, radius: 6.2, dmgMul: 1.8, impact: 80, kind: 'aoe', tell: P.frost, unblockable: true, weight: 0.5 }),
          A({ id: 'volley', clip: 'cast', windup: 0.7, active: 0.14, recover: 0.5, range: 12, arc: 0.5, dmgMul: 0.9, impact: 14, kind: 'ranged', speed: 11, tell: P.moonPale, weight: 0.9 }),
          A({ id: 'glide', clip: 'roll', windup: 0.2, active: 0.3, recover: 0.3, range: 10, dmgMul: 0, impact: 0, kind: 'dash', lunge: 7.0, weight: 0.6 }),
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- boss 2
  bride: {
    id: 'bride', name: 'Vaelith', title: 'The Pale Bride',
    look: 'boss_bride', hp: 3400, dmg: 48, armor: 0.12, poise: 90,
    speed: 2.3, runSpeed: 5.0, aggro: 99, leash: 999, tier: 3, runes: 5600,
    behavior: 'melee', cadence: 0.95, arena: 12,
    remembrance: 'rem_bride',
    intro: 'She has been dressed for this for three hundred years. You are late.',
    epitaph: 'The veil settles. Whatever she was waiting for, it was never you.',
    drops: [['rune_shard', 1, 70, 100], ['pale_ash', 1, 4, 7]],
    phases: [
      {
        at: 1, haste: 1,
        attacks: [
          A({ id: 'thrust', clip: 'attack2', windup: 0.38, active: 0.14, recover: 0.4, range: 3.0, arc: 0.6, dmgMul: 1, impact: 22, lunge: 2.4 }),
          A({ id: 'thrust2', clip: 'attack2', windup: 0.18, active: 0.14, recover: 0.36, range: 3.0, arc: 0.6, dmgMul: 1, impact: 22, lunge: 2.0 }),
          A({ id: 'flurry', clip: 'attack1', windup: 0.2, active: 0.4, recover: 0.8, range: 2.6, arc: 1.2, dmgMul: 1.4, impact: 40, lunge: 1.4, tell: P.crimsonLit }),
          A({ id: 'step', clip: 'roll', windup: 0.14, active: 0.26, recover: 0.26, range: 8, dmgMul: 0, impact: 0, kind: 'dash', lunge: 5.0, weight: 0.8 }),
          A({ id: 'thorn', clip: 'cast', windup: 0.74, active: 0.22, recover: 0.7, range: 5, radius: 3.4, dmgMul: 1.3, impact: 40, kind: 'aoe', tell: P.crimson, unblockable: true, weight: 0.4 }),
        ],
      },
      {
        at: 0.6, haste: 1.3,
        line: 'Vaelith laughs, and the laugh does not stop when her mouth does.',
        burst: { radius: 7, dmgMul: 1.3 },
        attacks: [
          A({ id: 'thrust', clip: 'attack2', windup: 0.3, active: 0.14, recover: 0.3, range: 3.4, arc: 0.6, dmgMul: 1.05, impact: 24, lunge: 3.0 }),
          A({ id: 'thrust2', clip: 'attack2', windup: 0.14, active: 0.14, recover: 0.28, range: 3.4, arc: 0.6, dmgMul: 1.05, impact: 24, lunge: 2.6 }),
          A({ id: 'thrust3', clip: 'attack2', windup: 0.14, active: 0.16, recover: 0.7, range: 3.6, arc: 0.7, dmgMul: 1.35, impact: 34, lunge: 3.4, tell: P.crimsonLit }),
          A({ id: 'waltz', clip: 'attack1', windup: 0.26, active: 0.55, recover: 0.9, range: 3.0, arc: 2.6, dmgMul: 1.5, impact: 54, lunge: 2.0, tell: P.bloodMoon }),
          A({ id: 'bloom', clip: 'cast', windup: 0.9, active: 0.3, recover: 0.9, range: 7, radius: 5.6, dmgMul: 1.7, impact: 70, kind: 'aoe', tell: P.bloodMoon, unblockable: true, weight: 0.5 }),
          A({ id: 'step', clip: 'roll', windup: 0.12, active: 0.22, recover: 0.2, range: 9, dmgMul: 0, impact: 0, kind: 'dash', lunge: 6.4, weight: 1.0 }),
        ],
      },
      {
        at: 0.25, haste: 1.5,
        line: 'The dress comes apart. There was never a bride inside it.',
        burst: { radius: 8, dmgMul: 1.6 },
        summon: { id: 'ghoul', count: 3 },
        attacks: [
          A({ id: 'rend', clip: 'attack1', windup: 0.22, active: 0.2, recover: 0.34, range: 3.2, arc: 2.0, dmgMul: 1.2, impact: 36, lunge: 2.2 }),
          A({ id: 'rend2', clip: 'attack2', windup: 0.14, active: 0.18, recover: 0.34, range: 3.6, arc: 0.8, dmgMul: 1.2, impact: 36, lunge: 3.2 }),
          A({ id: 'crescendo', clip: 'heavy', windup: 0.7, active: 0.4, recover: 1.0, range: 4.0, radius: 6.5, dmgMul: 2.0, impact: 90, kind: 'aoe', tell: P.bloodMoon, unblockable: true, weight: 0.6 }),
          A({ id: 'step', clip: 'roll', windup: 0.1, active: 0.2, recover: 0.16, range: 10, dmgMul: 0, impact: 0, kind: 'dash', lunge: 7.4, weight: 1.2 }),
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- optional
  emberwright: {
    id: 'emberwright', name: 'The Emberwright', title: 'Smith of the Last Fire',
    look: 'boss_smith', hp: 2900, dmg: 52, armor: 0.3, poise: 200,
    speed: 1.2, runSpeed: 2.6, aggro: 99, leash: 999, tier: 3, runes: 4200,
    behavior: 'sentry', cadence: 1.5, arena: 10,
    remembrance: 'ember_greataxe',
    intro: 'It does not look up from the anvil until you step onto the floor plate.',
    epitaph: 'The hammer stops. The forge, after nine centuries, finally goes cold.',
    drops: [['rune_shard', 1, 50, 80], ['emberglass', 1, 6, 10], ['hollow_marrow', 1, 2, 3]],
    phases: [
      {
        at: 1, haste: 1,
        attacks: [
          A({ id: 'chop', clip: 'heavy', windup: 0.86, active: 0.22, recover: 0.9, range: 2.4, arc: 1.4, dmgMul: 1.2, impact: 70, lunge: 1.2 }),
          A({ id: 'sweep', windup: 0.66, active: 0.24, recover: 0.7, range: 2.8, arc: 2.2, dmgMul: 1, impact: 52, lunge: 0.8 }),
          A({ id: 'quench', clip: 'cast', windup: 1.0, active: 0.3, recover: 1.0, range: 3.4, radius: 4.4, dmgMul: 1.6, impact: 80, kind: 'aoe', tell: P.flame, unblockable: true, weight: 0.5 }),
        ],
      },
      {
        at: 0.5, haste: 1.25,
        line: 'The Emberwright plunges the axe into the coals and leaves it there.',
        burst: { radius: 6, dmgMul: 1.4 },
        attacks: [
          A({ id: 'chop', clip: 'heavy', windup: 0.7, active: 0.22, recover: 0.76, range: 2.6, arc: 1.5, dmgMul: 1.4, impact: 80, lunge: 1.6, tell: P.flame }),
          A({ id: 'sweep', windup: 0.54, active: 0.26, recover: 0.6, range: 3.0, arc: 2.4, dmgMul: 1.2, impact: 60, lunge: 1.2 }),
          A({ id: 'forge', clip: 'cast', windup: 1.1, active: 0.4, recover: 1.1, range: 5, radius: 6.0, dmgMul: 1.9, impact: 110, kind: 'aoe', tell: P.ember, unblockable: true, weight: 0.6 }),
          A({ id: 'hurl', clip: 'cast', windup: 0.74, active: 0.14, recover: 0.7, range: 10, arc: 0.3, dmgMul: 1.3, impact: 30, kind: 'ranged', speed: 10, tell: P.flame, weight: 0.5 }),
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- final
  first: {
    id: 'first', name: 'The First Hollow', title: 'He Who Put Out The Lamps',
    look: 'boss_hollow', hp: 5200, dmg: 60, armor: 0.24, poise: 180,
    speed: 1.8, runSpeed: 4.2, aggro: 99, leash: 999, tier: 5, runes: 12000,
    behavior: 'melee', hollow: 0.6, cadence: 1.1, arena: 14,
    remembrance: 'rem_first',
    intro: 'He was a king, and then he was cold, and the difference took him a long time to notice.',
    epitaph: 'The crown falls. Somewhere behind you, a lamp that was out comes back.',
    drops: [['rune_shard', 1, 150, 220], ['hollow_marrow', 1, 6, 9]],
    phases: [
      {
        at: 1, haste: 1,
        attacks: [
          A({ id: 'cleave', clip: 'attack1', windup: 0.68, active: 0.22, recover: 0.66, range: 3.4, arc: 1.8, dmgMul: 1, impact: 60, lunge: 1.6 }),
          A({ id: 'cleave2', clip: 'attack2', windup: 0.26, active: 0.2, recover: 0.8, range: 3.6, arc: 1.0, dmgMul: 1.1, impact: 60, lunge: 2.4 }),
          A({ id: 'slam', clip: 'heavy', windup: 0.9, active: 0.26, recover: 0.95, range: 3.0, radius: 4.8, dmgMul: 1.7, impact: 100, kind: 'aoe', tell: P.hollow, unblockable: true, weight: 0.5 }),
          A({ id: 'charge', clip: 'run', windup: 0.62, active: 0.5, recover: 0.8, range: 9, dmgMul: 1.3, impact: 70, lunge: 8.0, kind: 'dash', tell: P.hollow, minRange: 4, weight: 0.4 }),
        ],
      },
      {
        at: 0.62, haste: 1.2,
        line: 'The First Hollow lifts the greatsword in one hand. The light in the horns goes out.',
        burst: { radius: 8, dmgMul: 1.4 },
        summon: { id: 'wraith', count: 3 },
        attacks: [
          A({ id: 'cleave', clip: 'attack1', windup: 0.54, active: 0.22, recover: 0.5, range: 3.6, arc: 2.0, dmgMul: 1.1, impact: 66, lunge: 2.0 }),
          A({ id: 'cleave2', clip: 'attack2', windup: 0.22, active: 0.2, recover: 0.46, range: 3.8, arc: 1.1, dmgMul: 1.1, impact: 66, lunge: 2.8 }),
          A({ id: 'cleave3', clip: 'heavy', windup: 0.3, active: 0.26, recover: 0.95, range: 3.8, arc: 2.4, dmgMul: 1.5, impact: 90, lunge: 2.4, tell: P.hollow }),
          A({ id: 'rings', clip: 'cast', windup: 1.0, active: 0.5, recover: 1.0, range: 8, radius: 7.0, dmgMul: 1.6, impact: 110, kind: 'aoe', tell: P.hollowDim, unblockable: true, weight: 0.6 }),
          A({ id: 'charge', clip: 'run', windup: 0.5, active: 0.52, recover: 0.66, range: 11, dmgMul: 1.4, impact: 80, lunge: 9.5, kind: 'dash', tell: P.hollow, minRange: 4, weight: 0.5 }),
        ],
      },
      {
        at: 0.3, haste: 1.42,
        line: 'He speaks for the first time since the flood. It is not a language any more.',
        burst: { radius: 10, dmgMul: 1.8 },
        attacks: [
          A({ id: 'rend', clip: 'attack1', windup: 0.34, active: 0.22, recover: 0.34, range: 3.8, arc: 2.2, dmgMul: 1.25, impact: 74, lunge: 2.6 }),
          A({ id: 'rend2', clip: 'attack2', windup: 0.2, active: 0.2, recover: 0.34, range: 4.0, arc: 1.2, dmgMul: 1.25, impact: 74, lunge: 3.2 }),
          A({ id: 'rend3', clip: 'heavy', windup: 0.34, active: 0.3, recover: 1.0, range: 4.2, arc: 2.8, dmgMul: 1.8, impact: 120, lunge: 3.0, tell: P.hollow }),
          A({ id: 'nightfall', clip: 'cast', windup: 1.25, active: 0.6, recover: 1.1, range: 10, radius: 9.0, dmgMul: 2.1, impact: 150, kind: 'aoe', tell: P.hollow, unblockable: true, weight: 0.7 }),
          A({ id: 'charge', clip: 'run', windup: 0.42, active: 0.54, recover: 0.56, range: 12, dmgMul: 1.5, impact: 90, lunge: 11, kind: 'dash', tell: P.hollow, minRange: 4, weight: 0.6 }),
        ],
      },
    ],
  },
};

export const phaseFor = (b: BossDef, hpFrac: number) => {
  let p = b.phases[0], i = 0;
  for (let k = 0; k < b.phases.length; k++) if (hpFrac <= b.phases[k].at) { p = b.phases[k]; i = k; }
  return { phase: p, index: i };
};
