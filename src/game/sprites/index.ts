import type Phaser from 'phaser';
import { ALPHABET, type CodedSprite } from './types';

// Registry of sprites converted from ChatGPT-generated sheets (see
// .claude/skills/asset-generation/SKILL.md). Add new imports here.
// --- generated sprite imports start ---
// --- generated sprite imports end ---

export const SPRITES: CodedSprite[] = [
  // --- generated sprite list start ---
  // --- generated sprite list end ---
];

/** Paint every coded sprite frame into a canvas texture `<name>_<anim>_<i>`. */
export function registerCodedSprites(scene: Phaser.Scene) {
  for (const s of SPRITES) {
    const rgb = s.palette.map(h => h);
    for (const [anim, frames] of Object.entries(s.frames)) {
      frames.forEach((data, i) => {
        const key = `${s.name}_${anim}_${i}`;
        if (scene.textures.exists(key)) return;
        const tex = scene.textures.createCanvas(key, s.w, s.h);
        if (!tex) return;
        const ctx = tex.getContext();
        for (let y = 0; y < s.h; y++) {
          for (let x = 0; x < s.w; x++) {
            const ch = data[y * s.w + x];
            if (ch === '.' || ch === undefined) continue;
            ctx.fillStyle = rgb[ALPHABET.indexOf(ch)];
            ctx.fillRect(x, y, 1, 1);
          }
        }
        tex.refresh();
      });
    }
  }
}

export function hasSprite(scene: Phaser.Scene, name: string, anim: string) {
  return scene.textures.exists(`${name}_${anim}_0`);
}

export function frameCount(name: string, anim: string) {
  const s = SPRITES.find(p => p.name === name);
  return s?.frames[anim]?.length ?? 0;
}
