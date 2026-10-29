#!/usr/bin/env node
// sprite2code — turn an AI-generated sprite sheet image into TypeScript pixel data.
//
// The image is only an intermediate: the output .ts file holds every pixel as
// palette-indexed strings, so the game ships with zero image assets.
//
// Usage:
//   node scripts/sprite2code.mjs <image> --name wolf --layout "side:4" --h 32 \
//        [--colors 32] [--tol 60] [--out src/game/sprites/wolf.ts] [--preview /tmp/wolf.png]
//
// --layout  rows of the sheet, top to bottom: "anim:count,anim:count".
//           Sprites are auto-detected (background keyed out, blobs found,
//           grouped into rows by y and sorted by x). Use "anim:count@row" to
//           pull a specific detected row, e.g. "front:4@0,side:4@2".
// --h       target frame height in game pixels (largest sprite maps to this).
// --colors  palette size after quantization (max 63).
// --tol     background colour tolerance (RGB distance).
// --minarea drop blobs smaller than this fraction of the largest blob (default 0.08).
// --gap     merge blobs whose boxes are closer than this many source px (default 8).
// --grid    CxR: cut sheet into an even grid (frames touching/overlapping).
// --unmix   k: strip magenta tint from translucent parts (with --hue threshold).
// --single  treat the whole opaque area as one sprite (props / single images).

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+/';

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith('--')) {
      const key = k.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) a[key] = true;
      else { a[key] = next; i++; }
    } else a._.push(k);
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
const input = args._[0];
if (!input) { console.error('usage: sprite2code <image> --name x --layout "anim:n" --h 48'); process.exit(1); }
const name = args.name || path.basename(input).replace(/\.[^.]+$/, '');
const layoutSpec = String(args.layout || 'idle:1');
const targetH = Number(args.h || 48);
const nColors = Math.min(63, Number(args.colors || 32));
const tol = Number(args.tol || 60);
const minAreaFrac = Number(args.minarea || 0.08);
const gap = Number(args.gap || 8);
const out = args.out || `src/game/sprites/${name}.ts`;

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const px = (x, y) => (y * W + x) * 4;

// ---------- background keying ----------
function dist(r1, g1, b1, r2, g2, b2) { return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2); }
const counts = new Map();
for (let x = 0; x < W; x++) for (const y of [0, 1, H - 2, H - 1]) addSample(x, y);
for (let y = 0; y < H; y++) for (const x of [0, 1, W - 2, W - 1]) addSample(x, y);
function addSample(x, y) {
  const i = px(x, y);
  if (data[i + 3] < 128) return;
  const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
  counts.set(key, (counts.get(key) || 0) + 1);
}
let bg = null;
if (counts.size) {
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  bg = [((best >> 10) & 31) * 8 + 4, ((best >> 5) & 31) * 8 + 4, (best & 31) * 8 + 4];
}
const opaque = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = px(x, y);
  opaque[y * W + x] = data[i + 3] >= 128 ? 1 : 0;
}
if (bg) {
  // flood fill from the border with full tolerance (handles soft gradients / jpeg noise)
  const stack = [];
  const seen = new Uint8Array(W * H);
  const isBg = (x, y, t) => { const i = px(x, y); return dist(data[i], data[i + 1], data[i + 2], bg[0], bg[1], bg[2]) < t; };
  for (let x = 0; x < W; x++) { stack.push(x, 0, x, H - 1); }
  for (let y = 0; y < H; y++) { stack.push(0, y, W - 1, y); }
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    const j = y * W + x;
    if (seen[j]) continue;
    seen[j] = 1;
    if (!opaque[j] || isBg(x, y, tol)) {
      opaque[j] = 0;
      if (x > 0) stack.push(x - 1, y);
      if (x < W - 1) stack.push(x + 1, y);
      if (y > 0) stack.push(x, y - 1);
      if (y < H - 1) stack.push(x, y + 1);
    }
  }
  // enclosed holes (between legs, under arms) — stricter tolerance
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (opaque[y * W + x] && isBg(x, y, tol * 0.6)) opaque[y * W + x] = 0;
  // de-fringe: peel edge pixels that are blended with the background colour
  // (anti-aliased magenta halos). Edge = opaque pixel touching a transparent one.
  const fringeTol = Number(args.fringe ?? 2.6) * tol;
  const hueTol = Number(args.hue ?? 60); // --hue: lower = peel more bg-tinted edge pixels
  const tinted = (i) => {
    // pixel shifted towards bg hue: for magenta bg, r & b well above g
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const br = bg[0], bgG = bg[1], bb = bg[2];
    const dot = (r - g) * (br - bgG) + (b - g) * (bb - bgG);
    return dot > 0 && Math.min(r, b) - g > hueTol;
  };
  // strongly bg-hued pixels anywhere (enclosed pockets with AA edges)
  if (bg[0] > 200 && bg[2] > 200 && bg[1] < 60) {
    for (let j = 0; j < W * H; j++) {
      if (!opaque[j]) continue;
      const i = j * 4, r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 140 && b > 140 && Math.min(r, b) - g > 90) opaque[j] = 0;
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    const cur = opaque.slice();
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const j = y * W + x;
      if (!cur[j]) continue;
      if (cur[j - 1] && cur[j + 1] && cur[j - W] && cur[j + W]) continue;
      const i = j * 4;
      if (isBg(x, y, fringeTol) || tinted(i)) opaque[j] = 0;
    }
  }
}
// --unmix: for translucent parts drawn over a magenta bg (ghost wisps etc.), strip the
// magenta tint from remaining opaque pixels (pull r/b back toward g).
if (args.unmix && bg && bg[0] > 200 && bg[2] > 200 && bg[1] < 60) {
  const k = Number(args.unmix === true ? 0.25 : args.unmix);
  const hueT = Number(args.hue ?? 30);
  for (let j = 0; j < W * H; j++) {
    if (!opaque[j]) continue;
    const i = j * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    const ex = Math.min(r, b) - g;
    if (ex <= hueT) continue;
    data[i] = Math.round(g + (r - g) * k); data[i + 2] = Math.round(g + (b - g) * k);
  }
}
// light erosion of 1px halos: drop opaque pixels with <=2 opaque neighbours
{
  const copy = opaque.slice();
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (!copy[y * W + x]) continue;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && copy[(y + dy) * W + x + dx]) n++;
    if (n <= 2) opaque[y * W + x] = 0;
  }
}

// ---------- blob detection ----------
const label = new Int32Array(W * H).fill(-1);
let blobs = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const j = y * W + x;
  if (!opaque[j] || label[j] >= 0) continue;
  const b = { x0: x, y0: y, x1: x, y1: y, area: 0 };
  const id = blobs.length;
  const st = [j];
  label[j] = id;
  while (st.length) {
    const k = st.pop();
    const kx = k % W, ky = (k - kx) / W;
    b.area++;
    if (kx < b.x0) b.x0 = kx; if (kx > b.x1) b.x1 = kx;
    if (ky < b.y0) b.y0 = ky; if (ky > b.y1) b.y1 = ky;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = kx + dx, ny = ky + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nj = ny * W + nx;
      if (opaque[nj] && label[nj] < 0) { label[nj] = id; st.push(nj); }
    }
  }
  blobs.push(b);
}
if (args.single) {
  blobs = [blobs.reduce((m, b) => ({ x0: Math.min(m.x0, b.x0), y0: Math.min(m.y0, b.y0), x1: Math.max(m.x1, b.x1), y1: Math.max(m.y1, b.y1), area: m.area + b.area }))];
} else {
  // merge nearby blobs (detached weapons, hair strands, shadows)
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < blobs.length; i++) for (let k = i + 1; k < blobs.length; k++) {
      const a = blobs[i], b = blobs[k];
      if (a.x0 - gap <= b.x1 && b.x0 - gap <= a.x1 && a.y0 - gap <= b.y1 && b.y0 - gap <= a.y1) {
        blobs[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), area: a.area + b.area };
        blobs.splice(k, 1);
        merged = true;
        break outer;
      }
    }
  }
  const maxArea = Math.max(...blobs.map(b => b.area));
  blobs = blobs.filter(b => b.area >= maxArea * minAreaFrac);
}

// group into rows
blobs.sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1));
const rows = [];
for (const b of blobs) {
  const cy = (b.y0 + b.y1) / 2;
  const row = rows.find(r => Math.abs(r.cy - cy) < (r.h + (b.y1 - b.y0)) * 0.3);
  if (row) { row.items.push(b); row.cy = (row.cy * (row.items.length - 1) + cy) / row.items.length; }
  else rows.push({ cy, h: b.y1 - b.y0, items: [b] });
}
rows.sort((a, b) => a.cy - b.cy);
rows.forEach(r => r.items.sort((a, b) => a.x0 - b.x0));
// --grid CxR: ignore blob grouping; cut the sheet into an even C×R grid and take the
// bbox of the significant connected components inside each cell (for sheets where
// frames touch/overlap, e.g. long weapons).
if (args.grid) {
  const [gc, gr] = String(args.grid).split('x').map(Number);
  rows.length = 0;
  for (let r = 0; r < gr; r++) {
    const items = [];
    const cy0 = Math.floor(r * H / gr), cy1 = Math.floor((r + 1) * H / gr) - 1;
    for (let c = 0; c < gc; c++) {
      const cx0 = Math.floor(c * W / gc), cx1 = Math.floor((c + 1) * W / gc) - 1;
      const areas = new Map();
      for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) {
        const j = y * W + x; if (!opaque[j]) continue;
        areas.set(label[j], (areas.get(label[j]) || 0) + 1);
      }
      if (!areas.size) continue;
      const mx = Math.max(...areas.values());
      const keep = new Set([...areas].filter(([, a]) => a >= mx * 0.05).map(([l]) => l));
      const b = { x0: cx1, y0: cy1, x1: cx0, y1: cy0, area: 0 };
      for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) {
        const j = y * W + x; if (!opaque[j] || !keep.has(label[j])) continue;
        if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y; b.area++;
      }
      items.push(b);
    }
    rows.push({ cy: (cy0 + cy1) / 2, h: cy1 - cy0, items });
  }
}
console.error(`[${name}] ${W}x${H}, bg=${bg ? bg.join(',') : 'alpha'}, detected rows: ${rows.map(r => r.items.length).join(' | ')}`);

// layout → frames
const layout = layoutSpec.split(',').map((s, idx) => {
  const m = s.trim().match(/^([\w-]+):(\d+)(?:@(\d+))?$/);
  if (!m) throw new Error('bad layout entry ' + s);
  return { anim: m[1], count: Number(m[2]), row: m[3] !== undefined ? Number(m[3]) : idx };
});
const picked = {};
for (const L of layout) {
  const row = rows[L.row];
  if (!row) { console.error(`  ! row ${L.row} missing for ${L.anim}`); continue; }
  if (row.items.length !== L.count) console.error(`  ! row ${L.row} has ${row.items.length} sprites, layout wants ${L.count} (${L.anim})`);
  picked[L.anim] = row.items.slice(0, L.count);
}
const all = Object.values(picked).flat();
if (!all.length) { console.error('no sprites found'); process.exit(2); }
const maxBh = Math.max(...all.map(b => b.y1 - b.y0 + 1));
const maxBw = Math.max(...all.map(b => b.x1 - b.x0 + 1));
const scale = targetH / maxBh;
const fw = Math.max(1, Math.ceil(maxBw * scale));
const fh = targetH;

// ---------- downscale (alpha-weighted box filter) ----------
function sampleFrame(b) {
  const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
  const tw = Math.max(1, Math.round(bw * scale)), th = Math.max(1, Math.round(bh * scale));
  const offX = Math.floor((fw - tw) / 2), offY = fh - th;
  const outPx = new Array(fw * fh).fill(null);
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
    const sx0 = b.x0 + (tx / tw) * bw, sx1 = b.x0 + ((tx + 1) / tw) * bw;
    const sy0 = b.y0 + (ty / th) * bh, sy1 = b.y0 + ((ty + 1) / th) * bh;
    let r = 0, g = 0, bl = 0, cov = 0, tot = 0;
    for (let sy = Math.floor(sy0); sy < Math.ceil(sy1); sy++) for (let sx = Math.floor(sx0); sx < Math.ceil(sx1); sx++) {
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      tot++;
      const j = sy * W + sx;
      if (!opaque[j]) continue;
      const i = j * 4;
      r += data[i]; g += data[i + 1]; bl += data[i + 2]; cov++;
    }
    if (tot && cov / tot >= 0.45) outPx[(ty + offY) * fw + tx + offX] = [r / cov, g / cov, bl / cov];
  }
  return outPx;
}
const frames = {};
for (const [anim, list] of Object.entries(picked)) frames[anim] = list.map(sampleFrame);

// ---------- median-cut quantization ----------
const pool = [];
for (const list of Object.values(frames)) for (const f of list) for (const p of f) if (p) pool.push(p);
function medianCut(pts, k) {
  let boxes = [pts];
  while (boxes.length < k) {
    let bi = -1, bestRange = -1, bestCh = 0;
    boxes.forEach((bx, i) => {
      if (bx.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let mn = 255, mx = 0;
        for (const p of bx) { if (p[c] < mn) mn = p[c]; if (p[c] > mx) mx = p[c]; }
        if (mx - mn > bestRange) { bestRange = mx - mn; bi = i; bestCh = c; }
      }
    });
    if (bi < 0 || bestRange < 4) break;
    const bx = boxes[bi].sort((a, b) => a[bestCh] - b[bestCh]);
    const mid = bx.length >> 1;
    boxes.splice(bi, 1, bx.slice(0, mid), bx.slice(mid));
  }
  return boxes.map(bx => {
    const s = [0, 0, 0];
    for (const p of bx) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; }
    return s.map(v => Math.round(v / bx.length));
  });
}
const palette = medianCut(pool, nColors);
const hex = palette.map(c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''));
function nearest(p) {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const c = palette[i];
    const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
    if (d < bd) { bd = d; bi = i; }
  }
  return bi;
}
const encoded = {};
for (const [anim, list] of Object.entries(frames)) encoded[anim] = list.map(f => f.map(p => (p ? ALPHABET[nearest(p)] : '.')).join(''));

// ---------- write TS ----------
const lines = [];
lines.push(`// AUTO-GENERATED by scripts/sprite2code.mjs — pixel data converted from an AI-generated sprite sheet.`);
lines.push(`// Do not edit by hand; regenerate instead (see .claude/skills/asset-generation/SKILL.md).`);
lines.push(`import type { CodedSprite } from './types';`);
lines.push('');
lines.push(`const sprite: CodedSprite = {`);
lines.push(`  name: ${JSON.stringify(name)},`);
lines.push(`  w: ${fw},`);
lines.push(`  h: ${fh},`);
lines.push(`  palette: ${JSON.stringify(hex)},`);
lines.push(`  frames: {`);
for (const [anim, list] of Object.entries(encoded)) {
  lines.push(`    ${JSON.stringify(anim)}: [`);
  for (const s of list) {
    lines.push(`      ${JSON.stringify(s.match(new RegExp(`.{1,${fw}}`, 'g')).join(''))},`);
  }
  lines.push(`    ],`);
}
lines.push(`  },`);
lines.push(`};`);
lines.push('');
lines.push(`export default sprite;`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join('\n') + '\n');
console.error(`[${name}] wrote ${out}: ${fw}x${fh}, ${hex.length} colours, frames ${Object.entries(encoded).map(([k, v]) => k + '×' + v.length).join(' ')}`);

// ---------- optional preview ----------
if (args.preview) {
  const animList = Object.entries(encoded);
  const cols = Math.max(...animList.map(([, v]) => v.length));
  const S = 4;
  const PW = cols * fw * S, PH = animList.length * fh * S;
  const buf = Buffer.alloc(PW * PH * 4);
  for (let i = 0; i < PW * PH; i++) { buf[i * 4] = 40; buf[i * 4 + 1] = 44; buf[i * 4 + 2] = 52; buf[i * 4 + 3] = 255; }
  animList.forEach(([, list], ri) => list.forEach((s, ci) => {
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      const ch = s[y * fw + x];
      if (ch === '.') continue;
      const c = palette[ALPHABET.indexOf(ch)];
      for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) {
        const o = (((ri * fh + y) * S + yy) * PW + (ci * fw + x) * S + xx) * 4;
        buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2];
      }
    }
  }));
  await sharp(buf, { raw: { width: PW, height: PH, channels: 4 } }).png().toFile(args.preview);
  console.error(`[${name}] preview → ${args.preview}`);
}
