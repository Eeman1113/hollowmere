// Player state, derived stats and saving.

import { ARMOR_SETS, ITEMS, upgradeMul, type ItemDef, type Slot } from './content/items';

export type StatId = 'vigor' | 'endurance' | 'strength' | 'dexterity' | 'faith' | 'arcane';
export const STATS: StatId[] = ['vigor', 'endurance', 'strength', 'dexterity', 'faith', 'arcane'];
export const STAT_NAME: Record<StatId, string> = {
  vigor: 'Vigour', endurance: 'Endurance', strength: 'Strength',
  dexterity: 'Dexterity', faith: 'Faith', arcane: 'Arcane',
};
export const STAT_BLURB: Record<StatId, string> = {
  vigor: 'Raises maximum health.',
  endurance: 'Raises stamina and how much you can carry.',
  strength: 'Scales heavy weapons.',
  dexterity: 'Scales fast weapons.',
  faith: 'Scales sacred weapons and holy damage.',
  arcane: 'Scales cursed weapons and item discovery.',
};

export interface Stack { id: string; qty: number }
export type EquipSlots = Record<Slot | 'talisman2', string | null>;

export interface PlayerState {
  x: number; y: number;
  hp: number;
  stam: number;
  level: number;
  runes: number;
  stats: Record<StatId, number>;
  equip: EquipSlots;
  upgrades: Record<string, number>;
  inv: Stack[];
  flaskCur: number;
  flaskMax: number;
  flags: Record<string, boolean>;
  /** Discovered lanterns, "x,y" → display name. */
  lanterns: Record<string, string>;
  lastLantern: { x: number; y: number } | null;
  bloodstain: { x: number; y: number; runes: number } | null;
  remnants: string[];
  deaths: number;
  playSecs: number;
  /** Temporary buffs: id → expiry timestamp in play-seconds. */
  buffs: Record<string, { mul: number; until: number }>;
  twoHand: boolean;
  ending?: string;
}

export function newPlayer(x: number, y: number): PlayerState {
  const p: PlayerState = {
    x, y, hp: 0, stam: 0, level: 1, runes: 0,
    stats: { vigor: 10, endurance: 10, strength: 10, dexterity: 10, faith: 8, arcane: 8 },
    equip: {
      weapon: 'rusted_dagger', offhand: 'plank_shield', helm: 'wanderer_hood', chest: 'wanderer_coat',
      arms: 'wanderer_gloves', legs: 'wanderer_boots', talisman: null, talisman2: null,
    },
    upgrades: {},
    inv: [
      { id: 'rusted_dagger', qty: 1 }, { id: 'plank_shield', qty: 1 },
      { id: 'wanderer_hood', qty: 1 }, { id: 'wanderer_coat', qty: 1 },
      { id: 'wanderer_gloves', qty: 1 }, { id: 'wanderer_boots', qty: 1 },
      { id: 'bandage', qty: 3 }, { id: 'throwing_knife', qty: 5 },
    ],
    flaskCur: 4, flaskMax: 4,
    flags: {}, lanterns: {}, lastLantern: null, bloodstain: null, remnants: [],
    deaths: 0, playSecs: 0, buffs: {}, twoHand: false,
  };
  p.hp = maxHp(p); p.stam = maxStam(p);
  return p;
}

// ----------------------------------------------------------- derived stats
/** Soft-capped curve, so early points matter most. */
const curve = (n: number, soft: number, a: number, b: number) =>
  n <= soft ? n * a : soft * a + (n - soft) * b;

export const maxHp = (p: PlayerState) => Math.round(260 + curve(p.stats.vigor - 8, 20, 22, 9));
export const maxStam = (p: PlayerState) => Math.round(88 + curve(p.stats.endurance - 8, 18, 6.5, 2.2));
export const maxLoad = (p: PlayerState) => Math.round(38 + p.stats.endurance * 2.1);
export const staminaRegen = (p: PlayerState) => 26 + p.stats.endurance * 0.5;

export const itemOf = (id: string | null | undefined) => (id ? ITEMS[id] : undefined);
export const upgradeOf = (p: PlayerState, id: string | null | undefined) => (id ? p.upgrades[id] ?? 0 : 0);

export function carried(p: PlayerState) {
  let w = 0;
  for (const s of Object.values(p.equip)) { const it = itemOf(s); if (it) w += it.weight; }
  return Math.round(w * 10) / 10;
}
/** 0 = light roll, 1 = medium, 2 = heavy, 3 = overloaded. */
export function loadTier(p: PlayerState) {
  const r = carried(p) / maxLoad(p);
  return r < 0.3 ? 0 : r < 0.56 ? 1 : r < 1 ? 2 : 3;
}
export const LOAD_NAME = ['Light', 'Medium', 'Heavy', 'Overloaded'];

export function armorTotals(p: PlayerState) {
  let phys = 0, arc = 0, fire = 0, poise = 0;
  for (const slot of ['helm', 'chest', 'arms', 'legs', 'offhand'] as const) {
    const it = itemOf(p.equip[slot]);
    if (!it) continue;
    phys += it.phys ?? 0; arc += it.arcaneDef ?? 0; fire += it.fireDef ?? 0; poise += it.poise ?? 0;
  }
  return { phys, arc, fire, poise };
}

/** Which full armour sets are equipped. */
export function activeSets(p: PlayerState) {
  const out: string[] = [];
  for (const [id, set] of Object.entries(ARMOR_SETS)) {
    if (set.pieces.every(pc => Object.values(p.equip).includes(pc))) out.push(id);
  }
  return out;
}

export function talismanMods(p: PlayerState) {
  const m = { maxHp: 0, maxStam: 0, dmgMul: 1, defMul: 1, runeMul: 1, rollIFrames: 0, weightMax: 0, discovery: 0 };
  for (const slot of ['talisman', 'talisman2'] as const) {
    const it = itemOf(p.equip[slot]);
    if (!it?.mods) continue;
    for (const [k, v] of Object.entries(it.mods)) {
      if (k === 'dmgMul' || k === 'defMul' || k === 'runeMul') (m as Record<string, number>)[k] *= v as number;
      else (m as Record<string, number>)[k] += v as number;
    }
  }
  return m;
}

/** Total attack power of the equipped weapon. */
export function weaponPower(p: PlayerState) {
  const w = itemOf(p.equip.weapon);
  if (!w?.dmg) return { dmg: 18, holy: 0 };
  const lvl = upgradeOf(p, w.id);
  let dmg = w.dmg * upgradeMul(lvl);
  const sc = w.scaling;
  if (sc) {
    const eff = (n: number) => curve(Math.max(0, n - 8), 32, 1, 0.35);
    dmg += eff(p.stats.strength) * sc.str * 2.6 * (p.twoHand ? 1.5 : 1);
    dmg += eff(p.stats.dexterity) * sc.dex * 2.6;
    dmg += eff(p.stats.faith) * sc.fth * 2.6;
    dmg += eff(p.stats.arcane) * sc.arc * 2.6;
  }
  const t = talismanMods(p);
  dmg *= t.dmgMul;
  for (const b of Object.values(p.buffs)) dmg *= b.mul;
  if (p.twoHand) dmg *= 1.15;
  return { dmg: Math.round(dmg), holy: (w.holy ?? 0) * (1 + (p.stats.faith - 8) * 0.03) };
}

/** Stat requirement to meet a weapon comfortably; under it you swing weakly. */
export function weaponPenalty(p: PlayerState) {
  const w = itemOf(p.equip.weapon);
  if (!w?.scaling) return 1;
  const need = 8 + Math.round((w.dmg ?? 0) / 7);
  const have = Math.max(p.stats.strength * (w.scaling.str > w.scaling.dex ? 1 : 0.6), p.stats.dexterity * (w.scaling.dex >= w.scaling.str ? 1 : 0.6));
  return have >= need ? 1 : Math.max(0.45, have / need);
}

export const xpForLevel = (lvl: number) => Math.round(120 * Math.pow(lvl, 1.42) + lvl * 60);

// -------------------------------------------------------------- inventory
export const countItem = (p: PlayerState, id: string) => p.inv.find(s => s.id === id)?.qty ?? 0;

export function addItem(p: PlayerState, id: string, qty = 1) {
  if (!ITEMS[id]) return;
  const s = p.inv.find(s => s.id === id);
  if (s) s.qty += qty;
  else p.inv.push({ id, qty });
}

export function removeItem(p: PlayerState, id: string, qty = 1) {
  const s = p.inv.find(s => s.id === id);
  if (!s || s.qty < qty) return false;
  s.qty -= qty;
  if (s.qty <= 0) {
    p.inv.splice(p.inv.indexOf(s), 1);
    for (const k of Object.keys(p.equip) as (keyof EquipSlots)[]) if (p.equip[k] === id) p.equip[k] = null;
  }
  return true;
}

export const slotFor = (it: ItemDef): keyof EquipSlots | null =>
  it.kind === 'weapon' ? 'weapon' : it.kind === 'offhand' ? 'offhand'
  : it.kind === 'helm' ? 'helm' : it.kind === 'chest' ? 'chest'
  : it.kind === 'arms' ? 'arms' : it.kind === 'legs' ? 'legs'
  : it.kind === 'talisman' ? 'talisman' : null;

export function equip(p: PlayerState, id: string, preferSecond = false) {
  const it = ITEMS[id];
  if (!it) return false;
  let slot = slotFor(it);
  if (!slot) return false;
  if (slot === 'talisman' && (preferSecond || p.equip.talisman === id)) slot = 'talisman2';
  if (p.equip[slot] === id) { p.equip[slot] = null; return true; }
  // never wear the same talisman twice
  if (slot === 'talisman2' && p.equip.talisman === id) p.equip.talisman = null;
  if (slot === 'talisman' && p.equip.talisman2 === id) p.equip.talisman2 = null;
  p.equip[slot] = id;
  return true;
}

// ------------------------------------------------------------------- save
export interface SaveData {
  v: 2;
  seed: number;
  player: PlayerState;
  minutes: number;
  edits: [number, number, number][];
  killed: string[];
}

const KEY = 'hollowmere_save_v2';
export function saveGame(d: SaveData) { try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; } }
export function loadGame(): SaveData | null {
  try { const s = localStorage.getItem(KEY); return s ? (JSON.parse(s) as SaveData) : null; } catch { return null; }
}
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
export function hasSave() { try { return !!localStorage.getItem(KEY); } catch { return false; } }
