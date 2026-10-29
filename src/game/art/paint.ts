// Paints a solved, facing-rotated skeleton into a pixel buffer. Everything is
// collected as depth-keyed draw commands first so limbs, cape, weapon and
// shield overlap correctly in every one of the eight facings.

import { Px, type Col, shade, mix, type Pt } from './raster';
import { project, type Skel, type V3, add, scale, norm, type P2 } from './rig';
import type { ArmorVis, Look, ShieldVis, WeaponVis } from './look';

interface Cmd { d: number; run: () => void }

const perp = (ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax, dy = by - ay;
  const l = Math.hypot(dx, dy) || 1;
  return { x: -dy / l, y: dx / l };
};

/** Cylindrical limb: core, lit band, rim highlight. */
function limb(px: Px, a: P2, b: P2, r0: number, r1: number, c: Col, lit = 1, rim?: Col) {
  if (rim) px.capsule(a.x, a.y, b.x, b.y, r0 + 0.9, r1 + 0.9, rim);
  px.capsule(a.x, a.y, b.x, b.y, r0, r1, shade(c, 0.74));
  px.capsule(a.x - 0.5, a.y - 0.6, b.x - 0.5, b.y - 0.6, r0 * 0.78, r1 * 0.78, c);
  if (r0 > 1.3) px.capsule(a.x - 0.9, a.y - 1.1, b.x - 0.9, b.y - 1.1, r0 * 0.4, r1 * 0.4, shade(c, 1.0 + 0.2 * lit));
}

function blob(px: Px, p: P2, rx: number, ry: number, c: Col) {
  px.ellipse(p.x, p.y, rx, ry, shade(c, 0.76));
  px.ellipse(p.x - 0.5, p.y - 0.6, rx * 0.82, ry * 0.82, c);
  px.ellipse(p.x - 0.9, p.y - 1.1, rx * 0.44, ry * 0.44, shade(c, 1.16));
}

/** Mail rings / plate ridges / leather stitching over whatever was just drawn. */
function fabric(px: Px, kind: ArmorVis['kind'], x0: number, y0: number, w: number, h: number, c: Col, seed: number) {
  const dark = shade(c, 0.62), light = shade(c, 1.22);
  if (kind === 'mail') {
    for (let y = y0; y < y0 + h; y += 2) for (let x = x0 + (((y / 2) | 0) % 2); x < x0 + w; x += 2) px.over(x, y, dark);
  } else if (kind === 'plate' || kind === 'bronze') {
    for (let y = y0 + 2; y < y0 + h; y += 4) for (let x = x0; x < x0 + w; x++) px.over(x, y, dark);
    for (let y = y0 + 3; y < y0 + h; y += 4) for (let x = x0; x < x0 + w; x++) px.over(x, y, light);
  } else if (kind === 'leather') {
    let s = seed >>> 0;
    for (let y = y0; y < y0 + h; y += 3) for (let x = x0; x < x0 + w; x += 3) {
      s = (s * 1103515245 + 12345) >>> 0;
      if ((s >>> 20) & 1) px.over(x, y, dark);
    }
  } else if (kind === 'bone') {
    for (let y = y0; y < y0 + h; y += 3) { px.over(x0 + 1, y, dark); px.over(x0 + w - 2, y, dark); }
  } else if (kind === 'rag') {
    let s = seed >>> 0;
    for (let i = 0; i < w * h * 0.12; i++) {
      s = (s * 22695477 + 1) >>> 0;
      px.over(x0 + ((s >>> 8) % w), y0 + ((s >>> 18) % h), dark);
    }
  }
}

// ---------------------------------------------------------------- weapons

/** Blade built from cross-sections along an arc — handles straight, curved and scythe. */
function bladeArc(px: Px, from: P2, dirX: number, dirY: number, len: number, curve: number, w0: number, w1: number, c: Col, edge: Col, steps = 7) {
  const pts: { l: Pt; r: Pt }[] = [];
  let x = from.x, y = from.y;
  let ang = Math.atan2(dirY, dirX);
  const step = len / steps;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const w = (w0 + (w1 - w0) * t) / 2;
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    pts.push({ l: { x: x - nx * w, y: y - ny * w }, r: { x: x + nx * w, y: y + ny * w } });
    x += Math.cos(ang) * step; y += Math.sin(ang) * step;
    ang += curve / steps;
  }
  for (let i = 0; i < steps; i++) {
    px.poly([pts[i].l, pts[i].r, pts[i + 1].r, pts[i + 1].l], shade(c, 0.8));
  }
  // Lit edge down one side, dark spine down the other.
  for (let i = 0; i < steps; i++) {
    px.line(pts[i].l.x, pts[i].l.y, pts[i + 1].l.x, pts[i + 1].l.y, edge);
    px.line(pts[i].r.x, pts[i].r.y, pts[i + 1].r.x, pts[i + 1].r.y, shade(c, 0.55));
  }
  const mid = (i: number) => ({ x: (pts[i].l.x + pts[i].r.x) / 2, y: (pts[i].l.y + pts[i].r.y) / 2 });
  for (let i = 0; i < steps; i++) px.line(mid(i).x, mid(i).y, mid(i + 1).x, mid(i + 1).y, c);
  return { tip: mid(steps), side: pts[steps] };
}

function drawWeapon(px: Px, w: WeaponVis, hand: V3, grip: V3, ox: number, oy: number, spin: number) {
  if (w.shape === 'none') return;
  const g = norm(grip);
  const H = project(hand, ox, oy, spin);
  const T = project(add(hand, scale(g, w.len)), ox, oy, spin);
  drawWeapon2D(px, w, H.x, H.y, T.x, T.y);
}

/**
 * Draws a weapon between two screen points. Shared by the character painter and
 * the inventory icons, so an icon is literally the weapon you will be holding.
 */
export function drawWeapon2D(px: Px, w: WeaponVis, hx: number, hy: number, tx: number, ty: number) {
  if (w.shape === 'none') return;
  const H = { x: hx, y: hy, d: 0 };
  const T = { x: tx, y: ty, d: 0 };
  let dx = T.x - H.x, dy = T.y - H.y;
  const dl = Math.hypot(dx, dy) || 1;
  dx /= dl; dy /= dl;
  const screenLen = dl;
  const n = perp(H.x, H.y, T.x, T.y);
  const wid = w.width ?? 1;
  const grip0 = { x: H.x - dx * 3.4, y: H.y - dy * 3.4, d: H.d };

  if (w.glow) {
    px.capsule(grip0.x, grip0.y, T.x, T.y, 3.4 * wid, 2.6 * wid, w.glow, 0.2);
    px.capsule(grip0.x, grip0.y, T.x, T.y, 2.1 * wid, 1.5 * wid, w.glow, 0.3);
  }

  const shaft = (len: number, r: number) => px.capsule(grip0.x, grip0.y, H.x + dx * len, H.y + dy * len, r, r * 0.9, w.grip);
  const pommel = () => blob(px, grip0, 1.5, 1.5, shade(w.grip, 1.3));
  const crossguard = (half: number) => {
    px.capsule(H.x - n.x * half, H.y - n.y * half, H.x + n.x * half, H.y + n.y * half, 1.3, 1.3, mix(w.blade, w.grip, 0.3));
    px.capsule(H.x - n.x * half, H.y - n.y * half - 0.7, H.x + n.x * half, H.y + n.y * half - 0.7, 0.7, 0.7, w.edge);
  };

  switch (w.shape) {
    case 'straight': case 'great': case 'rapier': case 'cleaver': {
      const bw = w.shape === 'great' ? 5.2 : w.shape === 'rapier' ? 1.6 : w.shape === 'cleaver' ? 6.4 : 3.2;
      shaft(0, 1.2); pommel();
      bladeArc(px, H, dx, dy, screenLen, w.curve ?? 0, bw * wid, (w.shape === 'rapier' ? 0.8 : w.shape === 'cleaver' ? 5.6 : 1.4) * wid, w.blade, w.edge);
      if (w.guard === 'cross') crossguard(w.shape === 'great' ? 5.4 : 4);
      else if (w.guard === 'disc') blob(px, H, 3.4, 2.2, mix(w.blade, w.grip, 0.4));
      else if (w.guard === 'swept') { crossguard(3.4); px.capsule(H.x + n.x * 3.4, H.y + n.y * 3.4, H.x + dx * 5 + n.x * 1.2, H.y + dy * 5 + n.y * 1.2, 0.9, 0.7, mix(w.blade, w.grip, 0.3)); }
      else if (w.guard === 'ring') px.ellipse(H.x, H.y, 3.2, 2.4, shade(w.grip, 1.2));
      break;
    }
    case 'curved': case 'katana': {
      shaft(0, 1.1); pommel();
      bladeArc(px, H, dx, dy, screenLen, (w.curve ?? 0.34) * (w.shape === 'katana' ? 0.6 : 1), 3 * wid, 1.6 * wid, w.blade, w.edge, 8);
      if (w.shape === 'katana') blob(px, H, 2.6, 1.8, shade(w.grip, 0.7));
      else crossguard(3.2);
      break;
    }
    case 'dagger': {
      shaft(0, 1.0); pommel();
      bladeArc(px, H, dx, dy, screenLen, 0, 2.6 * wid, 0.9 * wid, w.blade, w.edge, 4);
      crossguard(2.4);
      break;
    }
    case 'spear': case 'halberd': {
      px.capsule(grip0.x, grip0.y, T.x, T.y, 1.5, 1.3, w.grip);
      const headAt = { x: H.x + dx * screenLen * 0.82, y: H.y + dy * screenLen * 0.82, d: H.d };
      bladeArc(px, headAt, dx, dy, screenLen * 0.2, 0, 3.2 * wid, 0.6 * wid, w.blade, w.edge, 4);
      if (w.shape === 'halberd') {
        px.poly([
          { x: headAt.x, y: headAt.y },
          { x: headAt.x + n.x * 7, y: headAt.y + n.y * 7 - 1 },
          { x: headAt.x + n.x * 6 - dx * 6, y: headAt.y + n.y * 6 - dy * 6 },
          { x: headAt.x - dx * 4, y: headAt.y - dy * 4 },
        ], w.blade);
        px.line(headAt.x + n.x * 7, headAt.y + n.y * 7 - 1, headAt.x + n.x * 6 - dx * 6, headAt.y + n.y * 6 - dy * 6, w.edge);
      }
      break;
    }
    case 'axe': case 'greataxe': {
      px.capsule(grip0.x, grip0.y, T.x, T.y, 1.5, 1.3, w.grip);
      const big = w.shape === 'greataxe' ? 1.5 : 1;
      const hx = H.x + dx * screenLen * 0.8, hy = H.y + dy * screenLen * 0.8;
      const bladePoly = (s: number) => px.poly([
        { x: hx + dx * 2, y: hy + dy * 2 },
        { x: hx + n.x * s * 8 * big + dx * 3, y: hy + n.y * s * 8 * big + dy * 3 },
        { x: hx + n.x * s * 9 * big - dx * 4, y: hy + n.y * s * 9 * big - dy * 4 },
        { x: hx - dx * 5, y: hy - dy * 5 },
      ], w.blade);
      bladePoly(1);
      if (w.shape === 'greataxe') bladePoly(-1);
      px.line(hx + n.x * 8 * big + dx * 3, hy + n.y * 8 * big + dy * 3, hx + n.x * 9 * big - dx * 4, hy + n.y * 9 * big - dy * 4, w.edge);
      break;
    }
    case 'hammer': case 'mace': case 'flail': {
      px.capsule(grip0.x, grip0.y, T.x, T.y, 1.5, 1.3, w.grip);
      const hx = H.x + dx * screenLen * 0.88, hy = H.y + dy * screenLen * 0.88;
      if (w.shape === 'hammer') {
        px.poly([
          { x: hx + n.x * 5 - dx * 4, y: hy + n.y * 5 - dy * 4 },
          { x: hx - n.x * 5 - dx * 4, y: hy - n.y * 5 - dy * 4 },
          { x: hx - n.x * 4.5 + dx * 6, y: hy - n.y * 4.5 + dy * 6 },
          { x: hx + n.x * 4.5 + dx * 6, y: hy + n.y * 4.5 + dy * 6 },
        ], w.blade);
      } else {
        blob(px, { x: hx, y: hy, d: H.d }, 4.4, 4.4, w.blade);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          px.capsule(hx, hy, hx + Math.cos(a) * 6, hy + Math.sin(a) * 6, 1.4, 0.3, w.edge);
        }
      }
      break;
    }
    case 'staff': {
      px.capsule(grip0.x, grip0.y, T.x, T.y, 1.4, 1.2, w.grip);
      blob(px, T, 2.8, 2.8, w.blade);
      if (w.glow) px.ellipse(T.x, T.y, 4.6, 4.6, w.glow, 0.3);
      break;
    }
    case 'scythe': {
      px.capsule(grip0.x, grip0.y, T.x, T.y, 1.5, 1.3, w.grip);
      bladeArc(px, T, dx * 0.2 + n.x, dy * 0.2 + n.y, screenLen * 0.62, 1.5, 3.6 * wid, 0.5 * wid, w.blade, w.edge, 9);
      break;
    }
    case 'claw': {
      for (let k = -1; k <= 1; k++) {
        const sx = H.x + n.x * k * 2.2, sy = H.y + n.y * k * 2.2;
        bladeArc(px, { x: sx, y: sy, d: H.d }, dx, dy, screenLen * 0.7, 0.4 * k, 1.8, 0.3, w.blade, w.edge, 4);
      }
      break;
    }
    case 'whip': {
      let cx = H.x, cy = H.y, a = Math.atan2(dy, dx);
      for (let k = 0; k < 10; k++) {
        const nx2 = cx + Math.cos(a) * (screenLen / 10), ny2 = cy + Math.sin(a) * (screenLen / 10);
        px.capsule(cx, cy, nx2, ny2, 1.4 - k * 0.1, 1.3 - k * 0.1, k < 2 ? w.grip : w.blade);
        cx = nx2; cy = ny2; a += 0.3 * Math.sin(k);
      }
      break;
    }
    case 'torch': {
      px.capsule(grip0.x, grip0.y, T.x, T.y, 1.4, 1.2, w.grip);
      px.ellipse(T.x, T.y - 2, 3.4, 4.4, [255, 170, 60], 0.75);
      px.ellipse(T.x, T.y - 3, 2, 3, [255, 235, 170]);
      break;
    }
    case 'bow': {
      const half = screenLen * 0.5;
      bladeArc(px, { x: H.x - n.x * half, y: H.y - n.y * half, d: H.d }, n.x, n.y, screenLen, 0.9, 1.8, 1.8, w.grip, shade(w.grip, 1.2), 8);
      px.line(H.x - n.x * half, H.y - n.y * half, H.x + n.x * half, H.y + n.y * half, [220, 210, 190]);
      break;
    }
  }
}

/** Flat, face-on shield for inventory icons. */
export function drawShield2D(px: Px, s: ShieldVis, cx: number, cy: number, rx: number, h: number) {
  if (s.shape === 'none') return;
  if (s.shape === 'kite') {
    px.poly([{ x: cx, y: cy - h * 0.6 }, { x: cx + rx, y: cy - h * 0.2 }, { x: cx + rx * 0.5, y: cy + h * 0.7 }, { x: cx - rx * 0.5, y: cy + h * 0.7 }, { x: cx - rx, y: cy - h * 0.2 }], shade(s.main, 0.78));
    px.poly([{ x: cx, y: cy - h * 0.46 }, { x: cx + rx * 0.74, y: cy - h * 0.14 }, { x: cx + rx * 0.37, y: cy + h * 0.54 }, { x: cx - rx * 0.37, y: cy + h * 0.54 }, { x: cx - rx * 0.74, y: cy - h * 0.14 }], s.main);
  } else if (s.shape === 'tower') {
    px.rect(cx - rx, cy - h * 0.55, rx * 2, h, shade(s.main, 0.78));
    px.rect(cx - rx + 2, cy - h * 0.55 + 2, rx * 2 - 4, h - 4, s.main);
    px.rect(cx - 1.5, cy - h * 0.55, 3, h, s.trim);
  } else {
    px.ellipse(cx, cy, rx, h * 0.5, shade(s.main, 0.76));
    px.ellipse(cx - 1, cy - 1, rx * 0.84, h * 0.42, s.main);
  }
  if (s.boss) px.ellipse(cx - 0.5, cy - 0.5, Math.max(1.5, rx * 0.26), Math.max(1.5, h * 0.17), s.boss);
  px.ellipse(cx, cy, rx * 0.5, h * 0.26, s.trim, 0.0);
}

function drawShield(px: Px, s: ShieldVis, hand: V3, facing: V3, chest: V3, ox: number, oy: number, spin: number) {
  if (s.shape === 'none') return;
  const H = project(hand, ox, oy, spin);
  const C0 = project(chest, ox, oy, spin);
  // push the shield off the body, along the arm, so it never reads as a slab
  // pasted over the torso
  let ax = H.x - C0.x, ay = H.y - C0.y;
  const al = Math.hypot(ax, ay) || 1;
  ax /= al; ay /= al;
  const off = s.shape === 'tower' ? 4.5 : s.shape === 'buckler' ? 1.5 : 3;
  const f = norm(facing);
  // Shields foreshorten as they turn away from the camera.
  const squash = 0.42 + Math.abs(f.y) * 0.1 + (1 - Math.abs(f.x)) * 0.0;
  const w = s.shape === 'tower' ? 7 : s.shape === 'buckler' ? 4.6 : 7.4;
  const h = s.shape === 'tower' ? 17 : s.shape === 'kite' ? 14 : s.shape === 'buckler' ? 5 : 9;
  const rx = Math.max(2.2, w * (0.42 + Math.abs(f.x) * 0.7) * (1 - Math.abs(f.y) * squash * 0.45));
  const cx = H.x - f.x * 1.5 + ax * off, cy = H.y - 2 + f.y * 0.5 + ay * off;
  if (s.shape === 'kite') {
    px.poly([{ x: cx, y: cy - h * 0.6 }, { x: cx + rx, y: cy - h * 0.2 }, { x: cx + rx * 0.5, y: cy + h * 0.7 }, { x: cx - rx * 0.5, y: cy + h * 0.7 }, { x: cx - rx, y: cy - h * 0.2 }], shade(s.main, 0.8));
    px.poly([{ x: cx, y: cy - h * 0.45 }, { x: cx + rx * 0.72, y: cy - h * 0.12 }, { x: cx + rx * 0.36, y: cy + h * 0.52 }, { x: cx - rx * 0.36, y: cy + h * 0.52 }, { x: cx - rx * 0.72, y: cy - h * 0.12 }], s.main);
  } else if (s.shape === 'tower') {
    px.rect(cx - rx, cy - h * 0.55, rx * 2, h, shade(s.main, 0.8));
    px.rect(cx - rx + 1, cy - h * 0.55 + 1, rx * 2 - 2, h - 2, s.main);
    px.rect(cx - 1, cy - h * 0.55, 2, h, s.trim);
  } else {
    px.ellipse(cx, cy, rx, h * 0.55, shade(s.main, 0.78));
    px.ellipse(cx - 0.6, cy - 0.8, rx * 0.84, h * 0.46, s.main);
  }
  if (s.boss) px.ellipse(cx - 0.4, cy - 0.6, Math.max(1, rx * 0.28), h * 0.18, s.boss);
  px.ellipse(cx, cy, rx, h * 0.55, s.trim, 0);
}

// ---------------------------------------------------------------- body

export interface PaintOpts { ground?: boolean; /** Facing yaw: 0 = toward camera, PI = away. */ yaw?: number }

export function paintSkeleton(px: Px, s: Skel, look: Look, ox: number, oy: number, seed = 1, opts: PaintOpts = {}) {
  const B = look.build;
  const spin = s.spin;
  // Plant the support foot on the baseline. Without this the whole body drifts
  // off the ground as the legs swing through depth.
  if (opts.ground !== false && !spin) {
    const fl = project(s.ftL, 0, 0, spin).y, fr = project(s.ftR, 0, 0, spin).y;
    oy -= Math.max(fl, fr) + 1;
  }
  const P = (v: V3) => project(v, ox, oy, spin);
  const cmds: Cmd[] = [];
  const push = (d: number, run: () => void) => cmds.push({ d, run });

  const body = look.body;
  const bulk = body?.bulk ?? 0;
  const armC = body?.main ?? look.cloth;
  const trim = body?.trim ?? shade(look.cloth, 1.25);
  const arms = look.arms;
  const legsV = look.legs;
  const sleeveC = arms?.main ?? (bulk > 0.4 ? armC : look.cloth);
  const legC = legsV?.main ?? (bulk > 1.4 ? armC : shade(look.cloth, 0.86));
  const armBulk = arms?.bulk ?? bulk;
  const legBulk = legsV?.bulk ?? bulk;
  const thick = B.thick;

  // ---- cape, behind everything
  if (look.cape) {
    const c = look.cape;
    push(-40, () => {
      const a = P(s.shL), b = P(s.shR), p = P(s.pelvis);
      const sway = (a.x - b.x) * 0.12;
      const bottom = p.y + c.len;
      const pts: Pt[] = [
        { x: a.x, y: a.y - 1 }, { x: b.x, y: b.y - 1 },
        { x: b.x + 2.5 + sway, y: bottom }, { x: a.x - 2.5 + sway, y: bottom },
      ];
      px.poly(pts, shade(c.main, 0.72));
      px.poly([{ x: a.x + 1, y: a.y }, { x: b.x - 1, y: b.y }, { x: b.x + sway, y: bottom - 2 }, { x: a.x + sway, y: bottom - 2 }], c.main);
      if (c.tatter) {
        let r = seed >>> 0;
        for (let k = 0; k < 7; k++) {
          r = (r * 1103515245 + 12345) >>> 0;
          const t = ((r >>> 12) & 255) / 255;
          const x = a.x + (b.x - a.x) * t + sway;
          px.capsule(x, bottom - 1, x + (t - 0.5) * 4, bottom + 2 + ((r >>> 20) & 3), 1.6, 0.4, shade(c.main, 0.8));
        }
      }
      px.line(a.x, a.y - 1, b.x, b.y - 1, c.trim);
    });
  }

  // ---- legs
  const leg = (hip: V3, kn: V3, ft: V3) => {
    const h = P(hip), k = P(kn), f = P(ft);
    push((hip.y + kn.y + ft.y) / 3, () => {
      const rim: Col = look.ink ?? [12, 9, 14];
      limb(px, h, k, (2.5 + legBulk * 0.5) * thick, (2.0 + legBulk * 0.45) * thick, legC, 1, rim);
      limb(px, k, f, (2.0 + legBulk * 0.4) * thick, (1.6 + legBulk * 0.3) * thick, legC, 1, rim);
      // boot
      const toe = { x: f.x + (f.x - k.x) * 0.1, y: f.y + 0.4, d: f.d };
      blob(px, toe, 2.7 * thick, 1.8 * thick, look.boots);
      // greaves
      if (legBulk > 1.2) { px.capsule(k.x, k.y - 1, f.x, f.y - 2, 2.3 * thick, 1.7 * thick, legsV?.main ?? armC); px.line(k.x, k.y, f.x, f.y - 2, legsV?.trim ?? trim); }
    });
  };
  leg(s.hipL, s.knL, s.ftL);
  leg(s.hipR, s.knR, s.ftR);

  // ---- torso
  push(s.chest.y - 0.2, () => {
    const a = P(s.shL), b = P(s.shR), hl = P(s.hipL), hr = P(s.hipR), ch = P(s.chest), pv = P(s.pelvis);
    const wExtra = bulk * 0.8;
    const k = 0.74; // torso is inset from the shoulder joints
    const sxL = ch.x + (a.x - ch.x) * k, sxR = ch.x + (b.x - ch.x) * k;
    const pts: Pt[] = [
      { x: sxL - wExtra, y: a.y - 0.5 }, { x: sxR + wExtra, y: b.y - 0.5 },
      { x: hr.x + 0.8 + wExtra * 0.5, y: hr.y + 1 }, { x: hl.x - 0.8 - wExtra * 0.5, y: hl.y + 1 },
    ];
    px.poly(pts, shade(armC, 0.78));
    px.capsule(pv.x, pv.y, ch.x, ch.y, (3.6 + wExtra) * thick, (4.6 + wExtra) * thick, shade(armC, 0.84));
    px.capsule(pv.x - 0.6, pv.y - 0.9, ch.x - 0.6, ch.y - 0.9, (2.9 + wExtra) * thick, (3.8 + wExtra) * thick, armC);
    if (body) {
      const x0 = Math.min(sxL, sxR) - 2, y0 = Math.min(a.y, b.y) - 1;
      fabric(px, body.kind, x0 | 0, y0 | 0, Math.abs(sxR - sxL) + 5, Math.abs(hl.y - a.y) + 4, armC, seed);
      // chest trim: a vertical band and a belt
      px.line(ch.x, ch.y - 2, pv.x, pv.y, trim);
      px.capsule(hl.x - 1, hl.y, hr.x + 1, hr.y, 1.3, 1.3, shade(trim, 0.9));
      if (body.fur) {
        px.capsule(a.x - 1, a.y - 1.5, b.x + 1, b.y - 1.5, 2.6 * thick, 2.6 * thick, body.fur);
        px.capsule(a.x - 1, a.y - 2.4, b.x + 1, b.y - 2.4, 1.3, 1.3, shade(body.fur, 1.2));
      }
      if (body.skirt > 0) {
        const bot = pv.y + body.skirt;
        px.poly([{ x: hl.x - 1, y: hl.y }, { x: hr.x + 1, y: hr.y }, { x: hr.x + 2.4, y: bot }, { x: hl.x - 2.4, y: bot }], shade(armC, 0.7));
        px.poly([{ x: hl.x, y: hl.y + 1 }, { x: hr.x, y: hr.y + 1 }, { x: hr.x + 1.6, y: bot - 1 }, { x: hl.x - 1.6, y: bot - 1 }], shade(armC, 0.95));
        px.line(pv.x, pv.y, pv.x, bot - 1, shade(armC, 0.6));
      }
      if (body.studs) {
        for (let k = -1; k <= 1; k++) px.over(ch.x + k * 2.6, ch.y + 1, trim);
      }
    } else {
      // bare torso: a little anatomy so it isn't a sausage
      px.ellipseOver(ch.x, ch.y + 1, 4 * thick, 2.2 * thick, shade(armC, 1.1));
      px.ellipseOver(pv.x, pv.y - 2, 2.6 * thick, 2.6 * thick, shade(armC, 0.9));
    }
  });

  // ---- arms (depth sorted individually so the far arm hides behind the torso)
  const arm = (sh: V3, el: V3, hd: V3, isRight: boolean) => {
    const a = P(sh), e = P(el), h = P(hd);
    push((sh.y * 0.5 + el.y + hd.y * 1.5) / 3, () => {
      const rim: Col = look.ink ?? [12, 9, 14];
      limb(px, a, e, 2.5 * thick + armBulk * 0.45, 2.0 * thick + armBulk * 0.35, sleeveC, 1, rim);
      limb(px, e, h, 1.9 * thick + armBulk * 0.25, 1.6 * thick + armBulk * 0.2, sleeveC, 1, rim);
      // bracers
      if (armBulk > 1.0) { px.capsule(e.x, e.y - 0.5, h.x, h.y - 0.5, 2.1 * thick, 1.8 * thick, arms?.main ?? armC); px.line(e.x, e.y - 1, h.x, h.y - 1, arms?.trim ?? trim); }
      blob(px, h, 1.9 * thick, 1.9 * thick, armBulk > 1.0 ? (arms?.main ?? armC) : look.skin);
      const pd = body?.pauldron ?? 0;
      if (pd > 0.05) {
        // A shoulder plate that hangs off the outboard side, sized by `pauldron`.
        const out = isRight ? 1 : -1;
        const wIn = 1.9 * pd, wOut = 3.6 * pd, drop = 3.4 * pd;
        px.poly([
          { x: a.x - (isRight ? wIn : wOut), y: a.y - 2.0 },
          { x: a.x + (isRight ? wOut : wIn), y: a.y - 2.0 },
          { x: a.x + (isRight ? wOut * 1.05 : wIn * 0.8), y: a.y + drop },
          { x: a.x - (isRight ? wIn * 0.8 : wOut * 1.05), y: a.y + drop },
        ], shade(armC, 0.86));
        px.capsule(a.x - (isRight ? wIn : wOut), a.y - 2.2, a.x + (isRight ? wOut : wIn), a.y - 2.2, 1.5 * pd + 0.5, 1.5 * pd + 0.5, armC);
        px.capsule(a.x + out * wOut * 0.3, a.y + drop - 0.4, a.x + out * wOut * 0.95, a.y + drop - 0.2, 0.8, 0.8, trim);
      }
    });
  };
  arm(s.shL, s.elL, s.hdL, false);
  arm(s.shR, s.elR, s.hdR, true);

  // ---- head
  push(s.head.y + 0.6, () => {
    const hd = P(s.head), nk = P(s.neck);
    const r = B.head * B.h;
    px.capsule(nk.x, nk.y + 1.5, hd.x, hd.y + r * 0.55, 2.2 * thick, 2.5 * thick, shade(look.skin, 0.74));
    blob(px, hd, r, r * 1.06, look.skin);
    const yaw = opts.yaw ?? 0;
    drawHead(px, hd, r, look, Math.cos(yaw), -Math.sin(yaw));
  });

  // ---- weapon & shield
  if (look.weapon) {
    const d = s.hdR.y + (look.weapon.len > 14 ? 2 : 0);
    push(d + 0.4, () => drawWeapon(px, look.weapon!, s.hdR, s.gripR, ox, oy, spin));
  }
  if (look.shield) {
    push(s.hdL.y + 0.5, () => drawShield(px, look.shield!, s.hdL, s.gripL, s.chest, ox, oy, spin));
  }

  cmds.sort((a, b) => a.d - b.d);
  for (const c of cmds) c.run();
}

/** facing: +1 = straight at the camera, -1 = straight away. lean: screen-x of the gaze. */
function drawHead(px: Px, hd: P2, r: number, look: Look, facing: number, gazeX: number) {
  const faceVisible = facing > 0.2;
  const f = { x: gazeX, y: 0, z: 0 };
  const helm = look.helm;
  const skin = look.skin;

  // hair first (under most helms)
  if (look.hairStyle !== 'none' && look.hairStyle !== 'bald' && (!helm || helm.kind === 'none' || helm.kind === 'crown' || helm.kind === 'cap')) {
    const h = look.hair;
    const back = facing < 0;
    px.ellipse(hd.x, hd.y - r * (back ? 0.16 : 0.46), r * 1.06, r * (back ? 0.98 : 0.72), shade(h, 0.82));
    px.ellipse(hd.x - 0.6, hd.y - r * (back ? 0.3 : 0.58), r * 0.88, r * (back ? 0.76 : 0.52), h);
    if (!back) px.ellipseOver(hd.x + gazeX * r * 0.2, hd.y - r * 0.08, r * 0.9, r * 0.22, shade(look.skin, 0.72), 0.55);
    if (look.hairStyle === 'long' || look.hairStyle === 'braid') {
      px.capsule(hd.x - r * 0.85, hd.y - r * 0.2, hd.x - r * 0.75, hd.y + r * 1.7, r * 0.42, r * 0.3, shade(h, 0.8));
      px.capsule(hd.x + r * 0.85, hd.y - r * 0.2, hd.x + r * 0.75, hd.y + r * 1.7, r * 0.42, r * 0.3, shade(h, 0.8));
    }
    if (look.hairStyle === 'bun') px.ellipse(hd.x, hd.y - r * 1.05, r * 0.52, r * 0.46, h);
    if (look.hairStyle === 'topknot') px.capsule(hd.x, hd.y - r * 0.9, hd.x - 1, hd.y - r * 2.1, r * 0.3, r * 0.16, h);
    if (look.hairStyle === 'wild') {
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI * 0.9 + (k / 6) * Math.PI * 0.8;
        px.capsule(hd.x + Math.cos(a) * r * 0.7, hd.y + Math.sin(a) * r * 0.7, hd.x + Math.cos(a) * r * 1.5, hd.y + Math.sin(a) * r * 1.5, 1.3, 0.3, shade(h, 0.9));
      }
    }
  }

  if (faceVisible && !look.faceless && (!helm || helm.kind === 'none' || helm.kind === 'cap' || helm.kind === 'crown' || helm.kind === 'hood' || helm.kind === 'antler')) {
    const ex = r * 0.44, ey = hd.y + r * 0.16;
    const lean = gazeX * r * 0.3;
    const profile = facing < 0.72; // three-quarter / side: far eye hidden
    const sock = shade(skin, 0.6);
    const drawEye = (x: number) => {
      px.rect(x - 1, ey - 1, 3, 1, sock);
      px.rect(x, ey, 1, 2, look.eye);
    };
    if (!profile || gazeX <= 0) drawEye(hd.x - ex + lean);
    if (!profile || gazeX >= 0) drawEye(hd.x + ex - 1 + lean);
    px.blend(hd.x + lean * 1.3, ey + r * 0.5, shade(skin, 0.55), 0.55);
    px.blend(hd.x + lean * 1.3, ey + r * 0.5 + 1, shade(skin, 0.7), 0.4);
    px.ellipseOver(hd.x - r * 0.55 + lean * 0.3, ey + r * 0.34, r * 0.26, r * 0.2, mix(skin, [196, 108, 98], 0.45), 0.5);
    px.ellipseOver(hd.x + r * 0.55 + lean * 0.3, ey + r * 0.34, r * 0.26, r * 0.2, mix(skin, [196, 108, 98], 0.45), 0.5);
    if (profile) px.capsule(hd.x + Math.sign(gazeX || 1) * r * 0.92, ey + r * 0.1, hd.x + Math.sign(gazeX || 1) * r * 0.86, ey + r * 0.5, 1.1, 0.8, skin);
  }

  if (!helm || helm.kind === 'none') return;
  const m = helm.main, t = helm.trim;
  switch (helm.kind) {
    case 'hood': {
      px.ellipse(hd.x, hd.y - r * 0.18, r * 1.3, r * 1.26, shade(m, 0.8));
      px.ellipse(hd.x - 0.6, hd.y - r * 0.3, r * 1.1, r * 1.0, m);
      // dark opening
      px.ellipse(hd.x + f.x * r * 0.2, hd.y + r * 0.22, r * 0.66, r * 0.56, shade(m, 0.24));
      if (faceVisible) {
        const g = helm.glow ?? [210, 190, 140];
        px.rect(hd.x - r * 0.34 + f.x * r * 0.2, hd.y + r * 0.16, 1, 1, g);
        px.rect(hd.x + r * 0.34 - 1 + f.x * r * 0.2, hd.y + r * 0.16, 1, 1, g);
      }
      px.capsule(hd.x - r * 1.2, hd.y + r * 0.9, hd.x + r * 1.2, hd.y + r * 0.9, r * 0.34, r * 0.34, shade(m, 0.9));
      break;
    }
    case 'cap': {
      px.ellipse(hd.x, hd.y - r * 0.5, r * 1.06, r * 0.6, m);
      px.capsule(hd.x - r * 1.1, hd.y - r * 0.18, hd.x + r * 1.1, hd.y - r * 0.18, 1.2, 1.2, t);
      break;
    }
    case 'barbute': case 'great': {
      const big = helm.kind === 'great' ? 1.2 : 1.05;
      px.ellipse(hd.x, hd.y - r * 0.1, r * 1.16 * big, r * 1.2 * big, shade(m, 0.8));
      px.ellipse(hd.x - 0.7, hd.y - r * 0.26, r * 0.98 * big, r * 0.96 * big, m);
      px.ellipse(hd.x - 1.1, hd.y - r * 0.6, r * 0.5, r * 0.34, shade(m, 1.22));
      if (faceVisible) {
        px.rect(hd.x - r * 0.62 + f.x * r * 0.2, hd.y + r * 0.06, r * 1.24, 1, shade(m, 0.2));
        if (helm.kind === 'great') px.rect(hd.x - 1 + f.x * r * 0.2, hd.y - r * 0.4, 2, r * 0.9, shade(m, 0.22));
        if (helm.glow) { px.rect(hd.x - r * 0.5 + f.x * r * 0.2, hd.y + r * 0.06, 1, 1, helm.glow); px.rect(hd.x + r * 0.5 + f.x * r * 0.2, hd.y + r * 0.06, 1, 1, helm.glow); }
      }
      px.capsule(hd.x - r * 1.05, hd.y + r * 0.78, hd.x + r * 1.05, hd.y + r * 0.78, 1.3, 1.3, t);
      break;
    }
    case 'horned': case 'antler': {
      if (helm.kind === 'horned') {
        px.ellipse(hd.x, hd.y - r * 0.12, r * 1.18, r * 1.16, shade(m, 0.8));
        px.ellipse(hd.x - 0.7, hd.y - r * 0.28, r * 1.0, r * 0.94, m);
        if (faceVisible) px.rect(hd.x - r * 0.6 + f.x * r * 0.2, hd.y + r * 0.08, r * 1.2, 1, shade(m, 0.2));
      }
      const hc = t;
      const n = helm.horn ?? 2;
      for (let side = -1; side <= 1; side += 2) {
        let cx = hd.x + side * r * 0.85, cy = hd.y - r * 0.5;
        let a = side > 0 ? -0.9 : -Math.PI + 0.9;
        for (let k = 0; k < n + 1; k++) {
          const l = r * (0.9 - k * 0.12);
          const nx = cx + Math.cos(a) * l, ny = cy + Math.sin(a) * l;
          px.capsule(cx, cy, nx, ny, 1.9 - k * 0.4, 1.4 - k * 0.35, hc);
          if (helm.kind === 'antler' && k < n) px.capsule(nx, ny, nx + side * r * 0.5, ny - r * 0.5, 0.9, 0.3, hc);
          cx = nx; cy = ny; a -= side * 0.55;
        }
      }
      break;
    }
    case 'crown': {
      for (let k = -2; k <= 2; k++) px.capsule(hd.x + k * r * 0.42, hd.y - r * 0.6, hd.x + k * r * 0.46, hd.y - r * (1.0 + (k % 2 ? 0 : 0.25)), 1.1, 0.5, m);
      px.capsule(hd.x - r * 1.0, hd.y - r * 0.56, hd.x + r * 1.0, hd.y - r * 0.56, 1.4, 1.4, m);
      px.over(hd.x, hd.y - r * 0.56, t);
      break;
    }
    case 'mask': {
      px.ellipse(hd.x + f.x * r * 0.15, hd.y + r * 0.05, r * 0.92, r * 1.0, m);
      if (faceVisible) {
        px.rect(hd.x - r * 0.45 + f.x * r * 0.15, hd.y - r * 0.05, 1, 2, shade(m, 0.2));
        px.rect(hd.x + r * 0.45 + f.x * r * 0.15, hd.y - r * 0.05, 1, 2, shade(m, 0.2));
        px.capsule(hd.x + f.x * r * 0.15, hd.y + r * 0.3, hd.x + f.x * r * 0.15, hd.y + r * 0.9, 1.1, 0.6, shade(m, 0.7));
      }
      break;
    }
    case 'tricorn': {
      px.ellipse(hd.x, hd.y - r * 0.4, r * 1.0, r * 0.66, m);
      px.poly([
        { x: hd.x - r * 1.9, y: hd.y - r * 0.1 }, { x: hd.x, y: hd.y - r * 0.75 },
        { x: hd.x + r * 1.9, y: hd.y - r * 0.1 }, { x: hd.x, y: hd.y + r * 0.2 },
      ], shade(m, 0.88));
      px.line(hd.x - r * 1.9, hd.y - r * 0.1, hd.x, hd.y - r * 0.75, t);
      break;
    }
    case 'skull': {
      px.ellipse(hd.x, hd.y - r * 0.1, r * 1.04, r * 1.04, m);
      if (faceVisible) {
        px.ellipse(hd.x - r * 0.4 + f.x * r * 0.2, hd.y, r * 0.26, r * 0.3, [14, 10, 12]);
        px.ellipse(hd.x + r * 0.4 + f.x * r * 0.2, hd.y, r * 0.26, r * 0.3, [14, 10, 12]);
        if (helm.glow) { px.over(hd.x - r * 0.4 + f.x * r * 0.2, hd.y, helm.glow); px.over(hd.x + r * 0.4 + f.x * r * 0.2, hd.y, helm.glow); }
        for (let k = -1; k <= 1; k++) px.rect(hd.x + k * 1.6 + f.x * r * 0.2, hd.y + r * 0.6, 1, 2, [20, 14, 16]);
      }
      break;
    }
    case 'veil': {
      px.ellipse(hd.x, hd.y - r * 0.3, r * 1.22, r * 1.0, m, 0.95);
      px.poly([
        { x: hd.x - r * 1.2, y: hd.y - r * 0.2 }, { x: hd.x + r * 1.2, y: hd.y - r * 0.2 },
        { x: hd.x + r * 1.0, y: hd.y + r * 2.4 }, { x: hd.x - r * 1.0, y: hd.y + r * 2.4 },
      ], m, 0.55);
      break;
    }
  }
  if (helm.plume) {
    px.capsule(hd.x, hd.y - r * 0.9, hd.x - r * 0.3, hd.y - r * 2.2, 1.7, 0.6, helm.plume);
    px.capsule(hd.x - r * 0.3, hd.y - r * 2.2, hd.x - r * 1.1, hd.y - r * 1.4, 1.3, 0.4, shade(helm.plume, 0.85));
  }
}
