import { ITEMS, QUESTS, SKILLS, type QuestStatus, type Skill } from './data';
import type { Stack } from './world';

export interface PlayerState {
  x: number; y: number;
  hp: number; maxHp: number;
  stamina: number; maxStamina: number;
  hunger: number; thirst: number; fatigue: number; // 0 = fine, 100 = critical
  bleeding: boolean;
  level: number; xp: number; str: number;
  gold: number;
  inv: Stack[];
  weapon: string | null; armor: string | null;
  skills: Record<Skill, { lvl: number; xp: number }>;
  quests: Record<string, { status: QuestStatus; progress: number }>;
  kills: Record<string, number>;
  days: number;
  won: boolean;
}

export function newPlayer(x: number, y: number): PlayerState {
  const skills = {} as PlayerState['skills'];
  for (const s of SKILLS) skills[s] = { lvl: 0, xp: 0 };
  const quests: PlayerState['quests'] = {};
  for (const q of Object.keys(QUESTS)) quests[q] = { status: 'none', progress: 0 };
  return {
    x, y, hp: 100, maxHp: 100, stamina: 100, maxStamina: 100,
    hunger: 15, thirst: 15, fatigue: 10, bleeding: false,
    level: 1, xp: 0, str: 0, gold: 10,
    inv: [{ id: 'knife', qty: 1 }, { id: 'bread', qty: 1 }, { id: 'water', qty: 1 }],
    weapon: 'knife', armor: null, skills, quests, kills: {}, days: 0, won: false,
  };
}

export const xpForLevel = (lvl: number) => Math.round(100 * Math.pow(lvl, 1.45));
export const skillXpFor = (lvl: number) => 40 + lvl * 45;

export const countItem = (p: PlayerState, id: string) => p.inv.filter(s => s.id === id).reduce((a, s) => a + s.qty, 0);

export function addItem(p: PlayerState, id: string, qty = 1) {
  if (id === 'gold') { p.gold += qty; return; }
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
    if (p.weapon === id) p.weapon = null;
    if (p.armor === id) p.armor = null;
  }
  return true;
}

export const carryWeight = (p: PlayerState) => p.inv.reduce((a, s) => a + (ITEMS[s.id]?.weight ?? 0) * s.qty, 0);
export const maxCarry = (p: PlayerState) => 22 + p.str * 2;

export interface SaveData { v: 1; seed: number; minutes: number; player: PlayerState; obj: string; containers: [number, Stack[]][]; regrow: { i: number; o: number; at: number }[]; bossDead: boolean }

const KEY = 'hollowmere_save_v1';
export function saveGame(d: SaveData) { try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; } }
export function loadGame(): SaveData | null {
  try { const s = localStorage.getItem(KEY); return s ? (JSON.parse(s) as SaveData) : null; } catch { return null; }
}
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
export function hasSave() { try { return !!localStorage.getItem(KEY); } catch { return false; } }

export function encodeBytes(a: Uint8Array) { let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i] + 48); return s; }
export function decodeBytes(s: string, out: Uint8Array) { for (let i = 0; i < s.length && i < out.length; i++) out[i] = s.charCodeAt(i) - 48; }
