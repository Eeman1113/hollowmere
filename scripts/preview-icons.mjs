#!/usr/bin/env node
// Contact sheet of every item icon.
import sharp from 'sharp';
import { Px } from '../src/game/art/raster.ts';
import { drawIcon, ICON } from '../src/game/art/icondraw.ts';
import { ITEMS } from '../src/game/content/items.ts';

const out = process.argv[2] || 'icons.png';
const only = process.argv[3];
const GLYPH = {
  a:[2,5,7,5,5],b:[6,5,6,5,6],c:[3,4,4,4,3],d:[6,5,5,5,6],e:[7,4,6,4,7],f:[7,4,6,4,4],g:[3,4,5,5,3],h:[5,5,7,5,5],
  i:[7,2,2,2,7],j:[1,1,1,5,2],k:[5,5,6,5,5],l:[4,4,4,4,7],m:[5,7,7,5,5],n:[5,7,7,7,5],o:[2,5,5,5,2],p:[6,5,6,4,4],
  q:[2,5,5,6,3],r:[6,5,6,5,5],s:[3,4,2,1,6],t:[7,2,2,2,2],u:[5,5,5,5,7],v:[5,5,5,5,2],w:[5,5,7,7,5],x:[5,5,2,5,5],
  y:[5,5,2,2,2],z:[7,1,2,4,7],_:[0,0,0,0,7],'0':[7,5,5,5,7],'1':[2,6,2,2,7],'2':[7,1,7,4,7],'3':[7,1,3,1,7],'?':[7,1,3,0,2],
};

const ids = Object.keys(ITEMS).filter(id => !only || ITEMS[id].kind === only);
const cols = 10;
const CW = ICON + 4, CH = ICON + 22;
const rows = Math.ceil(ids.length / cols);
const sheet = new Px(CW * cols, CH * rows);
sheet.rect(0, 0, sheet.w, sheet.h, [22, 24, 30]);
ids.forEach((id, i) => {
  const x = (i % cols) * CW + 2, y = Math.floor(i / cols) * CH + 2;
  sheet.rect(x, y, ICON, ICON, [34, 37, 46]);
  drawIcon(ITEMS[id]).blitTo(sheet, x, y);
  // 3x5 pixel font so each cell is identifiable
  const label = id.slice(0, 11);
  for (let c = 0; c < label.length; c++) {
    const g = GLYPH[label[c]] ?? GLYPH['?'];
    for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 3; gx++) {
      if (g[gy] & (1 << (2 - gx))) sheet.set(x + c * 4 + gx, y + ICON + 3 + gy, [150, 160, 180]);
    }
  }
});
await sharp(Buffer.from(sheet.d), { raw: { width: sheet.w, height: sheet.h, channels: 4 } })
  .resize({ width: sheet.w * 3, kernel: 'nearest' }).png().toFile(out);
console.log('wrote', out, ids.length, 'icons');
