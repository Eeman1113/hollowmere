#!/usr/bin/env node
// Contact sheet of every prop so the architecture can be reviewed at a glance.
import sharp from 'sharp';
import { Px } from '../src/game/art/raster.ts';
import { O } from '../src/game/world/types.ts';
import { mulberry32 } from '../src/game/core.ts';

import { paintProp, boxFor } from '../src/game/art/propdraw.ts';
const out = process.argv[2] || 'props.png';
const only = process.argv[3];
const names = Object.entries(O).filter(([k, v]) => v !== 0 && (!only || k.includes(only.toUpperCase())));
const CW = 84, CH = 180;
const cols = 10;
const rows = Math.ceil(names.length / cols);
const sheet = new Px(CW * cols, CH * rows);
sheet.rect(0, 0, sheet.w, sheet.h, [24, 26, 32]);
names.forEach(([name, o], i) => {
  const cx0 = (i % cols) * CW, cy0 = Math.floor(i / cols) * CH;
  const h = [8, 5, 4, 3].find(u => true) && 1;
  const box = boxFor(o, 3);
  const px = new Px(box.w, box.h);
  paintProp(o, { px, cx: box.w / 2, by: box.h - 8, r: mulberry32(o * 7717 + 3), v: 1, h: 3 });
  px.topLight(0.1, 0.12, 1);
  px.outline([10, 8, 12], 0.85);
  px.blitTo(sheet, cx0 + (CW - box.w) / 2, cy0 + CH - box.h - 6);
  for (let x = 0; x < CW - 2; x += 3) sheet.blend(cx0 + x, cy0 + CH - 14, [255, 70, 70], 0.4);
});
await sharp(Buffer.from(sheet.d), { raw: { width: sheet.w, height: sheet.h, channels: 4 } })
  .resize({ width: sheet.w * 2, kernel: 'nearest' }).png().toFile(out);
console.log('wrote', out, names.length, 'props');
