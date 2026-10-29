// Character rig. Poses are authored ONCE in character-local 3D space, then
// rotated to the facing yaw and projected into the isometric view. That is why
// the legs actually swing in every direction instead of sliding: the foot
// positions come from forward kinematics, not from hand-drawn frames.

export type V3 = { x: number; y: number; z: number };
export const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z });
export const add = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a: V3, k: number): V3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const lerp3 = (a: V3, b: V3, t: number): V3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
export function norm(a: V3): V3 {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
}

/** Limb direction from pitch (swing fore/aft) and roll (splay sideways). Rest = straight down. */
export function limbDir(pitch: number, roll: number): V3 {
  const cr = Math.cos(roll), sr = Math.sin(roll);
  return { x: sr, y: Math.sin(pitch) * cr, z: -Math.cos(pitch) * cr };
}

export function rotY(p: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
}
/** Rotate about the pelvis-local X axis — torso lean. */
export function rotX(p: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}
/** Rotate about the forward axis — torso tilt / roll frames. */
export function rotZ(p: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x * c - p.z * s, y: p.y, z: p.x * s + p.z * c };
}

export type JointName =
  | 'pelvis' | 'chest' | 'neck' | 'head'
  | 'shL' | 'shR' | 'elL' | 'elR' | 'hdL' | 'hdR'
  | 'hipL' | 'hipR' | 'knL' | 'knR' | 'ftL' | 'ftR';

export type Skel = Record<JointName, V3> & {
  /** Unit vector the right hand's grip points along (blade direction). */
  gripR: V3;
  /** Unit vector the left hand's shield faces. */
  gripL: V3;
  /** Extra whole-body roll for dodge frames, applied after projection. */
  spin: number;
};

export interface Build {
  /** Overall scale. 1 = ~45px tall human. */
  h: number;
  /** Shoulder half-width. */
  shoulder: number;
  /** Limb thickness multiplier. */
  thick: number;
  /** Head radius. */
  head: number;
  legLen: number;
  armLen: number;
  /** Pelvis-to-neck length. */
  spine: number;
  /** Hip half-width. */
  hipHalf: number;
}

export const HUMAN: Build = { h: 1, shoulder: 5.6, thick: 1, head: 5.0, legLen: 16.4, armLen: 15.6, spine: 18.6, hipHalf: 3.1 };
/** Taller, broader — knights and bosses. */
export const HEROIC: Build = { ...HUMAN, h: 1.14, shoulder: 6.6, thick: 1.22, head: 4.8, spine: 20 };
/** Short and wide — ghouls, hollows. */
export const STUNTED: Build = { ...HUMAN, h: 0.86, shoulder: 5.4, thick: 1.1, head: 5.0, legLen: 13, spine: 16 };
/** Long-limbed and gaunt — Bloodborne-flavoured horrors. */
export const GAUNT: Build = { ...HUMAN, h: 1.06, shoulder: 5.0, thick: 0.78, head: 4.2, legLen: 21, armLen: 21, spine: 20 };

export interface PoseIn {
  /** Hip swing per leg, radians. Positive = forward (toward camera). */
  hipL: number; hipR: number;
  /** Knee bend, radians, always positive (heel toward butt). */
  knL: number; knR: number;
  /** Shoulder swing per arm. */
  shL: number; shR: number;
  /** Shoulder splay outward. */
  rollL: number; rollR: number;
  /** Elbow bend. */
  elL: number; elR: number;
  /** Pelvis vertical offset and sway. */
  bob: number; sway: number;
  /** Torso lean forward (+) and twist about vertical. */
  lean: number; twist: number; tilt: number;
  /** Head pitch/yaw relative to chest. */
  headPitch: number; headYaw: number;
  /** Grip pitch of the weapon relative to the forearm. */
  gripPitch: number; gripYaw: number;
  /** Shield plane angle. */
  shieldYaw: number;
  /** Whole-body roll used by the dodge animation. */
  spin: number;
  /** Feet planted height offset (for jumps / falls). */
  lift: number;
  /** Lateral foot splay proportional to stride. Sells the gait from the front and back. */
  splay: number;
}

export const REST: PoseIn = {
  hipL: 0, hipR: 0, knL: 0.05, knR: 0.05,
  shL: 0.08, shR: 0.08, rollL: 0.16, rollR: 0.16, elL: 0.3, elR: 0.3,
  bob: 0, sway: 0, lean: 0.03, twist: 0, tilt: 0,
  headPitch: 0, headYaw: 0, gripPitch: -1.1, gripYaw: 0, shieldYaw: 0, spin: 0, lift: 0, splay: 0,
};

export const pose = (o: Partial<PoseIn>): PoseIn => ({ ...REST, ...o });

/** Forward kinematics: turn joint angles into 3D joint positions. */
export function solve(p: PoseIn, b: Build): Skel {
  const H = b.h;
  const thigh = b.legLen * 0.52 * H, shin = b.legLen * 0.48 * H;
  const upper = b.armLen * 0.5 * H, fore = b.armLen * 0.5 * H;
  const hipZ = (thigh + shin) * 0.98 + p.bob * H + p.lift * H;
  const hipHalf = b.hipHalf * H;

  const pelvis = v3(p.sway * H, 0, hipZ);
  const hipL = add(pelvis, v3(-hipHalf, 0, 0));
  const hipR = add(pelvis, v3(hipHalf, 0, 0));

  const legs = (hip: V3, hipPitch: number, knee: number, side: number) => {
    const sp = Math.sin(hipPitch) * p.splay * H * side;
    const d1 = limbDir(hipPitch, 0);
    const kn = add(add(hip, scale(d1, thigh)), v3(sp * 0.45, 0, 0));
    const d2 = limbDir(hipPitch - knee, 0);
    return { kn, ft: add(add(kn, scale(d2, shin)), v3(sp * 0.55, 0, 0)) };
  };
  const L = legs(hipL, p.hipL, p.knL, -1);
  const R = legs(hipR, p.hipR, p.knR, 1);

  // Upper body: build in pelvis space, then lean / twist / tilt about the pelvis.
  const spine = b.spine * H;
  const up = (v: V3) => {
    let q = rotX(v, p.lean);
    q = rotZ(q, p.tilt);
    q = rotY(q, p.twist);
    return add(pelvis, q);
  };
  const chest = up(v3(0, 0, spine * 0.78));
  const neck = up(v3(0, 0, spine * 1.02));
  const shL = up(v3(-b.shoulder * H, 0, spine * 0.95));
  const shR = up(v3(b.shoulder * H, 0, spine * 0.95));

  // Head gets its own yaw/pitch on top of the torso.
  const headLocal = rotY(rotX(v3(0, 0, spine * 1.02 + b.head * 0.92 * H), p.headPitch), p.headYaw);
  const head = up(headLocal);

  const arms = (sh: V3, shPitch: number, roll: number, elbow: number, side: number) => {
    const d1 = limbDir(shPitch, roll * side);
    let el = scale(d1, upper);
    const d2 = limbDir(shPitch + elbow, roll * side * 0.4);
    let hd = add(el, scale(d2, fore));
    // arms ride the torso transform too
    el = rotY(rotZ(rotX(el, p.lean), p.tilt), p.twist);
    hd = rotY(rotZ(rotX(hd, p.lean), p.tilt), p.twist);
    return { el: add(sh, el), hd: add(sh, hd), fwd: d2 };
  };
  const AL = arms(shL, p.shL, p.rollL, p.elL, -1);
  const AR = arms(shR, p.shR, p.rollR, p.elR, 1);

  // Grip: forearm direction swung by the grip angles, carried through the torso rotation.
  const gripRaw = limbDir(p.shR + p.elR + p.gripPitch, p.gripYaw);
  const gripR = norm(rotY(rotZ(rotX(gripRaw, p.lean), p.tilt), p.twist));
  const shieldRaw = limbDir(p.shL + p.elL + 1.3, p.shieldYaw);
  const gripL = norm(rotY(rotZ(rotX(shieldRaw, p.lean), p.tilt), p.twist));

  return {
    pelvis, chest, neck, head,
    shL, shR, elL: AL.el, elR: AR.el, hdL: AL.hd, hdR: AR.hd,
    hipL, hipR, knL: L.kn, knR: R.kn, ftL: L.ft, ftR: R.ft,
    gripR, gripL, spin: p.spin,
  };
}

/** Rotate a solved skeleton to a facing yaw. */
export function face(s: Skel, yaw: number): Skel {
  const out = {} as Skel;
  for (const k of Object.keys(s) as (keyof Skel)[]) {
    if (k === 'spin') { out.spin = s.spin; continue; }
    out[k] = rotY(s[k] as V3, yaw) as never;
  }
  return out;
}

/** 2.5D projection matching the game's 2:1 isometric camera. */
export const DEPTH_K = 0.58;
export interface P2 { x: number; y: number; d: number }
export function project(p: V3, originX: number, baseY: number, spin = 0): P2 {
  let x = p.x, y = -p.z + p.y * DEPTH_K;
  if (spin) {
    const c = Math.cos(spin), s = Math.sin(spin);
    const cy = -11;
    const dx = x, dy = y - cy;
    x = dx * c - dy * s;
    y = cy + dx * s + dy * c;
  }
  return { x: originX + x, y: baseY + y, d: p.y };
}

/**
 * Facing yaw for a movement vector expressed in world tile space.
 * Derived so the character's local +Y maps exactly onto the on-screen
 * direction of travel — this is what eliminates the moonwalk.
 */
export function yawFor(dx: number, dy: number) {
  return Math.atan2(dy - dx, dx + dy);
}
export const DIRS = 8;
export const dirIndex = (yaw: number) => ((Math.round(yaw / (Math.PI / 4)) % DIRS) + DIRS) % DIRS;
export const dirYaw = (i: number) => (i * Math.PI) / 4;
/** Direction index straight from a world-space movement vector. */
export const dirFor = (dx: number, dy: number) => dirIndex(yawFor(dx, dy));
