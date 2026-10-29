#!/usr/bin/env node
// Renders rig frames to a PNG contact sheet so the art can be eyeballed
// without launching the game. Usage: node scripts/preview-rig.mjs out.png [clip]
import sharp from 'sharp';
import { Px } from '../src/game/art/raster.ts';
import { CLIPS } from '../src/game/art/anim.ts';
import { solve, face, dirYaw } from '../src/game/art/rig.ts';
import { paintSkeleton } from '../src/game/art/paint.ts';
import { LOOKS } from '../src/game/art/looks.ts';

const out = process.argv[2] || 'preview.png';
const which = (process.argv[3] || 'walk,idle,attack1,roll,death').split(',');
const lookName = process.argv[4] || 'player';
const ZOOM = Number(process.argv[5] || 2);
const DIRS = (process.argv[6] || '0,1,2,3,4,5,6,7').split(',').map(Number);
const look = LOOKS[lookName];
if (!look) { console.error('looks:', Object.keys(LOOKS).join(', ')); process.exit(1); }

const W = 76, H = 64, BASE = 53;
const dirs = DIRS;
const rows = [];
for (const cn of which) {
  const clip = CLIPS[cn];
  if (!clip) { console.error('no clip', cn); continue; }
  for (const d of dirs) rows.push({ cn, d, n: clip.frames.length });
}
const cols = Math.max(...rows.map(r => r.n));
const sheet = new Px(W * cols, H * rows.length);
rows.forEach((r, ri) => {
  const clip = CLIPS[r.cn];
  for (let f = 0; f < clip.frames.length; f++) {
    const sk = face(solve(clip.frames[f], look.build), dirYaw(r.d));
    const px = new Px(W, H);
    paintSkeleton(px, sk, look, W / 2, BASE, 7 + f * 13, { ground: !['roll','death','rest'].includes(r.cn), yaw: dirYaw(r.d) });
    px.topLight(0.24, 0.26);
    px.outline(look.ink ?? [12, 9, 14]);
    px.blitTo(sheet, f * W, ri * H);
  }
  // baseline marker so foot planting is checkable
  for (let x = 0; x < sheet.w; x += 3) sheet.blend(x, ri * H + BASE, [255, 60, 60], 0.5);
});
const bg = new Px(sheet.w, sheet.h);
bg.rect(0, 0, sheet.w, sheet.h, [26, 30, 38]);
sheet.blitTo(bg, 0, 0);
await sharp(Buffer.from(bg.d), { raw: { width: bg.w, height: bg.h, channels: 4 } })
  .resize({ width: bg.w * ZOOM, kernel: 'nearest' }).png().toFile(out);
console.log('wrote', out, `${bg.w}x${bg.h}`, 'rows:', rows.map(r => `${r.cn}/${r.d}`).join(' '));
