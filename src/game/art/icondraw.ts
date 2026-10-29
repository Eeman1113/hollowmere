// Item icon painters. Free of Phaser imports so the preview script can render
// a contact sheet outside the browser.
// Item icons, drawn procedurally like everything else. Weapons and shields
// reuse the same painters the character uses, so the icon in your pack is
// literally the thing you will be holding.

import { Px, shade, type Col } from './raster';
import { drawShield2D, drawWeapon2D } from './paint';
import { P } from './palette';
import type { ItemDef } from '../content/items';
import { mulberry32, type Rng } from '../core';

export const ICON = 40;
export const iconKey = (id: string) => `icon_${id}`;

// ------------------------------------------------------------- primitives
function plate(px: Px, pts: { x: number; y: number }[], c: Col, trim?: Col) {
  px.poly(pts, shade(c, 0.74));
  px.poly(pts.map(p => ({ x: p.x - 0.8, y: p.y - 1.1 })), c);
  if (trim) for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    px.line(a.x, a.y, b.x, b.y, trim);
  }
}

function rivets(px: Px, c: Col, pts: [number, number][]) {
  for (const [x, y] of pts) px.ellipse(x, y, 1.3, 1.3, c);
}

function flask(px: Px, body: Col, liquid: Col, cork: Col) {
  px.poly([{ x: 15, y: 16 }, { x: 25, y: 16 }, { x: 29, y: 32 }, { x: 11, y: 32 }], shade(body, 0.76));
  px.poly([{ x: 16, y: 17 }, { x: 24, y: 17 }, { x: 27, y: 31 }, { x: 13, y: 31 }], body);
  px.poly([{ x: 15, y: 23 }, { x: 25, y: 23 }, { x: 27, y: 31 }, { x: 13, y: 31 }], liquid);
  px.rect(17, 9, 6, 8, shade(body, 0.86));
  px.rect(16, 6, 8, 4, cork);
  px.ellipse(19, 27, 2, 3, shade(liquid, 1.4), 0.6);
}

function pouchy(px: Px, c: Col, tie: Col) {
  px.ellipse(20, 25, 10, 9, shade(c, 0.78));
  px.ellipse(19, 24, 8, 7, c);
  px.poly([{ x: 15, y: 17 }, { x: 25, y: 17 }, { x: 23, y: 12 }, { x: 17, y: 12 }], shade(c, 0.9));
  px.capsule(14, 15, 26, 15, 1.6, 1.6, tie);
}

function gem(px: Px, c: Col, cx: number, cy: number, r: number) {
  px.poly([{ x: cx, y: cy - r }, { x: cx + r * 0.8, y: cy }, { x: cx, y: cy + r }, { x: cx - r * 0.8, y: cy }], shade(c, 0.7));
  px.poly([{ x: cx, y: cy - r * 0.7 }, { x: cx + r * 0.5, y: cy }, { x: cx, y: cy + r * 0.6 }, { x: cx - r * 0.5, y: cy }], c);
  px.poly([{ x: cx - 1, y: cy - r * 0.5 }, { x: cx + r * 0.2, y: cy - r * 0.1 }, { x: cx - r * 0.3, y: cy + r * 0.1 }], shade(c, 1.5));
}

// ------------------------------------------------------------------ kinds
function helmIcon(px: Px, it: ItemDef) {
  const v = it.helmVis!;
  const m = v.main, t = v.trim;
  switch (v.kind) {
    case 'hood': case 'veil':
      px.ellipse(20, 20, 13, 14, shade(m, 0.76));
      px.ellipse(19, 18, 11, 12, m);
      px.ellipse(20, 23, 7, 7, shade(m, 0.3));
      px.poly([{ x: 8, y: 22 }, { x: 32, y: 22 }, { x: 29, y: 34 }, { x: 11, y: 34 }], shade(m, 0.68));
      if (v.glow) { px.ellipse(17, 23, 1.4, 1.4, v.glow); px.ellipse(23, 23, 1.4, 1.4, v.glow); }
      break;
    case 'tricorn':
      px.ellipse(20, 18, 10, 8, m);
      px.poly([{ x: 4, y: 23 }, { x: 20, y: 11 }, { x: 36, y: 23 }, { x: 20, y: 28 }], shade(m, 0.88));
      px.line(4, 23, 20, 11, t); px.line(36, 23, 20, 11, t);
      break;
    case 'crown':
      for (let k = -2; k <= 2; k++) px.capsule(20 + k * 5, 24, 20 + k * 5, 12 - (k % 2 ? 0 : 4), 2, 1, m);
      px.capsule(8, 25, 32, 25, 2.6, 2.6, m);
      gem(px, t, 20, 25, 3);
      break;
    case 'skull':
      px.ellipse(20, 19, 11, 11, m);
      px.ellipse(16, 19, 3, 3.6, [16, 12, 14]); px.ellipse(24, 19, 3, 3.6, [16, 12, 14]);
      for (let k = -1; k <= 1; k++) px.rect(19 + k * 3, 27, 2, 5, shade(m, 0.85));
      break;
    default: {
      px.ellipse(20, 19, 12, 13, shade(m, 0.76));
      px.ellipse(19, 17, 10, 11, m);
      px.ellipse(16, 13, 4, 3, shade(m, 1.25));
      px.rect(12, 21, 16, 2.4, shade(m, 0.22));
      if (v.kind === 'great') px.rect(19, 15, 2.4, 9, shade(m, 0.22));
      if (v.glow) { px.ellipse(16, 22, 1.3, 1.3, v.glow); px.ellipse(24, 22, 1.3, 1.3, v.glow); }
      px.capsule(9, 28, 31, 28, 2, 2, t);
      if (v.horn) for (const side of [-1, 1]) {
        let x = 20 + side * 10, y = 13, a = side > 0 ? -0.9 : -Math.PI + 0.9;
        for (let k = 0; k < (v.horn ?? 2); k++) {
          const nx = x + Math.cos(a) * (8 - k * 1.6), ny = y + Math.sin(a) * (8 - k * 1.6);
          px.capsule(x, y, nx, ny, 2.2 - k * 0.5, 1.6 - k * 0.4, t);
          x = nx; y = ny; a -= side * 0.6;
        }
      }
      break;
    }
  }
}

function chestIcon(px: Px, it: ItemDef, r: Rng) {
  const v = it.armVis!;
  const m = v.main, t = v.trim;
  const pts = [
    { x: 11 - v.pauldron * 2, y: 10 }, { x: 29 + v.pauldron * 2, y: 10 },
    { x: 31, y: 18 }, { x: 27, y: 32 }, { x: 13, y: 32 }, { x: 9, y: 18 },
  ];
  plate(px, pts, m, t);
  if (v.pauldron > 0.3) {
    px.ellipse(10 - v.pauldron, 12, 5 * v.pauldron + 2, 4 * v.pauldron + 2, shade(m, 1.1));
    px.ellipse(30 + v.pauldron, 12, 5 * v.pauldron + 2, 4 * v.pauldron + 2, shade(m, 1.1));
  }
  if (v.fur) px.capsule(11, 11, 29, 11, 3.2, 3.2, v.fur);
  // surface treatment matches the armour kind
  if (v.kind === 'mail') { for (let y = 14; y < 31; y += 2) for (let x = 11 + ((y / 2) & 1); x < 29; x += 2) px.over(x, y, shade(m, 0.62)); }
  else if (v.kind === 'plate') { for (let y = 15; y < 31; y += 4) px.rect(11, y, 18, 1, shade(m, 0.6)); }
  else if (v.kind === 'leather') { for (let i = 0; i < 14; i++) px.over(12 + (r() * 16) | 0, 13 + (r() * 17) | 0, shade(m, 0.6)); }
  else if (v.kind === 'rag') { for (let i = 0; i < 9; i++) px.rect(12 + (r() * 16) | 0, 28 + (r() * 4) | 0, 2, 3, shade(m, 0.7)); }
  px.capsule(11, 25, 29, 25, 1.6, 1.6, shade(t, 0.9));
  if (v.studs) rivets(px, t, [[15, 15], [20, 14], [25, 15]]);
}

/** A pair of bracers ending in gloved hands — short, wide, fingers splayed. */
function armsIcon(px: Px, it: ItemDef) {
  const v = it.armVis!;
  for (const side of [-1, 1]) {
    const x = 20 + side * 8;
    px.poly([{ x: x - 6, y: 9 }, { x: x + 6, y: 9 }, { x: x + 5, y: 22 }, { x: x - 5, y: 22 }], shade(v.main, 0.74));
    px.poly([{ x: x - 5, y: 10 }, { x: x + 5, y: 10 }, { x: x + 4, y: 21 }, { x: x - 4, y: 21 }], v.main);
    px.capsule(x - 6, 19, x + 6, 19, 1.5, 1.5, v.trim);
    // gloved hand: palm plus three stubby fingers
    px.ellipse(x, 26, 5.4, 5, shade(v.main, 1.05));
    for (let k = -1; k <= 1; k++) px.capsule(x + k * 3, 29, x + k * 3.6, 33, 1.6, 1.3, shade(v.main, 0.92));
  }
}

/** A pair of greaves ending in boots — tall, narrow, with a forward toe. */
function legsIcon(px: Px, it: ItemDef) {
  const v = it.armVis!;
  for (const side of [-1, 1]) {
    const x = 20 + side * 7;
    px.poly([{ x: x - 4.5, y: 5 }, { x: x + 4.5, y: 5 }, { x: x + 3.5, y: 27 }, { x: x - 3.5, y: 27 }], shade(v.main, 0.74));
    px.poly([{ x: x - 3.5, y: 6 }, { x: x + 3.5, y: 6 }, { x: x + 2.6, y: 26 }, { x: x - 2.6, y: 26 }], v.main);
    px.capsule(x - 4.5, 15, x + 4.5, 15, 1.4, 1.4, v.trim);
    // knee cop
    px.ellipse(x, 13, 4.2, 3.4, shade(v.main, 1.12));
    // boot with a toe pointing outward
    px.poly([{ x: x - 4, y: 27 }, { x: x + 4, y: 27 }, { x: x + (side > 0 ? 7 : 4), y: 34 }, { x: x - (side > 0 ? 4 : 7), y: 34 }], shade(v.main, 0.58));
  }
}

function consumableIcon(px: Px, it: ItemDef, r: Rng) {
  switch (it.id) {
    case 'lantern_oil': flask(px, [168, 148, 110], P.flame, P.woodDark); px.ellipse(20, 27, 5, 5, P.flameLit, 0.4); break;
    case 'bloodwort_tonic': flask(px, [120, 130, 140], P.crimson, P.woodDark); break;
    case 'ash_resin': flask(px, [110, 104, 98], [86, 76, 62], P.ebony); break;
    case 'bandage':
      px.ellipse(20, 21, 11, 10, shade(P.linen, 0.8));
      px.ellipse(19, 20, 9, 8, P.linen);
      for (let k = -1; k <= 1; k++) px.capsule(10, 20 + k * 6, 30, 18 + k * 6, 2, 2, shade(P.linen, 0.92));
      px.capsule(28, 14, 34, 11, 2, 1.4, shade(P.linen, 1.1));
      break;
    case 'whetstone':
      px.poly([{ x: 8, y: 25 }, { x: 30, y: 13 }, { x: 33, y: 19 }, { x: 11, y: 31 }], shade(P.stone, 0.8));
      px.poly([{ x: 10, y: 25 }, { x: 29, y: 15 }, { x: 31, y: 18 }, { x: 12, y: 28 }], P.stoneLit);
      px.ellipse(22, 20, 4, 2, [60, 52, 40], 0.5);
      break;
    case 'throwing_knife':
      for (const [ox, oy] of [[-5, 3], [3, -3]]) {
        px.capsule(12 + ox, 28 + oy, 20 + ox, 20 + oy, 2, 1.6, P.woodDark);
        px.poly([{ x: 19 + ox, y: 21 + oy }, { x: 22 + ox, y: 18 + oy }, { x: 31 + ox, y: 9 + oy }, { x: 25 + ox, y: 15 + oy }], P.steel);
        px.line(22 + ox, 18 + oy, 31 + ox, 9 + oy, P.steelLit);
      }
      break;
    case 'firebomb':
      px.ellipse(20, 24, 10, 9, shade([94, 70, 48], 0.8));
      px.ellipse(19, 23, 8, 7, [94, 70, 48]);
      px.rect(17, 12, 6, 6, shade([94, 70, 48], 0.9));
      px.capsule(20, 12, 26, 6, 1.4, 0.6, P.linen);
      px.ellipse(27, 5, 2.6, 3.4, P.flame);
      px.ellipse(27, 4, 1.4, 2, P.flameLit);
      break;
    default: flask(px, [130, 130, 140], P.moss, P.woodDark); break;
  }
  void r;
}

function materialIcon(px: Px, it: ItemDef, r: Rng) {
  switch (it.id) {
    case 'emberglass':
      for (let i = 0; i < 3; i++) {
        const x = 13 + i * 7, h = 10 + r() * 8;
        px.poly([{ x: x - 4, y: 30 }, { x, y: 30 - h }, { x: x + 4, y: 30 }], shade(P.ember, 0.6));
        px.poly([{ x: x - 2, y: 29 }, { x, y: 32 - h }, { x: x + 1, y: 29 }], P.flame);
      }
      px.ellipse(20, 26, 13, 8, P.ember, 0.12);
      break;
    case 'beast_bone':
      px.capsule(10, 28, 30, 13, 3, 3, shade(P.bone, 0.82));
      px.capsule(10, 27, 30, 12, 2, 2, P.bone);
      px.ellipse(10, 28, 4, 3.4, P.bone); px.ellipse(30, 13, 4, 3.4, P.bone);
      px.ellipse(8, 25, 2.6, 2.4, shade(P.bone, 1.1)); px.ellipse(32, 16, 2.6, 2.4, shade(P.bone, 1.1));
      break;
    case 'pale_ash':
      px.ellipse(20, 28, 13, 5, shade(P.ash, 0.8));
      px.ellipse(19, 25, 10, 4.6, P.ash);
      for (let i = 0; i < 10; i++) px.ellipse(10 + r() * 20, 14 + r() * 10, 1.2, 1.2, P.pale, 0.6);
      break;
    case 'hollow_marrow':
      px.capsule(13, 28, 27, 14, 4, 4, shade(P.hollowDim, 0.8));
      px.capsule(13, 27, 27, 13, 2.4, 2.4, P.hollow);
      px.ellipse(20, 21, 14, 14, P.hollow, 0.14);
      break;
    case 'rune_shard':
      gem(px, P.goldLit, 20, 21, 10);
      px.ellipse(20, 21, 15, 15, P.gold, 0.14);
      break;
    default:
      px.ellipse(20, 24, 10, 8, shade(P.stone, 0.85));
      px.ellipse(19, 22, 8, 6, P.stoneLit);
      break;
  }
}

function talismanIcon(px: Px, it: ItemDef) {
  const tone: Col = it.id.includes('ember') ? P.ember : it.id.includes('lamp') ? P.flame
    : it.id.includes('breath') ? P.frost : it.id.includes('shroud') ? P.moonPale
    : it.id.includes('feather') ? P.ink2 : it.id.includes('coin') ? P.gold : P.bronze;
  px.capsule(10, 12, 30, 12, 1.4, 1.4, P.ebony);
  px.capsule(10, 12, 20, 22, 1.2, 1.2, P.ebony);
  px.capsule(30, 12, 20, 22, 1.2, 1.2, P.ebony);
  if (it.id.includes('feather')) {
    px.capsule(20, 32, 22, 14, 1.4, 0.6, shade(tone, 1.6));
    for (let k = 0; k < 7; k++) px.capsule(21 - k * 0.2, 30 - k * 2.2, 15 - k * 0.3, 27 - k * 2.4, 1.6, 0.4, shade(tone, 1.3 + k * 0.05));
  } else if (it.id.includes('coin')) {
    px.ellipse(20, 26, 8, 8, shade(tone, 0.72));
    px.ellipse(19, 25, 6.4, 6.4, tone);
    px.ellipse(19, 25, 2.6, 2.6, shade(tone, 0.6));
  } else {
    gem(px, tone, 20, 26, 8);
    px.ellipse(20, 26, 12, 12, tone, 0.12);
  }
}

function keyIcon(px: Px, it: ItemDef) {
  if (it.id.startsWith('rem_')) {
    px.ellipse(20, 20, 11, 11, shade(P.hollowDim, 0.7));
    px.ellipse(20, 20, 8, 8, P.hollowDim);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      px.capsule(20, 20, 20 + Math.cos(a) * 13, 20 + Math.sin(a) * 13, 1.6, 0.5, P.hollow);
    }
    px.ellipse(20, 20, 4, 4, P.moonPale);
    px.ellipse(20, 20, 17, 17, P.hollow, 0.16);
    return;
  }
  px.ellipse(14, 14, 6, 6, shade(P.bronze, 0.76));
  px.ellipse(14, 14, 3, 3, [0, 0, 0], 0);
  px.capsule(17, 17, 29, 29, 2, 2, P.bronze);
  px.capsule(27, 27, 31, 23, 1.8, 1.8, P.bronzeLit);
  px.capsule(24, 30, 28, 34, 1.6, 1.6, P.bronzeLit);
}

function tradeIcon(px: Px, it: ItemDef, r: Rng) {
  switch (it.id) {
    case 'wolf_pelt': case 'beast_hide':
      px.poly([{ x: 9, y: 14 }, { x: 20, y: 9 }, { x: 31, y: 14 }, { x: 28, y: 31 }, { x: 12, y: 31 }], shade(it.id === 'wolf_pelt' ? [104, 104, 112] : P.hide, 0.78));
      px.poly([{ x: 12, y: 15 }, { x: 20, y: 12 }, { x: 28, y: 15 }, { x: 26, y: 29 }, { x: 14, y: 29 }], it.id === 'wolf_pelt' ? [104, 104, 112] : P.hide);
      for (let i = 0; i < 12; i++) px.over(13 + (r() * 14) | 0, 15 + (r() * 13) | 0, shade(P.ink2, 1.6));
      break;
    case 'silver_reliquary':
      px.poly([{ x: 11, y: 30 }, { x: 11, y: 16 }, { x: 20, y: 9 }, { x: 29, y: 16 }, { x: 29, y: 30 }], shade(P.steel, 0.74));
      px.poly([{ x: 14, y: 29 }, { x: 14, y: 18 }, { x: 20, y: 13 }, { x: 26, y: 18 }, { x: 26, y: 29 }], P.steel);
      gem(px, P.crimsonLit, 20, 22, 4);
      break;
    case 'choir_bell':
      px.poly([{ x: 12, y: 29 }, { x: 15, y: 12 }, { x: 25, y: 12 }, { x: 28, y: 29 }], shade(P.bronze, 0.78));
      px.poly([{ x: 15, y: 28 }, { x: 17, y: 14 }, { x: 23, y: 14 }, { x: 25, y: 28 }], P.bronze);
      px.ellipse(20, 29, 9, 3, shade(P.bronze, 1.2));
      px.capsule(20, 9, 20, 13, 1.4, 1.4, P.tarnish);
      px.ellipse(20, 32, 2.2, 2.2, shade(P.bronze, 0.5));
      break;
    case 'grave_wax':
      px.ellipse(20, 27, 11, 7, shade([214, 206, 178], 0.78));
      px.ellipse(19, 25, 9, 6, [214, 206, 178]);
      px.capsule(20, 24, 20, 13, 2.4, 2, [226, 220, 194]);
      px.ellipse(20, 11, 2, 3, P.flame);
      break;
    case 'drowned_coin':
      for (const [x, y] of [[15, 27], [24, 25], [20, 20]] as const) {
        px.ellipse(x, y, 7, 6.6, shade(P.tarnish, 0.74));
        px.ellipse(x - 1, y - 1, 5.6, 5.2, P.tarnish);
        px.ellipse(x - 1, y - 1, 2.2, 2.2, shade(P.tarnish, 0.62));
      }
      break;
    case 'hollow_tooth':
      for (const [x, y, s2] of [[14, 26, 1], [26, 24, 0.85], [20, 16, 0.7]] as const) {
        px.poly([{ x: x - 4 * s2, y: y - 7 * s2 }, { x: x + 4 * s2, y: y - 7 * s2 }, { x: x + 1.5 * s2, y: y + 7 * s2 }, { x: x - 1.5 * s2, y: y + 7 * s2 }], shade(P.bone, 0.78));
        px.poly([{ x: x - 2.6 * s2, y: y - 6 * s2 }, { x: x + 2.6 * s2, y: y - 6 * s2 }, { x: x + 1 * s2, y: y + 5 * s2 }, { x: x - 1 * s2, y: y + 5 * s2 }], P.bone);
      }
      px.ellipse(20, 22, 15, 14, P.hollow, 0.1);
      break;
    case 'fen_salt':
      pouchy(px, [150, 142, 120], P.woodDark);
      for (let i = 0; i < 16; i++) {
        const a = r() * Math.PI * 2, d = r() * 7;
        px.set(20 + Math.cos(a) * d, 23 + Math.sin(a) * d * 0.8, [228, 226, 214]);
      }
      px.poly([{ x: 15, y: 13 }, { x: 25, y: 13 }, { x: 23, y: 9 }, { x: 17, y: 9 }], [222, 218, 202]);
      break;
    case 'pilgrim_badge':
      px.ellipse(20, 21, 12, 12, shade(P.ash, 0.72));
      px.ellipse(19, 20, 10, 10, P.ash);
      px.capsule(20, 15, 20, 26, 2.2, 2.2, shade(P.ash, 0.5));
      px.poly([{ x: 16, y: 16 }, { x: 24, y: 16 }, { x: 22, y: 26 }, { x: 18, y: 26 }], shade(P.flame, 0.8));
      px.ellipse(20, 20, 2.4, 3.2, P.flameLit);
      px.ellipse(20, 12, 2.2, 2.2, shade(P.ash, 0.6));
      break;
    default:
      pouchy(px, P.leather, P.woodDark);
      break;
  }
}

// ------------------------------------------------------------------ build
export function drawIcon(it: ItemDef): Px {
  const px = new Px(ICON, ICON);
  const r = mulberry32(it.id.length * 7717 + it.id.charCodeAt(0) * 131);
  switch (it.kind) {
    case 'weapon':
      if (it.vis) {
        // Lie the weapon corner to corner and thicken it: at 40px a thin blade
        // would be entirely consumed by the outline pass.
        const hx = 7, hy = 34, span = 24;
        drawWeapon2D(px, { ...it.vis, width: (it.vis.width ?? 1) * 1.55 }, hx, hy, hx + span, hy - span);
      }
      break;
    case 'offhand': {
      const v = it.shieldVis!;
      drawShield2D(px, v, 20, 21, v.shape === 'tower' ? 9 : v.shape === 'buckler' ? 9 : 12, v.shape === 'tower' ? 26 : v.shape === 'kite' ? 26 : 22);
      break;
    }
    case 'helm': helmIcon(px, it); break;
    case 'chest': chestIcon(px, it, r); break;
    case 'arms': armsIcon(px, it); break;
    case 'legs': legsIcon(px, it); break;
    case 'talisman': talismanIcon(px, it); break;
    case 'consumable': consumableIcon(px, it, r); break;
    case 'material': materialIcon(px, it, r); break;
    case 'trade': tradeIcon(px, it, r); break;
    case 'key': keyIcon(px, it); break;
    default: pouchy(px, P.leather, P.woodDark); break;
  }
  px.topLight(0.2, 0.22);
  px.outline([10, 8, 12], 0.9, 40);
  return px;
}

