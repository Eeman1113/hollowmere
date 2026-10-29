#!/usr/bin/env node
// Top-down map of generated terrain so worldgen can be checked without the game.
// Usage: node scripts/preview-world.mjs out.png [seed] [span] [cx] [cy]
import sharp from 'sharp';
import { WorldGen, CHUNK } from '../src/game/world/gen.ts';
import { T, O, BIOMES, BLOCKING } from '../src/game/world/types.ts';

const out = process.argv[2] || 'world.png';
const seed = Number(process.argv[3] || 1337);
const span = Number(process.argv[4] || 320);
const ox = Number(process.argv[5] || 0) - span / 2;
const oy = Number(process.argv[6] || 0) - span / 2;

const g = new WorldGen(seed);
const TC = {
  [T.DEEP]: [18, 28, 44], [T.WATER]: [34, 56, 78], [T.SAND]: [120, 110, 86],
  [T.GRASS]: [62, 80, 54], [T.GRASS_DRY]: [96, 94, 62], [T.MOSS]: [52, 72, 50],
  [T.FERN]: [58, 84, 60], [T.DIRT]: [78, 66, 52], [T.MUD]: [58, 50, 40],
  [T.BOG]: [46, 56, 46], [T.ASH]: [92, 86, 82], [T.CINDER]: [72, 56, 50],
  [T.STONE]: [92, 92, 100], [T.COBBLE]: [108, 106, 112], [T.FLAG]: [122, 120, 126],
  [T.MARBLE]: [160, 158, 164], [T.PLANK]: [96, 72, 48], [T.GRAVE_DIRT]: [70, 64, 58],
  [T.ROAD]: [112, 98, 78], [T.SNOW]: [196, 202, 212], [T.ROT]: [78, 92, 46], [T.BLOODSTONE]: [92, 44, 44],
};
const buf = Buffer.alloc(span * span * 4);
let water = 0, props = 0, roads = 0;
const structSeen = new Map();
for (let cy = Math.floor(oy / CHUNK); cy <= Math.floor((oy + span) / CHUNK); cy++)
  for (let cx = Math.floor(ox / CHUNK); cx <= Math.floor((ox + span) / CHUNK); cx++) {
    const ch = g.get(cx, cy);
    for (const s of g.structsNear(cx, cy)) structSeen.set(`${s.id}@${s.x},${s.y}`, s);
    for (let y = 0; y < CHUNK; y++) for (let x = 0; x < CHUNK; x++) {
      const wx = cx * CHUNK + x, wy = cy * CHUNK + y;
      const px = wx - ox, py = wy - oy;
      if (px < 0 || py < 0 || px >= span || py >= span) continue;
      const i = y * CHUNK + x;
      let c = TC[ch.ground[i]] || [255, 0, 255];
      if (ch.ground[i] === T.WATER || ch.ground[i] === T.DEEP) water++;
      if (ch.ground[i] === T.ROAD) roads++;
      const o = ch.obj[i];
      if (o) {
        props++;
        if (BLOCKING.has(o)) c = [Math.min(255, c[0] * 0.5 + 60), c[1] * 0.5 + 40, c[2] * 0.5 + 40];
        else c = [c[0] * 0.8, c[1] * 0.9, c[2] * 0.8];
        if (o === O.LANTERN) c = [255, 190, 90];
        if (o === O.FOG_WALL) c = [200, 210, 255];
        if (o === O.CHEST) c = [230, 190, 60];
      }
      const k = (py * span + px) * 4;
      buf[k] = c[0]; buf[k + 1] = c[1]; buf[k + 2] = c[2]; buf[k + 3] = 255;
    }
  }
// mark story sites
for (const s of g.sites) {
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const px = s.x - ox + dx, py = s.y - oy + dy;
    if (px < 0 || py < 0 || px >= span || py >= span) continue;
    const k = (py * span + px) * 4;
    buf[k] = 255; buf[k + 1] = 60; buf[k + 2] = 220; buf[k + 3] = 255;
  }
}
await sharp(buf, { raw: { width: span, height: span, channels: 4 } }).resize({ width: span * 3, kernel: 'nearest' }).png().toFile(out);
const tally = {};
for (const s of structSeen.values()) tally[s.id] = (tally[s.id] || 0) + 1;
console.log('wrote', out, `${span}x${span} tiles`);
console.log('water%', (water / (span * span) * 100).toFixed(1), 'prop%', (props / (span * span) * 100).toFixed(1), 'road%', (roads / (span * span) * 100).toFixed(1));
console.log('structures:', Object.entries(tally).map(([k, v]) => `${k}:${v}`).join(' ') || 'NONE');
console.log('sites:', g.sites.map(s => `${s.id}(${s.x},${s.y})`).join(' '));
