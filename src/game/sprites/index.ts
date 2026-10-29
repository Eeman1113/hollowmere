import type Phaser from 'phaser';
import { ALPHABET, type CodedSprite } from './types';

// Registry of sprites converted from ChatGPT-generated sheets (see
// .claude/skills/asset-generation/SKILL.md). Add new imports here.
// --- generated sprite imports start ---
import player from './player';
import bandit from './bandit';
import elder from './elder';
import captain from './captain';
import merchant from './merchant';
import hunter from './hunter';
import herbalist from './herbalist';
import villager from './villager';
import wolf from './wolf';
import boar from './boar';
import deer from './deer';
import wraith from './wraith';
import knight from './knight';
import tree_oak from './tree_oak';
import tree_pine from './tree_pine';
import bush from './bush';
import rock from './rock';
// --- generated sprite imports end ---

export const SPRITES: CodedSprite[] = [
  // --- generated sprite list start ---
  player,
  bandit,
  elder,
  captain,
  merchant,
  hunter,
  herbalist,
  villager,
  wolf,
  boar,
  deer,
  wraith,
  knight,
  tree_oak,
  tree_pine,
  bush,
  rock,
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
