#!/usr/bin/env node
import sharp from 'sharp';
import { Px } from '../src/game/art/raster.ts';
import { BEAST_CLIPS, faceBeast, paintBeast, solveBeast } from '../src/game/art/beast.ts';
import { dirYaw } from '../src/game/art/rig.ts';
import { BEASTS } from '../src/game/art/looks.ts';

const out = process.argv[2] || 'beast.png';
const which = (process.argv[3] || 'walk,run,attack1').split(',');
const name = process.argv[4] || 'deer';
const dirs = (process.argv[5] || '0,2,4,6').split(',').map(Number);
const look = BEASTS[name];
if (!look) { console.error('looks:', Object.keys(BEASTS).join(', ')); process.exit(1); }
const W = 76, H = 64, BASE = 53;
const rows = [];
for (const cn of which) for (const d of dirs) rows.push({ cn, d, n: BEAST_CLIPS[cn].frames.length });
const cols = Math.max(...rows.map(r => r.n));
const sheet = new Px(W * cols, H * rows.length);
sheet.rect(0, 0, sheet.w, sheet.h, [26, 30, 38]);
rows.forEach((r, ri) => {
  const clip = BEAST_CLIPS[r.cn];
  for (let f = 0; f < clip.frames.length; f++) {
    const sk = faceBeast(solveBeast(clip.frames[f], look.build), dirYaw(r.d));
    const px = new Px(W, H);
    paintBeast(px, sk, look, W / 2, BASE, { ground: !['death'].includes(r.cn), yaw: dirYaw(r.d) });
    px.topLight(0.22, 0.24);
    px.outline(look.ink ?? [12, 9, 14]);
    px.blitTo(sheet, f * W, ri * H);
  }
  for (let x = 0; x < sheet.w; x += 3) sheet.blend(x, ri * H + BASE, [255, 60, 60], 0.45);
});
await sharp(Buffer.from(sheet.d), { raw: { width: sheet.w, height: sheet.h, channels: 4 } })
  .resize({ width: sheet.w * 3, kernel: 'nearest' }).png().toFile(out);
console.log('wrote', out, rows.map(r => `${r.cn}/${r.d}`).join(' '));
