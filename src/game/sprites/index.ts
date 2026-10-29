// Registry of sprite sheets generated with ChatGPT and converted to code
// (see .claude/skills/asset-generation/SKILL.md). Add each new import here.

import type { CodedSprite } from './types';

// --- generated sprite imports start ---
import player from './player';
// --- generated sprite imports end ---

export const SPRITES: CodedSprite[] = [
  // --- generated sprite list start ---
  player,
  // --- generated sprite list end ---
];

export const spriteByName = (name: string) => SPRITES.find(s => s.name === name);
export const hasCodedSprite = (name: string) => SPRITES.some(s => s.name === name);
export type { CodedSprite };
