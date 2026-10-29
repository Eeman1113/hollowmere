// Animation clips. Each clip is a list of poses sampled across the cycle; the
// walk and run cycles are built from real gait phase relationships so the feet
// plant and push off instead of sliding.

import { pose, type PoseIn } from './rig';

export type ClipName =
  | 'idle' | 'walk' | 'run' | 'attack1' | 'attack2' | 'heavy' | 'roll'
  | 'block' | 'blockwalk' | 'hurt' | 'death' | 'cast' | 'rest' | 'rise';

export interface Clip { name: ClipName; frames: PoseIn[]; fps: number; loop: boolean }

const TAU = Math.PI * 2;

/** Shared gait builder. Amplitude scales the whole stride. */
function gait(n: number, amp: number, opts: { lean: number; armAmp: number; bob: number; knee: number; twist: number }): PoseIn[] {
  const out: PoseIn[] = [];
  for (let i = 0; i < n; i++) {
    const ph = (i / n) * TAU;
    // Hip swing is a clean sine; the knee bends on the recovery (back) half so
    // the trailing foot lifts clear of the ground.
    const hipL = Math.sin(ph) * amp;
    const hipR = Math.sin(ph + Math.PI) * amp;
    const kneeOf = (p: number) => {
      const recover = Math.max(0, -Math.cos(p - 0.5));
      const absorb = Math.max(0, Math.sin(p + 0.3)) * 0.25;
      return 0.1 + recover * opts.knee + absorb;
    };
    // Pelvis dips twice per cycle, at each mid-stance.
    const bob = -Math.abs(Math.cos(ph)) * opts.bob;
    out.push(pose({
      hipL, hipR,
      knL: kneeOf(ph), knR: kneeOf(ph + Math.PI),
      shL: -hipL * opts.armAmp + 0.06, shR: -hipR * opts.armAmp + 0.06,
      elL: 0.42 + Math.max(0, -hipL) * 0.5, elR: 0.42 + Math.max(0, -hipR) * 0.5,
      rollL: 0.15, rollR: 0.15,
      bob, sway: Math.sin(ph * 2) * 0.35,
      lean: opts.lean, twist: Math.sin(ph) * opts.twist,
      headPitch: -opts.lean * 0.6, headYaw: -Math.sin(ph) * opts.twist * 0.5,
      gripPitch: -1.2,
      splay: 0.9,
    }));
  }
  return out;
}

function idle(n: number): PoseIn[] {
  const out: PoseIn[] = [];
  for (let i = 0; i < n; i++) {
    const ph = (i / n) * TAU;
    const br = Math.sin(ph);
    out.push(pose({
      hipL: 0.03, hipR: -0.03, knL: 0.1, knR: 0.08,
      shL: 0.1 + br * 0.03, shR: 0.1 - br * 0.03,
      rollL: 0.2 + br * 0.03, rollR: 0.2 + br * 0.03,
      elL: 0.34, elR: 0.36,
      bob: br * 0.26, sway: Math.sin(ph * 0.5) * 0.2,
      lean: 0.05 + br * 0.02, twist: Math.sin(ph * 0.5) * 0.05,
      headPitch: 0.02 + br * 0.03, headYaw: Math.sin(ph * 0.5) * 0.12,
      gripPitch: -1.0,
    }));
  }
  return out;
}

/** Horizontal slash: wind up across the body, whip through, recover. */
function slash(mirror: boolean): PoseIn[] {
  const s = mirror ? -1 : 1;
  return [
    pose({ twist: -0.5 * s, lean: -0.06, shR: -0.5, elR: 1.5, rollR: 0.5 * s, gripPitch: -1.9, hipL: -0.18, hipR: 0.2, knL: 0.25, knR: 0.2, bob: -0.3, headYaw: -0.3 * s }),
    pose({ twist: -0.7 * s, lean: -0.1, shR: -0.75, elR: 1.9, rollR: 0.75 * s, gripPitch: -2.3, hipL: -0.3, hipR: 0.34, knL: 0.3, knR: 0.22, bob: -0.6, headYaw: -0.45 * s }),
    pose({ twist: 0.25 * s, lean: 0.2, shR: 0.55, elR: 0.35, rollR: 1.15 * s, gripPitch: -0.7, hipL: 0.4, hipR: -0.3, knL: 0.2, knR: 0.34, bob: -0.5, sway: 0.5 * s, headYaw: 0.2 * s }),
    pose({ twist: 0.62 * s, lean: 0.3, shR: 0.95, elR: 0.14, rollR: 1.0 * s, gripPitch: -0.2, hipL: 0.52, hipR: -0.36, knL: 0.16, knR: 0.46, bob: -0.9, sway: 0.9 * s, headYaw: 0.34 * s }),
    pose({ twist: 0.5 * s, lean: 0.26, shR: 0.8, elR: 0.4, rollR: 0.7 * s, gripPitch: -0.5, hipL: 0.4, hipR: -0.26, knL: 0.18, knR: 0.4, bob: -0.7, sway: 0.6 * s }),
    pose({ twist: 0.22 * s, lean: 0.12, shR: 0.4, elR: 0.7, rollR: 0.4 * s, gripPitch: -0.85, hipL: 0.2, hipR: -0.1, knL: 0.14, knR: 0.26, bob: -0.35, sway: 0.25 * s }),
    pose({ twist: 0.05 * s, lean: 0.05, shR: 0.16, elR: 0.34, rollR: 0.22, gripPitch: -1.0, knL: 0.1, knR: 0.12, bob: -0.1 }),
  ];
}

/** Overhead two-hand smash — the heavy attack. */
function smash(): PoseIn[] {
  return [
    pose({ lean: -0.3, shR: -1.5, shL: -1.35, elR: 0.75, elL: 0.85, rollR: 0.26, rollL: 0.26, gripPitch: -1.0, hipL: -0.1, hipR: 0.12, knL: 0.3, knR: 0.3, bob: -0.5, headPitch: -0.3 }),
    pose({ lean: -0.52, shR: -2.3, shL: -2.1, elR: 0.5, elL: 0.6, rollR: 0.2, rollL: 0.2, gripPitch: -0.75, hipL: -0.2, hipR: 0.22, knL: 0.42, knR: 0.42, bob: -1.1, headPitch: -0.5 }),
    pose({ lean: -0.58, shR: -2.55, shL: -2.35, elR: 0.42, elL: 0.5, rollR: 0.18, rollL: 0.18, gripPitch: -0.6, hipL: -0.24, hipR: 0.26, knL: 0.46, knR: 0.46, bob: -1.3, headPitch: -0.55 }),
    pose({ lean: 0.34, shR: -0.2, shL: -0.1, elR: 0.2, elL: 0.26, rollR: 0.14, rollL: 0.14, gripPitch: -1.5, hipL: 0.3, hipR: -0.22, knL: 0.34, knR: 0.5, bob: -1.0, headPitch: 0.3 }),
    pose({ lean: 0.72, shR: 0.95, shL: 0.85, elR: 0.1, elL: 0.16, rollR: 0.12, rollL: 0.12, gripPitch: -2.1, hipL: 0.46, hipR: -0.32, knL: 0.3, knR: 0.72, bob: -1.8, headPitch: 0.6 }),
    pose({ lean: 0.66, shR: 0.88, shL: 0.8, elR: 0.2, elL: 0.24, rollR: 0.14, rollL: 0.14, gripPitch: -2.0, hipL: 0.4, hipR: -0.28, knL: 0.3, knR: 0.66, bob: -1.7, headPitch: 0.55 }),
    pose({ lean: 0.4, shR: 0.6, shL: 0.55, elR: 0.34, elL: 0.38, rollR: 0.18, rollL: 0.18, gripPitch: -1.6, hipL: 0.26, hipR: -0.18, knL: 0.24, knR: 0.46, bob: -1.1, headPitch: 0.35 }),
    pose({ lean: 0.12, shR: 0.2, shL: 0.2, elR: 0.34, elL: 0.34, rollR: 0.2, rollL: 0.2, gripPitch: -1.1, knL: 0.14, knR: 0.2, bob: -0.4, headPitch: 0.1 }),
  ];
}

/** Forward thrust — the second hit of the light chain. */
function thrust(): PoseIn[] {
  return [
    pose({ twist: -0.35, lean: -0.1, shR: -0.4, elR: 1.9, rollR: 0.3, gripPitch: -1.55, hipL: -0.2, hipR: 0.2, knL: 0.3, knR: 0.24, bob: -0.5 }),
    pose({ twist: -0.5, lean: -0.16, shR: -0.55, elR: 2.2, rollR: 0.26, gripPitch: -1.5, hipL: -0.34, hipR: 0.32, knL: 0.38, knR: 0.26, bob: -0.8 }),
    pose({ twist: 0.2, lean: 0.34, shR: 0.3, elR: 0.3, rollR: 0.16, gripPitch: -1.6, hipL: 0.6, hipR: -0.4, knL: 0.2, knR: 0.5, bob: -1.0, sway: 0.4 }),
    pose({ twist: 0.3, lean: 0.46, shR: 0.52, elR: 0.06, rollR: 0.1, gripPitch: -1.62, hipL: 0.78, hipR: -0.52, knL: 0.14, knR: 0.62, bob: -1.3, sway: 0.7 }),
    pose({ twist: 0.22, lean: 0.36, shR: 0.4, elR: 0.2, rollR: 0.12, gripPitch: -1.6, hipL: 0.6, hipR: -0.4, knL: 0.16, knR: 0.5, bob: -1.0, sway: 0.5 }),
    pose({ twist: 0.08, lean: 0.16, shR: 0.2, elR: 0.34, rollR: 0.18, gripPitch: -1.3, hipL: 0.26, hipR: -0.16, knL: 0.12, knR: 0.26, bob: -0.4, sway: 0.2 }),
    pose({ lean: 0.05, shR: 0.12, elR: 0.32, rollR: 0.2, gripPitch: -1.05, knL: 0.1, knR: 0.12 }),
  ];
}

/** Dodge roll: tuck, spin a full turn, rise. */
function roll(): PoseIn[] {
  const out: PoseIn[] = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const tuck = Math.sin(Math.min(1, t * 1.25) * Math.PI);
    out.push(pose({
      hipL: 2.0 * tuck + 0.1, hipR: 2.15 * tuck + 0.05,
      knL: 2.5 * tuck + 0.1, knR: 2.6 * tuck + 0.1,
      shL: 1.9 * tuck, shR: 1.85 * tuck,
      elL: 2.3 * tuck + 0.3, elR: 2.35 * tuck + 0.3,
      rollL: 0.45 * tuck + 0.16, rollR: 0.45 * tuck + 0.16,
      lean: 0.85 * tuck + 0.05,
      bob: -7.6 * tuck,
      spin: t * Math.PI * 2 * 0.95,
      headPitch: 0.95 * tuck,
      gripPitch: -0.2 - tuck * 1.1,
      lift: Math.sin(t * Math.PI) * 0.8,
    }));
  }
  return out;
}

function guard(walking: boolean, n: number): PoseIn[] {
  const out: PoseIn[] = [];
  for (let i = 0; i < n; i++) {
    const ph = (i / n) * TAU;
    const hipL = walking ? Math.sin(ph) * 0.3 : 0.05;
    const hipR = walking ? Math.sin(ph + Math.PI) * 0.3 : -0.05;
    out.push(pose({
      hipL, hipR,
      knL: walking ? 0.12 + Math.max(0, -Math.cos(ph - 0.5)) * 0.5 : 0.22,
      knR: walking ? 0.12 + Math.max(0, -Math.cos(ph + Math.PI - 0.5)) * 0.5 : 0.24,
      shL: 1.05, elL: 1.5, rollL: 0.62, shieldYaw: 0.1,
      shR: 0.2, elR: 1.0, rollR: 0.34, gripPitch: -1.5,
      lean: 0.16, twist: -0.3, tilt: 0,
      bob: walking ? -Math.abs(Math.cos(ph)) * 0.5 : Math.sin(ph) * 0.14,
      headYaw: 0.2,
    }));
  }
  return out;
}

function hurt(): PoseIn[] {
  return [
    pose({ lean: -0.5, twist: 0.3, shL: -0.8, shR: -0.7, elL: 1.1, elR: 1.0, rollL: 0.7, rollR: 0.7, hipL: -0.35, hipR: -0.2, knL: 0.4, knR: 0.5, bob: -0.6, headPitch: -0.5 }),
    pose({ lean: -0.34, twist: 0.2, shL: -0.5, shR: -0.45, elL: 0.9, elR: 0.85, rollL: 0.55, rollR: 0.55, hipL: -0.2, hipR: -0.1, knL: 0.3, knR: 0.38, bob: -0.4, headPitch: -0.34 }),
    pose({ lean: -0.12, twist: 0.08, shL: -0.1, shR: -0.1, elL: 0.5, elR: 0.5, rollL: 0.3, rollR: 0.3, knL: 0.16, knR: 0.2, bob: -0.15 }),
  ];
}

function death(): PoseIn[] {
  const out: PoseIn[] = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const t = Math.pow(i / (n - 1), 0.75);
    out.push(pose({
      lean: -0.25 + t * 0.35,
      tilt: t * 0.95,
      twist: t * 0.4,
      bob: -t * 9.4,
      hipL: 0.5 * t + 0.1, hipR: 0.2 * t,
      knL: 1.1 * t + 0.1, knR: 0.7 * t + 0.1,
      shL: -0.4 + t * 1.6, shR: -0.3 + t * 0.9,
      elL: 0.6 + t * 0.5, elR: 0.5 + t * 0.4,
      rollL: 0.4 + t * 0.8, rollR: 0.4 + t * 0.7,
      headPitch: -0.4 + t * 0.9,
      gripPitch: -0.4 - t * 0.9,
    }));
  }
  return out;
}

function cast(): PoseIn[] {
  const out: PoseIn[] = [];
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const e = Math.sin(t * Math.PI * 0.5);
    out.push(pose({
      shL: -1.5 * e - 0.1, shR: -1.65 * e - 0.1,
      elL: 0.9 - e * 0.5, elR: 0.85 - e * 0.45,
      rollL: 0.4 + e * 0.5, rollR: 0.4 + e * 0.5,
      lean: -0.2 * e, bob: -0.2 + e * 0.5,
      headPitch: -0.4 * e, gripPitch: -0.3 - e * 0.9,
      knL: 0.16, knR: 0.16,
    }));
  }
  return out;
}

/** Kneeling at a lantern. */
function rest(): PoseIn[] {
  const out: PoseIn[] = [];
  for (let i = 0; i < 4; i++) {
    const br = Math.sin((i / 4) * TAU) * 0.12;
    out.push(pose({
      hipL: 1.5, knL: 1.9, hipR: 0.3, knR: 2.3,
      shL: 0.5, shR: 0.45, elL: 1.3, elR: 1.25, rollL: 0.26, rollR: 0.26,
      lean: 0.45 + br, bob: -4.4, headPitch: 0.5, gripPitch: -0.6,
    }));
  }
  return out;
}

export function buildClips(): Record<ClipName, Clip> {
  const mk = (name: ClipName, frames: PoseIn[], fps: number, loop: boolean): Clip => ({ name, frames, fps, loop });
  return {
    idle: mk('idle', idle(6), 7, true),
    walk: mk('walk', gait(8, 0.5, { lean: 0.1, armAmp: 0.62, bob: 0.95, knee: 0.95, twist: 0.13 }), 11, true),
    run: mk('run', gait(8, 0.82, { lean: 0.3, armAmp: 0.78, bob: 1.7, knee: 1.45, twist: 0.22 }), 15, true),
    attack1: mk('attack1', slash(false), 17, false),
    attack2: mk('attack2', thrust(), 17, false),
    heavy: mk('heavy', smash(), 14, false),
    roll: mk('roll', roll(), 19, false),
    block: mk('block', guard(false, 4), 6, true),
    blockwalk: mk('blockwalk', guard(true, 6), 9, true),
    hurt: mk('hurt', hurt(), 14, false),
    death: mk('death', death(), 11, false),
    cast: mk('cast', cast(), 12, false),
    rest: mk('rest', rest(), 4, true),
    rise: mk('rise', death().slice().reverse(), 12, false),
  };
}

export const CLIPS = buildClips();

/** Clips a baked humanoid needs. Enemies use a subset to keep atlases small. */
export const PLAYER_CLIPS: ClipName[] = ['idle', 'walk', 'run', 'attack1', 'attack2', 'heavy', 'roll', 'block', 'blockwalk', 'hurt', 'death', 'cast', 'rest'];
export const ENEMY_CLIPS: ClipName[] = ['idle', 'walk', 'run', 'attack1', 'heavy', 'hurt', 'death'];
export const NPC_CLIPS: ClipName[] = ['idle', 'walk', 'hurt', 'death'];
