// Isometric drawing primitives shared by tiles and architecture.
import { Px, shade, mix, type Col, type Pt } from './raster';

export const TW = 64;  // tile width in screen px
export const TH = 32;  // tile height in screen px
export const UNIT = 26; // one storey of wall height

/** The four corners of a tile diamond centred at (cx, cy). */
export const diamond = (cx: number, cy: number, w = TW, h = TH): Pt[] => [
  { x: cx, y: cy - h / 2 }, { x: cx + w / 2, y: cy }, { x: cx, y: cy + h / 2 }, { x: cx - w / 2, y: cy },
];

/** Flat tile face. */
export function topFace(px: Px, cx: number, cy: number, c: Col, w = TW, h = TH) {
  px.poly(diamond(cx, cy, w, h), c);
}

/**
 * A box standing on a tile. Returns the top-face centre so callers can stack
 * things (capitals, roofs, statues) on it.
 */
export function prism(px: Px, cx: number, baseY: number, hPx: number, c: Col, w = TW, h = TH, opts: { top?: Col; left?: number; right?: number } = {}) {
  const topY = baseY - hPx;
  const lf = shade(c, opts.left ?? 0.68);
  const rf = shade(c, opts.right ?? 0.86);
  // left face
  px.poly([
    { x: cx - w / 2, y: baseY - h / 2 }, { x: cx, y: baseY },
    { x: cx, y: topY }, { x: cx - w / 2, y: topY - h / 2 },
  ], lf);
  // right face
  px.poly([
    { x: cx + w / 2, y: baseY - h / 2 }, { x: cx, y: baseY },
    { x: cx, y: topY }, { x: cx + w / 2, y: topY - h / 2 },
  ], rf);
  px.poly(diamond(cx, topY - h / 2, w, h), opts.top ?? shade(c, 1.12));
  return { cx, cy: topY - h / 2 };
}

/** Vertical seam line down the front corner — reads as an edge. */
export function edgeLine(px: Px, cx: number, baseY: number, hPx: number, c: Col) {
  px.line(cx, baseY, cx, baseY - hPx, c);
}

/** Pointed roof / spire cap sitting on a top face. */
export function cone(px: Px, cx: number, cy: number, hPx: number, w: number, c: Col) {
  const apex = { x: cx, y: cy - hPx };
  px.poly([apex, { x: cx - w / 2, y: cy }, { x: cx, y: cy + TH / 2 }], shade(c, 0.66));
  px.poly([apex, { x: cx + w / 2, y: cy }, { x: cx, y: cy + TH / 2 }], shade(c, 0.9));
  px.line(cx, cy + TH / 2, apex.x, apex.y, shade(c, 1.2));
}

/** A pitched roof over a w×TH footprint. */
export function gable(px: Px, cx: number, cy: number, hPx: number, w: number, c: Col) {
  const peak = cy - hPx;
  px.poly([{ x: cx - w / 2, y: cy }, { x: cx, y: cy - TH / 2 }, { x: cx, y: peak - TH / 2 }, { x: cx - w / 2, y: peak }], shade(c, 0.72));
  px.poly([{ x: cx + w / 2, y: cy }, { x: cx, y: cy - TH / 2 }, { x: cx, y: peak - TH / 2 }, { x: cx + w / 2, y: peak }], shade(c, 0.94));
  px.line(cx, peak - TH / 2, cx - w / 2, peak, shade(c, 1.25));
  px.line(cx, peak - TH / 2, cx + w / 2, peak, shade(c, 1.25));
}

/** Pointed gothic arch opening punched into a wall face. */
export function lancet(px: Px, cx: number, baseY: number, w: number, h: number, c: Col, glass?: Col) {
  const pts: Pt[] = [];
  const half = w / 2;
  pts.push({ x: cx - half, y: baseY });
  pts.push({ x: cx - half, y: baseY - h * 0.55 });
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push({ x: cx - half + w * t, y: baseY - h * 0.55 - Math.sin(t * Math.PI) * h * 0.45 });
  }
  pts.push({ x: cx + half, y: baseY });
  px.poly(pts, c);
  if (glass) {
    px.poly(pts.map(p => ({ x: cx + (p.x - cx) * 0.62, y: baseY - (baseY - p.y) * 0.84 })), glass);
    px.line(cx, baseY - 1, cx, baseY - h * 0.86, shade(c, 0.6));
  }
}

/** Crenellations along the top of a wall. */
export function crenel(px: Px, cx: number, topY: number, w: number, c: Col) {
  for (let i = -1; i <= 1; i++) {
    const x = cx + i * (w / 3);
    px.poly([
      { x: x - w / 9, y: topY }, { x: x + w / 9, y: topY },
      { x: x + w / 9, y: topY - 6 }, { x: x - w / 9, y: topY - 6 },
    ], shade(c, 1.05));
  }
}

export { mix };
