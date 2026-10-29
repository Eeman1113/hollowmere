// Ground tile atlas. Four variants per tile type, drawn as iso diamonds with
// per-type surface treatment so terrain never reads as flat colour fills.

import * as Phaser from 'phaser';
import { Px, shade, mix, type Col } from './raster';
import { diamond, TW, TH } from './iso';
import { P } from './palette';
import { T } from '../world/types';
import { mulberry32 } from '../core';

export const TILE_W = TW + 2;
export const TILE_H = TH + 10; // room for the lip under each tile

interface TileStyle { a: Col; b: Col; style: 'speckle' | 'tuft' | 'crack' | 'cobble' | 'plank' | 'flag' | 'ripple' | 'ash' | 'bone' | 'smooth'; lip: Col }

const S = (a: Col, b: Col, style: TileStyle['style'], lip?: Col): TileStyle => ({ a, b, style, lip: lip ?? shade(a, 0.5) });

export const TILE_STYLE: Record<number, TileStyle> = {
  [T.VOID]: S(P.ink, P.ink2, 'smooth'),
  [T.GRASS]: S([62, 82, 56], [48, 66, 46], 'tuft'),
  [T.GRASS_DRY]: S([102, 98, 66], [84, 80, 54], 'tuft'),
  [T.MOSS]: S([56, 76, 54], [42, 60, 44], 'tuft'),
  [T.FERN]: S([58, 84, 62], [44, 66, 50], 'tuft'),
  [T.DIRT]: S([82, 68, 52], [66, 54, 42], 'speckle'),
  [T.MUD]: S([62, 52, 42], [48, 40, 33], 'speckle'),
  [T.BOG]: S([50, 60, 50], [38, 48, 40], 'ripple'),
  [T.SAND]: S([124, 114, 88], [106, 96, 74], 'speckle'),
  [T.ASH]: S([96, 90, 86], [78, 74, 70], 'ash'),
  [T.CINDER]: S([78, 60, 52], [60, 44, 38], 'ash'),
  [T.STONE]: S([94, 94, 102], [74, 74, 82], 'crack'),
  [T.COBBLE]: S([104, 102, 108], [82, 80, 88], 'cobble'),
  [T.FLAG]: S([118, 116, 122], [96, 94, 100], 'flag'),
  [T.MARBLE]: S([158, 156, 162], [132, 130, 138], 'flag'),
  [T.PLANK]: S([96, 72, 48], [78, 58, 38], 'plank'),
  [T.GRAVE_DIRT]: S([72, 66, 58], [56, 52, 46], 'bone'),
  [T.ROAD]: S([110, 96, 76], [92, 80, 62], 'speckle'),
  [T.SNOW]: S([194, 200, 212], [168, 176, 192], 'smooth'),
  [T.ROT]: S([78, 92, 48], [60, 72, 38], 'tuft'),
  [T.BLOODSTONE]: S([94, 46, 46], [72, 34, 36], 'crack'),
  [T.WATER]: S([46, 70, 94], [34, 54, 76], 'ripple'),
  [T.DEEP]: S([24, 38, 58], [16, 26, 42], 'ripple'),
};

function drawTile(st: TileStyle, variant: number): Px {
  const px = new Px(TILE_W, TILE_H);
  const cx = TILE_W / 2, cy = TH / 2 + 1;
  const r = mulberry32(variant * 7919 + 13);
  const base = mix(st.a, st.b, r() * 0.5);

  // the lip: a sliver of darker ground under the front edges so tiles read as solid
  px.poly([
    { x: cx - TW / 2, y: cy }, { x: cx, y: cy + TH / 2 }, { x: cx + TW / 2, y: cy },
    { x: cx + TW / 2, y: cy + 5 }, { x: cx, y: cy + TH / 2 + 5 }, { x: cx - TW / 2, y: cy + 5 },
  ], st.lip);

  px.poly(diamond(cx, cy), base);

  const inside = (x: number, y: number) => {
    const u = Math.abs(x - cx) / (TW / 2), v = Math.abs(y - cy) / (TH / 2);
    return u + v <= 0.96;
  };
  const dot = (x: number, y: number, c: Col, a = 1) => { if (inside(x, y)) px.blend(x, y, c, a); };

  switch (st.style) {
    case 'speckle': case 'ash': {
      const n = st.style === 'ash' ? 150 : 110;
      for (let i = 0; i < n; i++) {
        const x = cx + (r() - 0.5) * TW, y = cy + (r() - 0.5) * TH;
        dot(x, y, shade(base, r() < 0.5 ? 0.82 : 1.18), 0.7);
      }
      break;
    }
    case 'tuft': {
      for (let i = 0; i < 70; i++) {
        const x = cx + (r() - 0.5) * TW, y = cy + (r() - 0.5) * TH;
        dot(x, y, shade(base, 0.86), 0.6);
      }
      for (let i = 0; i < 9; i++) {
        const x = cx + (r() - 0.5) * TW * 0.8, y = cy + (r() - 0.5) * TH * 0.8;
        const c = shade(mix(base, [120, 140, 90], 0.35), 1.1);
        for (let k = 0; k < 3; k++) dot(x + k - 1, y - (k === 1 ? 2 : 1), c, 0.85);
      }
      break;
    }
    case 'crack': {
      for (let i = 0; i < 80; i++) dot(cx + (r() - 0.5) * TW, cy + (r() - 0.5) * TH, shade(base, 0.88), 0.6);
      for (let k = 0; k < 2; k++) {
        let x = cx + (r() - 0.5) * TW * 0.6, y = cy + (r() - 0.5) * TH * 0.6;
        for (let i = 0; i < 12; i++) { dot(x, y, shade(base, 0.62), 0.8); x += (r() - 0.5) * 4; y += (r() - 0.5) * 2.2; }
      }
      break;
    }
    case 'cobble': {
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
        const x = cx + i * 9 + (j & 1 ? 4 : 0), y = cy + j * 4.5;
        if (!inside(x, y)) continue;
        const c = shade(base, 0.86 + r() * 0.3);
        px.ellipse(x, y, 3.6, 2.0, c);
        px.ellipse(x - 0.4, y - 0.5, 2.6, 1.3, shade(c, 1.1));
      }
      break;
    }
    case 'flag': {
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
        const x = cx + (i - j) * 16, y = cy + (i + j) * 8;
        if (!inside(x, y)) continue;
        px.poly(diamond(x, y, 15, 7.5), shade(base, 0.9 + r() * 0.24));
      }
      break;
    }
    case 'plank': {
      for (let k = -2; k <= 2; k++) {
        const c = shade(base, 0.88 + ((k + 2) % 3) * 0.1);
        for (let t = -32; t <= 32; t++) {
          const x = cx + t, y = cy + t * 0.5 + k * 6;
          for (let q = 0; q < 5; q++) dot(x, y + q, c, 1);
        }
      }
      break;
    }
    case 'ripple': {
      for (let k = 0; k < 4; k++) {
        const oy = cy + (k - 1.5) * 6 + r() * 2;
        for (let t = -30; t <= 30; t++) {
          const x = cx + t, y = oy + Math.sin(t * 0.32 + k) * 1.6 + t * 0.0;
          dot(x, y, shade(base, 1.28), 0.5);
        }
      }
      break;
    }
    case 'bone': {
      for (let i = 0; i < 90; i++) dot(cx + (r() - 0.5) * TW, cy + (r() - 0.5) * TH, shade(base, r() < 0.5 ? 0.85 : 1.12), 0.6);
      if (variant === 2) for (let k = 0; k < 4; k++) dot(cx - 6 + k * 3, cy + 2, P.bone, 0.8);
      break;
    }
    case 'smooth': {
      for (let i = 0; i < 40; i++) dot(cx + (r() - 0.5) * TW, cy + (r() - 0.5) * TH, shade(base, 1.06), 0.4);
      break;
    }
  }
  return px;
}

export const tileKey = (t: number, v: number) => `t${t}_${v}`;

export function makeTileAtlas(scene: Phaser.Scene) {
  const types = Object.keys(TILE_STYLE).map(Number);
  const frames: { name: string; buf: Px }[] = [];
  for (const t of types) for (let v = 0; v < 4; v++) frames.push({ name: tileKey(t, v), buf: drawTile(TILE_STYLE[t], v + t * 4) });
  const cols = 8;
  const rows = Math.ceil(frames.length / cols);
  if (scene.textures.exists('tiles')) scene.textures.remove('tiles');
  const tex = scene.textures.createCanvas('tiles', cols * TILE_W, rows * TILE_H);
  if (!tex) return;
  const ctx = tex.getContext();
  frames.forEach((f, i) => {
    const x = (i % cols) * TILE_W, y = Math.floor(i / cols) * TILE_H;
    const img = ctx.createImageData(TILE_W, TILE_H);
    img.data.set(f.buf.d);
    ctx.putImageData(img, x, y);
    tex.add(f.name, 0, x, y, TILE_W, TILE_H);
  });
  tex.refresh();
}
