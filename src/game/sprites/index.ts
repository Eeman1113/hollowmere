// Registry of sprite sheets generated with ChatGPT and converted to code
// (see .claude/skills/asset-generation/SKILL.md). Add each new import here.

import type { CodedSprite } from './types';

// --- generated sprite imports start ---
import player from './player';
import hollow from './hollow';
import gravewarden from './gravewarden';
import choirman from './choirman';
import redhand from './redhand';
import ghoul from './ghoul';
import wraith from './wraith';
import beastman from './beastman';
import inquisitor from './inquisitor';
import bellkeeper from './bellkeeper';
import elder from './elder';
import merchant from './merchant';
// --- generated sprite imports end ---

export const SPRITES: CodedSprite[] = [
  // --- generated sprite list start ---
  player,
  hollow,
  gravewarden,
  choirman,
  redhand,
  ghoul,
  wraith,
  beastman,
  inquisitor,
  bellkeeper,
  elder,
  merchant,
  // --- generated sprite list end ---
];

export const spriteByName = (name: string) => SPRITES.find(s => s.name === name);
export const hasCodedSprite = (name: string) => SPRITES.some(s => s.name === name);
export type { CodedSprite };
