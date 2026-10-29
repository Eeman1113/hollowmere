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
import warden from './warden';
import herbalist from './herbalist';
import smith from './smith';
import hunter from './hunter';
import boss_choir from './boss_choir';
import boss_bride from './boss_bride';
import boss_hollow from './boss_hollow';
import boss_smith from './boss_smith';
import player_grave from './player_grave';
import player_choir from './player_choir';
import player_hunter from './player_hunter';
import player_crown from './player_crown';
import wolf from './wolf';
import deer from './deer';
import boar from './boar';
import fenhound from './fenhound';
import player_lantern from './player_lantern';
import hollow_axe from './hollow_axe';
import redhand_bow from './redhand_bow';
import stag from './stag';
import emberhound from './emberhound';
import rotbeast from './rotbeast';
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
  warden,
  herbalist,
  smith,
  hunter,
  boss_choir,
  boss_bride,
  boss_hollow,
  boss_smith,
  player_grave,
  player_choir,
  player_hunter,
  player_crown,
  wolf,
  deer,
  boar,
  fenhound,
  player_lantern,
  hollow_axe,
  redhand_bow,
  stag,
  emberhound,
  rotbeast,
  // --- generated sprite list end ---
];

export const spriteByName = (name: string) => SPRITES.find(s => s.name === name);
export const hasCodedSprite = (name: string) => SPRITES.some(s => s.name === name);
export type { CodedSprite };
