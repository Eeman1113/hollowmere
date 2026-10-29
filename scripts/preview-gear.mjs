#!/usr/bin/env node
// Renders the player wearing each armour set with a matching weapon, proving
// equipment is drawn onto the character rather than described in a tooltip.
import sharp from 'sharp';
import { Px } from '../src/game/art/raster.ts';
import { CLIPS } from '../src/game/art/anim.ts';
import { solve, face, dirYaw } from '../src/game/art/rig.ts';
import { paintSkeleton } from '../src/game/art/paint.ts';
import { LOOKS } from '../src/game/art/looks.ts';
import { ITEMS, ARMOR_SETS } from '../src/game/content/items.ts';

const out = process.argv[2] || 'gear.png';
const clip = process.argv[3] || 'idle';
const dir = Number(process.argv[4] ?? 2);

const WEAPON_FOR = {
  wanderer: 'rusted_dagger', lantern: 'lantern_sword', grave: 'gravewarden_halberd',
  choir: 'choir_scythe', hunter: 'beastcleaver', crown: 'hollowbane',
};
const SHIELD_FOR = { wanderer: 'plank_shield', lantern: 'warden_kite', grave: 'ossuary_tower', hunter: 'hunters_buckler' };

const sets = Object.keys(ARMOR_SETS);
const W = 76, H = 64, BASE = 53;
const frames = CLIPS[clip].frames.length;
const sheet = new Px(W * frames, H * sets.length);
sheet.rect(0, 0, sheet.w, sheet.h, [24, 26, 32]);

sets.forEach((setId, row) => {
  const pieces = ARMOR_SETS[setId].pieces.map(id => ITEMS[id]);
  const look = {
    ...LOOKS.player,
    helm: pieces.find(p => p.kind === 'helm')?.helmVis,
    body: pieces.find(p => p.kind === 'chest')?.armVis,
    arms: pieces.find(p => p.kind === 'arms')?.armVis,
    legs: pieces.find(p => p.kind === 'legs')?.armVis,
    weapon: ITEMS[WEAPON_FOR[setId]]?.vis,
    shield: SHIELD_FOR[setId] ? ITEMS[SHIELD_FOR[setId]].shieldVis : undefined,
  };
  for (let f = 0; f < frames; f++) {
    const sk = face(solve(CLIPS[clip].frames[f], look.build), dirYaw(dir));
    const px = new Px(W, H);
    paintSkeleton(px, sk, look, W / 2, BASE, 11 + f * 13, { ground: true, yaw: dirYaw(dir) });
    px.topLight(0.24, 0.26);
    px.outline(look.ink ?? [12, 9, 14]);
    px.blitTo(sheet, f * W, row * H);
  }
  for (let x = 0; x < sheet.w; x += 3) sheet.blend(x, row * H + BASE, [255, 70, 70], 0.35);
});
await sharp(Buffer.from(sheet.d), { raw: { width: sheet.w, height: sheet.h, channels: 4 } })
  .resize({ width: sheet.w * 4, kernel: 'nearest' }).png().toFile(out);
console.log('wrote', out, 'sets:', sets.join(', '));
