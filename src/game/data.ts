// Static game data: tiles, world objects, items, recipes, creatures, quests.

export enum T { GRASS, GRASS2, GRASS3, DIRT, WATER, SAND, FLOOR, STONE, FARM, DEEP }

export enum O {
  NONE, WALL, TREE, PINE, BUSH, BUSH_EMPTY, ROCK, CRATE, CUPBOARD, BED, WELL, FENCE,
  CAMPFIRE, TABLE, STUMP, LAMP, TENT, BARREL, GRAVE, ALTAR, HERB, RUIN, DOOR, CHEST,
}

export const BLOCKING = new Set<O>([
  O.WALL, O.TREE, O.PINE, O.ROCK, O.CRATE, O.CUPBOARD, O.BED, O.WELL, O.FENCE, O.CAMPFIRE,
  O.TABLE, O.LAMP, O.TENT, O.BARREL, O.GRAVE, O.ALTAR, O.RUIN, O.CHEST,
]);
/** Tall objects fade out when the player walks behind them. */
export const TALL = new Set<O>([O.WALL, O.TREE, O.PINE, O.RUIN, O.TENT, O.CUPBOARD, O.LAMP, O.WELL]);
export const CONTAINERS = new Set<O>([O.CRATE, O.CUPBOARD, O.BARREL, O.CHEST]);

export const OBJ_NAMES: Partial<Record<O, string>> = {
  [O.TREE]: 'Oak Tree', [O.PINE]: 'Pine Tree', [O.BUSH]: 'Berry Bush', [O.ROCK]: 'Rock',
  [O.CRATE]: 'Crate', [O.CUPBOARD]: 'Cupboard', [O.BED]: 'Bed', [O.WELL]: 'Well',
  [O.CAMPFIRE]: 'Campfire', [O.BARREL]: 'Barrel', [O.HERB]: 'Wild Herbs', [O.CHEST]: 'Old Chest',
  [O.ALTAR]: 'Hollow Altar', [O.GRAVE]: 'Grave',
};

export type ItemKind = 'food' | 'drink' | 'weapon' | 'armor' | 'material' | 'medical' | 'tool' | 'quest' | 'misc';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  weight: number;
  value: number;
  desc: string;
  hunger?: number; // negative = reduces hunger
  thirst?: number;
  heal?: number;
  fatigue?: number;
  stopsBleeding?: boolean;
  dmg?: number;
  range?: number;
  cooldown?: number;
  armor?: number;
  chop?: number; // woodcutting power
  leaves?: string; // item left after use
}

export const ITEMS: Record<string, ItemDef> = {
  berries: { id: 'berries', name: 'Wild Berries', kind: 'food', weight: 0.1, value: 2, desc: 'A handful of tart berries.', hunger: -8, thirst: -2 },
  apple: { id: 'apple', name: 'Apple', kind: 'food', weight: 0.2, value: 3, desc: 'Crisp and a little bruised.', hunger: -12, thirst: -3 },
  bread: { id: 'bread', name: 'Loaf of Bread', kind: 'food', weight: 0.4, value: 8, desc: 'Dense rye bread.', hunger: -30 },
  raw_meat: { id: 'raw_meat', name: 'Raw Meat', kind: 'food', weight: 0.5, value: 4, desc: 'Cook it at a campfire. Eating it raw is a bad idea.', hunger: -10, heal: -8 },
  cooked_meat: { id: 'cooked_meat', name: 'Roast Meat', kind: 'food', weight: 0.4, value: 12, desc: 'Smoky and filling.', hunger: -40, heal: 5 },
  stew: { id: 'stew', name: 'Hearty Stew', kind: 'food', weight: 0.6, value: 25, desc: 'Meat, herbs and water. Warms the bones.', hunger: -55, thirst: -20, heal: 15 },
  water: { id: 'water', name: 'Water Bottle', kind: 'drink', weight: 0.6, value: 5, desc: 'Clean water. Refill empty bottles at a well.', thirst: -45, leaves: 'bottle' },
  bottle: { id: 'bottle', name: 'Empty Bottle', kind: 'misc', weight: 0.2, value: 1, desc: 'Fill it at a well or lake.' },
  ale: { id: 'ale', name: 'Mug of Ale', kind: 'drink', weight: 0.5, value: 6, desc: 'Takes the edge off.', thirst: -25, fatigue: 5, heal: 3 },
  bandage: { id: 'bandage', name: 'Bandage', kind: 'medical', weight: 0.1, value: 6, desc: 'Stops bleeding and heals a little.', heal: 12, stopsBleeding: true },
  tonic: { id: 'tonic', name: 'Healing Tonic', kind: 'medical', weight: 0.3, value: 25, desc: 'Bitter herbal tonic. Heals wounds quickly.', heal: 45, stopsBleeding: true, leaves: 'bottle' },
  coffee: { id: 'coffee', name: 'Bitter Root Tea', kind: 'drink', weight: 0.3, value: 10, desc: 'Keeps you awake.', fatigue: -30, thirst: -15 },
  cloth: { id: 'cloth', name: 'Cloth Scraps', kind: 'material', weight: 0.1, value: 2, desc: 'Torn fabric. Good for bandages.' },
  wood: { id: 'wood', name: 'Log', kind: 'material', weight: 1.5, value: 3, desc: 'Fresh-cut timber.' },
  stone: { id: 'stone', name: 'Stone', kind: 'material', weight: 1, value: 1, desc: 'A fist-sized stone.' },
  herb: { id: 'herb', name: 'Herbs', kind: 'material', weight: 0.05, value: 4, desc: 'Fragrant medicinal herbs.' },
  pelt: { id: 'pelt', name: 'Wolf Pelt', kind: 'material', weight: 1, value: 15, desc: 'Thick grey fur.' },
  hide: { id: 'hide', name: 'Animal Hide', kind: 'material', weight: 1, value: 8, desc: 'Tough leather hide.' },
  ecto: { id: 'ecto', name: 'Wraith Essence', kind: 'material', weight: 0.1, value: 18, desc: 'Cold, glowing residue. Wren pays well for it.' },
  token: { id: 'token', name: 'Bandit Insignia', kind: 'quest', weight: 0.1, value: 5, desc: 'A crude red badge worn by the Redhand gang.' },
  relic: { id: 'relic', name: 'Hollow Heart', kind: 'quest', weight: 1, value: 0, desc: 'A pulsing stone heart. The source of the blight.' },
  knife: { id: 'knife', name: 'Hunting Knife', kind: 'weapon', weight: 0.5, value: 12, desc: 'Quick but short.', dmg: 7, range: 1.1, cooldown: 380 },
  club: { id: 'club', name: 'Wooden Club', kind: 'weapon', weight: 2, value: 6, desc: 'Heavy and crude.', dmg: 11, range: 1.3, cooldown: 650 },
  axe: { id: 'axe', name: 'Woodcutter Axe', kind: 'weapon', weight: 2.5, value: 30, desc: 'Chops trees. Chops wolves too.', dmg: 13, range: 1.3, cooldown: 700, chop: 2 },
  spear: { id: 'spear', name: 'Ash Spear', kind: 'weapon', weight: 2, value: 40, desc: 'Long reach.', dmg: 14, range: 1.9, cooldown: 600 },
  sword: { id: 'sword', name: 'Iron Sword', kind: 'weapon', weight: 2.5, value: 90, desc: 'A soldier\'s blade.', dmg: 20, range: 1.5, cooldown: 520 },
  hollowblade: { id: 'hollowblade', name: 'Hollowbane', kind: 'weapon', weight: 3, value: 300, desc: 'Forged to slay the Hollow. Glows faintly teal.', dmg: 34, range: 1.7, cooldown: 480 },
  leather: { id: 'leather', name: 'Leather Armor', kind: 'armor', weight: 4, value: 70, desc: 'Reduces damage taken.', armor: 3 },
  furcoat: { id: 'furcoat', name: 'Wolf-Fur Coat', kind: 'armor', weight: 5, value: 120, desc: 'Warm and tough.', armor: 5 },
  chain: { id: 'chain', name: 'Chainmail', kind: 'armor', weight: 8, value: 200, desc: 'Heavy, but stops blades.', armor: 8 },
};

export interface Recipe { out: string; qty: number; needs: Record<string, number>; nearFire?: boolean; skill: number; name?: string }
export const RECIPES: Recipe[] = [
  { out: 'bandage', qty: 1, needs: { cloth: 2 }, skill: 0 },
  { out: 'campfire', qty: 1, needs: { wood: 3, stone: 2 }, skill: 0, name: 'Campfire (placed)' },
  { out: 'club', qty: 1, needs: { wood: 2 }, skill: 0 },
  { out: 'spear', qty: 1, needs: { wood: 2, stone: 1, cloth: 1 }, skill: 2 },
  { out: 'cooked_meat', qty: 1, needs: { raw_meat: 1 }, nearFire: true, skill: 0 },
  { out: 'tonic', qty: 1, needs: { herb: 3, water: 1 }, nearFire: true, skill: 1 },
  { out: 'stew', qty: 1, needs: { raw_meat: 1, herb: 1, water: 1 }, nearFire: true, skill: 2 },
  { out: 'coffee', qty: 1, needs: { herb: 2, water: 1 }, nearFire: true, skill: 1 },
  { out: 'leather', qty: 1, needs: { hide: 3, cloth: 2 }, skill: 3 },
  { out: 'furcoat', qty: 1, needs: { pelt: 4, cloth: 2 }, skill: 4 },
];

export interface MobDef {
  id: string; name: string; hp: number; dmg: number; speed: number; aggro: number;
  cooldown: number; xp: number; behavior: 'hostile' | 'neutral' | 'passive';
  drops: [string, number, number, number][]; // id, chance, min, max
  gold?: [number, number]; night?: boolean; scale?: number; bleed?: number; tint?: number;
}

export const MOBS: Record<string, MobDef> = {
  wolf: { id: 'wolf', name: 'Wolf', hp: 30, dmg: 6, speed: 2.9, aggro: 7, cooldown: 1100, xp: 20, behavior: 'hostile', bleed: 0.15, drops: [['raw_meat', 1, 1, 1], ['pelt', 0.7, 1, 1]] },
  boar: { id: 'boar', name: 'Wild Boar', hp: 45, dmg: 9, speed: 2.5, aggro: 0, cooldown: 1300, xp: 25, behavior: 'neutral', drops: [['raw_meat', 1, 1, 2], ['hide', 0.8, 1, 1]] },
  deer: { id: 'deer', name: 'Deer', hp: 22, dmg: 0, speed: 3.6, aggro: 5, cooldown: 1000, xp: 12, behavior: 'passive', drops: [['raw_meat', 1, 1, 2], ['hide', 0.9, 1, 1]] },
  bandit: { id: 'bandit', name: 'Redhand Bandit', hp: 55, dmg: 10, speed: 2.4, aggro: 8, cooldown: 1200, xp: 40, behavior: 'hostile', bleed: 0.2, gold: [4, 14], drops: [['token', 0.7, 1, 1], ['cloth', 0.6, 1, 2], ['bread', 0.3, 1, 1], ['ale', 0.25, 1, 1], ['knife', 0.08, 1, 1]] },
  wraith: { id: 'wraith', name: 'Hollow Wraith', hp: 40, dmg: 12, speed: 2.1, aggro: 9, cooldown: 1400, xp: 50, behavior: 'hostile', night: true, drops: [['ecto', 1, 1, 1]] },
  knight: { id: 'knight', name: 'The Hollow Knight', hp: 420, dmg: 22, speed: 2.0, aggro: 8, cooldown: 1500, xp: 600, behavior: 'hostile', scale: 1, bleed: 0.3, drops: [['relic', 1, 1, 1], ['chain', 1, 1, 1]] },
};

export type QuestStatus = 'none' | 'active' | 'done';
export interface QuestDef { id: string; title: string; giver: string; desc: string; goal: string; kind: 'kill' | 'fetch'; target: string; count: number; reward: { gold?: number; xp: number; items?: [string, number][] } }

export const QUESTS: Record<string, QuestDef> = {
  wolves: { id: 'wolves', title: 'Wolves at the Gate', giver: 'elder', desc: 'The wolves grow bold. Elder Maren wants five of them dead.', goal: 'Slay wolves', kind: 'kill', target: 'wolf', count: 5, reward: { gold: 60, xp: 120 } },
  pelts: { id: 'pelts', title: 'Pelts for Winter', giver: 'hunter', desc: 'Ilsa the hunter needs wolf pelts before the frost.', goal: 'Bring wolf pelts', kind: 'fetch', target: 'pelt', count: 3, reward: { xp: 90, items: [['leather', 1]] } },
  herbs: { id: 'herbs', title: 'The Healer\'s Basket', giver: 'herbalist', desc: 'Wren needs wild herbs to brew medicine for the village.', goal: 'Bring herbs', kind: 'fetch', target: 'herb', count: 5, reward: { gold: 30, xp: 70, items: [['tonic', 2]] } },
  bandits: { id: 'bandits', title: 'The Redhand Gang', giver: 'captain', desc: 'Captain Roderic wants proof that the bandit camp in the north-east has been dealt with.', goal: 'Bring bandit insignias', kind: 'fetch', target: 'token', count: 4, reward: { gold: 100, xp: 200, items: [['sword', 1]] } },
  relic: { id: 'relic', title: 'Heart of the Hollow', giver: 'elder', desc: 'The blight spreads from the ruined chapel in the north-west. Destroy the Hollow Knight and bring back its heart.', goal: 'Recover the Hollow Heart', kind: 'fetch', target: 'relic', count: 1, reward: { gold: 300, xp: 800, items: [['hollowblade', 1]] } },
};

export const SHOP_STOCK = ['bread', 'apple', 'water', 'bottle', 'ale', 'bandage', 'cloth', 'knife', 'axe', 'spear', 'leather', 'tonic'];

export const SKILLS = ['combat', 'foraging', 'woodcutting', 'survival'] as const;
export type Skill = (typeof SKILLS)[number];
export const SKILL_NAMES: Record<Skill, string> = { combat: 'Combat', foraging: 'Foraging', woodcutting: 'Woodcutting', survival: 'Survival' };

export const NPCS = {
  elder: { name: 'Elder Maren', sprite: 'elder', shirt: 0x6a5a7a, hair: 0xd8d8d8 },
  captain: { name: 'Captain Roderic', sprite: 'captain', shirt: 0x3a5a8a, hair: 0x4a3a2a },
  merchant: { name: 'Tobin the Trader', sprite: 'merchant', shirt: 0x7a5a3a, hair: 0x2a2a2a },
  hunter: { name: 'Ilsa the Hunter', sprite: 'hunter', shirt: 0x4a6a3a, hair: 0xa05a2a },
  herbalist: { name: 'Wren the Herbalist', sprite: 'herbalist', shirt: 0xc8b870, hair: 0x6a3a1a },
  villager: { name: 'Villager', sprite: 'villager', shirt: 0xb8a888, hair: 0x5a4a3a },
} as const;
export type NpcId = keyof typeof NPCS;
