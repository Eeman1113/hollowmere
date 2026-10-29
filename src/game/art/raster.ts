// Tiny software rasterizer. Everything the game draws — characters, armour,
// weapons, architecture — is painted into one of these buffers and uploaded as
// a Phaser canvas texture, so the build ships with zero image assets.

export type Col = [number, number, number];

export const col = (hex: number): Col => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
export const shade = (c: Col, k: number): Col => [
  Math.max(0, Math.min(255, c[0] * k)) | 0,
  Math.max(0, Math.min(255, c[1] * k)) | 0,
  Math.max(0, Math.min(255, c[2] * k)) | 0,
];
export const mix = (a: Col, b: Col, t: number): Col => [
  (a[0] + (b[0] - a[0]) * t) | 0, (a[1] + (b[1] - a[1]) * t) | 0, (a[2] + (b[2] - a[2]) * t) | 0,
];
/** Push a colour toward a hue without changing its perceived weight much. */
export const tintTo = (c: Col, t: Col, k: number): Col => mix(c, t, k);

export type Pt = { x: number; y: number };

export class Px {
  d: Uint8ClampedArray;
  w: number;
  h: number;
  constructor(w: number, h: number) {
    this.w = w; this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }

  clear() { this.d.fill(0); }

  alphaAt(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d[(y * this.w + x) * 4 + 3];
  }
  colAt(x: number, y: number): Col {
    const i = (y * this.w + x) * 4;
    return [this.d[i], this.d[i + 1], this.d[i + 2]];
  }

  /** Opaque write. */
  set(x: number, y: number, c: Col) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255;
  }
  /** Alpha blend over whatever is there. */
  blend(x: number, y: number, c: Col, a: number) {
    x |= 0; y |= 0;
    if (a <= 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    if (a >= 1) return this.set(x, y, c);
    const i = (y * this.w + x) * 4;
    const da = this.d[i + 3] / 255;
    const out = a + da * (1 - a);
    this.d[i] = (c[0] * a + this.d[i] * da * (1 - a)) / out;
    this.d[i + 1] = (c[1] * a + this.d[i + 1] * da * (1 - a)) / out;
    this.d[i + 2] = (c[2] * a + this.d[i + 2] * da * (1 - a)) / out;
    this.d[i + 3] = out * 255;
  }
  /** Only paint where something is already opaque (used for armour trim, decals). */
  over(x: number, y: number, c: Col) { if (this.alphaAt(x | 0, y | 0) > 0) this.set(x, y, c); }

  rect(x: number, y: number, w: number, h: number, c: Col) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  rectA(x: number, y: number, w: number, h: number, c: Col, a: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.blend(x + i, y + j, c, a);
  }

  /** Convex polygon scanline fill. */
  poly(pts: Pt[], c: Col, a = 1) {
    if (pts.length < 3) return;
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
    y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(this.h - 1, Math.ceil(y1));
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5;
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        if ((p.y <= yc && q.y > yc) || (q.y <= yc && p.y > yc)) {
          const t = (yc - p.y) / (q.y - p.y);
          const x = p.x + (q.x - p.x) * t;
          if (x < lo) lo = x; if (x > hi) hi = x;
        }
      }
      if (lo > hi) continue;
      const xa = Math.max(0, Math.round(lo)), xb = Math.min(this.w - 1, Math.round(hi));
      for (let x = xa; x <= xb; x++) { if (a >= 1) this.set(x, y, c); else this.blend(x, y, c, a); }
    }
  }

  /** Tapered capsule — the workhorse for limbs, blades, pillars, branches. */
  capsule(x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, c: Col, a = 1) {
    const dx = x1 - x0, dy = y1 - y0;
    const len2 = dx * dx + dy * dy || 1e-6;
    const rmax = Math.max(r0, r1) + 1;
    const ax = Math.max(0, Math.floor(Math.min(x0, x1) - rmax));
    const bx = Math.min(this.w - 1, Math.ceil(Math.max(x0, x1) + rmax));
    const ay = Math.max(0, Math.floor(Math.min(y0, y1) - rmax));
    const by = Math.min(this.h - 1, Math.ceil(Math.max(y0, y1) + rmax));
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) {
      let t = ((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = x0 + dx * t - (x + 0.5), py = y0 + dy * t - (y + 0.5);
      const r = r0 + (r1 - r0) * t;
      if (px * px + py * py > r * r) continue;
      if (a >= 1) this.set(x, y, c); else this.blend(x, y, c, a);
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: Col, a = 1) {
    const ax = Math.max(0, Math.floor(cx - rx)), bx = Math.min(this.w - 1, Math.ceil(cx + rx));
    const ay = Math.max(0, Math.floor(cy - ry)), by = Math.min(this.h - 1, Math.ceil(cy + ry));
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) {
      const u = (x + 0.5 - cx) / (rx || 1e-6), v = (y + 0.5 - cy) / (ry || 1e-6);
      if (u * u + v * v > 1) continue;
      if (a >= 1) this.set(x, y, c); else this.blend(x, y, c, a);
    }
  }
  /** Ellipse that only paints over existing pixels — shading a face, cheek light. */
  ellipseOver(cx: number, cy: number, rx: number, ry: number, c: Col, a = 1) {
    const ax = Math.max(0, Math.floor(cx - rx)), bx = Math.min(this.w - 1, Math.ceil(cx + rx));
    const ay = Math.max(0, Math.floor(cy - ry)), by = Math.min(this.h - 1, Math.ceil(cy + ry));
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) {
      if (!this.alphaAt(x, y)) continue;
      const u = (x + 0.5 - cx) / (rx || 1e-6), v = (y + 0.5 - cy) / (ry || 1e-6);
      if (u * u + v * v > 1) continue;
      if (a >= 1) this.set(x, y, c); else this.blend(x, y, c, a);
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Col, a = 1) {
    let x = Math.round(x0), y = Math.round(y0);
    const xe = Math.round(x1), ye = Math.round(y1);
    const dx = Math.abs(xe - x), dy = Math.abs(ye - y);
    const sx = x < xe ? 1 : -1, sy = y < ye ? 1 : -1;
    let err = dx - dy;
    for (let guard = 0; guard < 4096; guard++) {
      if (a >= 1) this.set(x, y, c); else this.blend(x, y, c, a);
      if (x === xe && y === ye) break;
      const e2 = err * 2;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }

  /**
   * Dark pixel ring around the silhouette — what makes pixel art read.
   * `minAlpha` keeps faint glows and fog out of the outline pass.
   */
  outline(c: Col, a = 1, minAlpha = 54) {
    const copy = new Uint8ClampedArray(this.d);
    const al = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
      const v = copy[(y * this.w + x) * 4 + 3];
      return v >= minAlpha ? v : 0;
    };
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (copy[(y * this.w + x) * 4 + 3] >= minAlpha) continue;
      if (!(al(x - 1, y) || al(x + 1, y) || al(x, y - 1) || al(x, y + 1))) continue;
      if (a >= 1) this.set(x, y, c); else this.blend(x, y, c, a);
    }
  }

  /**
   * Cheap volumetric shading: lighten the top edge of every mass, darken the
   * bottom. `minAlpha` keeps haze and glow out of it — otherwise fog grows
   * bright scalloped contours.
   */
  topLight(up = 0.3, down = 0.26, depth = 2, minAlpha = 140) {
    const copy = new Uint8ClampedArray(this.d);
    const al = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
      const v = copy[(y * this.w + x) * 4 + 3];
      return v >= minAlpha ? v : 0;
    };
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (!al(x, y)) continue;
      let k = 1;
      if (!al(x, y - 1)) k = 1 + up;
      else if (depth > 1 && !al(x, y - 2)) k = 1 + up * 0.45;
      else if (!al(x, y + 1)) k = 1 - down;
      if (!al(x - 1, y) && k === 1) k = 1 + up * 0.3;
      if (k !== 1) this.set(x, y, shade(this.colAt(x, y), k));
    }
  }

  /** Per-pixel value jitter so cloth and stone don't look like flat vector fills. */
  grain(seed: number, amount = 0.07) {
    let s = seed >>> 0;
    for (let i = 0; i < this.w * this.h; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      if (!this.d[i * 4 + 3]) continue;
      const k = 1 + (((s >>> 16) & 255) / 255 - 0.5) * 2 * amount;
      this.d[i * 4] *= k; this.d[i * 4 + 1] *= k; this.d[i * 4 + 2] *= k;
    }
  }

  /** Multiply the whole buffer (used to sink background architecture into fog). */
  mul(k: number) {
    for (let i = 0; i < this.w * this.h; i++) {
      if (!this.d[i * 4 + 3]) continue;
      this.d[i * 4] *= k; this.d[i * 4 + 1] *= k; this.d[i * 4 + 2] *= k;
    }
  }

  blitTo(target: Px, ox: number, oy: number) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = (y * this.w + x) * 4;
      const a = this.d[i + 3];
      if (!a) continue;
      target.blend(ox + x, oy + y, [this.d[i], this.d[i + 1], this.d[i + 2]], a / 255);
    }
  }
}

/** Create a Phaser canvas texture from a buffer. */
export function upload(scene: Phaser.Scene, key: string, px: Px) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, px.w, px.h);
  if (!tex) return null;
  const ctx = tex.getContext();
  const img = ctx.createImageData(px.w, px.h);
  img.data.set(px.d);
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  return tex;
}

/** Paint one buffer as a grid cell inside an existing atlas texture. */
export function uploadAtlas(scene: Phaser.Scene, key: string, px: Px, frames: { name: string; buf: Px }[], cols: number) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const cw = px.w, ch = px.h;
  const rows = Math.ceil(frames.length / cols);
  const tex = scene.textures.createCanvas(key, cw * cols, ch * rows);
  if (!tex) return null;
  const ctx = tex.getContext();
  frames.forEach((f, i) => {
    const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
    const img = ctx.createImageData(cw, ch);
    img.data.set(f.buf.d);
    ctx.putImageData(img, cx, cy);
    tex.add(f.name, 0, cx, cy, cw, ch);
  });
  tex.refresh();
  return tex;
}
