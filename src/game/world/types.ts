// Tiles, props and biomes for the streamed world.

export const T = {
  VOID: 0,
  GRASS: 1,
  GRASS_DRY: 2,
  MOSS: 3,
  FERN: 4,
  DIRT: 5,
  MUD: 6,
  BOG: 7,
  SAND: 8,
  ASH: 9,
  CINDER: 10,
  STONE: 11,
  COBBLE: 12,
  FLAG: 13,
  MARBLE: 14,
  PLANK: 15,
  GRAVE_DIRT: 16,
  ROAD: 17,
  SNOW: 18,
  ROT: 19,
  BLOODSTONE: 20,
  WATER: 21,
  DEEP: 22,
} as const;
export type T = (typeof T)[keyof typeof T];

/** Tiles you cannot stand on. */
export const LIQUID = new Set<T>([T.WATER, T.DEEP]);

export const O = {
  NONE: 0,
  TREE_DEAD: 1,
  TREE_PALE: 2,
  TREE_PINE: 3,
  TREE_ROT: 4,
  STUMP: 5,
  BUSH: 6,
  BUSH_BARE: 7,
  REED: 8,
  FUNGUS: 9,
  FERN_BUSH: 10,
  VINE: 11,
  ROCK: 12,
  BOULDER: 13,
  CRAG: 14,
  BONES: 15,
  SKULL_PILE: 16,
  ASH_HEAP: 17,
  ROOT: 18,
  CRYSTAL: 19,
  WALL: 20,
  WALL_WINDOW: 21,
  WALL_ARCH: 22,
  WALL_RUIN: 23,
  BUTTRESS: 24,
  PILLAR: 25,
  PILLAR_BROKEN: 26,
  SPIRE: 27,
  ARCH: 28,
  STAIR: 29,
  BATTLEMENT: 30,
  GATE: 31,
  DOOR: 32,
  RUBBLE: 33,
  FLOOR_GRATE: 34,
  BRIDGE_RAIL: 35,
  STATUE_SAINT: 36,
  STATUE_BEAST: 37,
  GARGOYLE: 38,
  TOMB: 39,
  COFFIN: 40,
  GRAVE_CROSS: 41,
  GRAVE_SLAB: 42,
  OSSUARY: 43,
  BRAZIER: 44,
  LAMP_POST: 45,
  CANDLE_RACK: 46,
  CHANDELIER: 47,
  BANNER: 48,
  GIBBET: 49,
  PYRE: 50,
  WHEEL: 51,
  BELL: 52,
  IRON_FENCE: 53,
  WOOD_FENCE: 54,
  WELL: 55,
  CART: 56,
  CRATE: 57,
  BARREL: 58,
  TABLE: 59,
  CHAIR: 60,
  BED: 61,
  ANVIL: 62,
  CAULDRON: 63,
  BOOKSHELF: 64,
  LANTERN: 65,
  CHEST: 66,
  CORPSE: 67,
  NOTE: 68,
  ALTAR: 69,
  FOG_WALL: 70,
  HERB: 71,
  ORE: 72,
  SHARD: 73,
  LADDER: 74,
  SIGN: 75,
} as const;
export type O = (typeof O)[keyof typeof O];

export const BLOCKING = new Set<O>([
  O.TREE_DEAD, O.TREE_PALE, O.TREE_PINE, O.TREE_ROT, O.ROCK, O.BOULDER, O.CRAG, O.CRYSTAL,
  O.WALL, O.WALL_WINDOW, O.WALL_RUIN, O.BUTTRESS, O.PILLAR, O.PILLAR_BROKEN, O.SPIRE,
  O.BATTLEMENT, O.GATE, O.RUBBLE, O.BRIDGE_RAIL,
  O.STATUE_SAINT, O.STATUE_BEAST, O.GARGOYLE, O.TOMB, O.COFFIN, O.OSSUARY,
  O.BRAZIER, O.LAMP_POST, O.CANDLE_RACK, O.PYRE, O.WHEEL, O.BELL, O.GIBBET,
  O.IRON_FENCE, O.WOOD_FENCE, O.WELL, O.CART, O.CRATE, O.BARREL, O.TABLE, O.ANVIL, O.CAULDRON, O.BOOKSHELF,
  O.LANTERN, O.CHEST, O.ALTAR, O.ORE, O.SKULL_PILE, O.GRAVE_SLAB,
]);

/** Props tall enough to hide the player; they fade when walked behind. */
export const TALL = new Set<O>([
  O.TREE_DEAD, O.TREE_PALE, O.TREE_PINE, O.TREE_ROT, O.WALL, O.WALL_WINDOW, O.WALL_RUIN,
  O.BUTTRESS, O.PILLAR, O.PILLAR_BROKEN, O.SPIRE, O.BATTLEMENT, O.GATE, O.STATUE_SAINT,
  O.STATUE_BEAST, O.GARGOYLE, O.LAMP_POST, O.GIBBET, O.BELL, O.CHANDELIER, O.BANNER, O.ARCH, O.CRAG, O.BOULDER,
]);

/** Props that can be searched for loot. */
export const CONTAINERS = new Set<O>([O.CHEST, O.CRATE, O.BARREL, O.COFFIN, O.CORPSE, O.OSSUARY, O.BOOKSHELF]);
/** Props you harvest rather than loot. */
export const HARVEST = new Set<O>([O.BUSH, O.HERB, O.FUNGUS, O.ORE, O.SHARD, O.REED]);

export const OBJ_NAME: Partial<Record<O, string>> = {
  [O.TREE_DEAD]: 'Dead Tree', [O.TREE_PALE]: 'Pale Birch', [O.TREE_PINE]: 'Black Pine', [O.TREE_ROT]: 'Rotwood Tree',
  [O.BUSH]: 'Thornberry Bush', [O.HERB]: 'Bloodwort', [O.FUNGUS]: 'Pallid Fungus', [O.REED]: 'Fen Reeds',
  [O.ROCK]: 'Stone', [O.ORE]: 'Emberglass Vein', [O.SHARD]: 'Rune Shard',
  [O.CHEST]: 'Strongbox', [O.CRATE]: 'Crate', [O.BARREL]: 'Barrel', [O.COFFIN]: 'Coffin',
  [O.CORPSE]: 'Corpse', [O.OSSUARY]: 'Ossuary Niche', [O.BOOKSHELF]: 'Mouldering Shelf',
  [O.LANTERN]: 'Lantern', [O.ALTAR]: 'Altar', [O.NOTE]: 'Remnant', [O.SIGN]: 'Weathered Sign',
  [O.WELL]: 'Well', [O.ANVIL]: 'Anvil', [O.CAULDRON]: 'Cauldron', [O.BRAZIER]: 'Brazier',
  [O.GRAVE_CROSS]: 'Grave', [O.GRAVE_SLAB]: 'Grave Slab', [O.TOMB]: 'Tomb', [O.STATUE_SAINT]: 'Effigy',
  [O.STATUE_BEAST]: 'Beast Effigy', [O.GARGOYLE]: 'Gargoyle', [O.GIBBET]: 'Gibbet', [O.BELL]: 'Bell',
  [O.LADDER]: 'Ladder', [O.FOG_WALL]: 'Wall of Fog', [O.BED]: 'Bed', [O.TABLE]: 'Table',
};

export type Biome =
  | 'fen' | 'moor' | 'palewood' | 'cinder' | 'lowland' | 'bonehill' | 'rotwood' | 'reach';

export interface BiomeDef {
  id: Biome;
  name: string;
  /** Ground tiles by weight. */
  ground: [T, number][];
  /** Scatter props by weight; weight is per-tile probability. */
  scatter: [O, number][];
  /** Ambient light tint applied to the whole scene. */
  tint: number;
  fog: number;
  /** Enemy table ids with weights. */
  mobs: [string, number][];
  /** Danger tier 0..4 — drives enemy level scaling. */
  tier: number;
  /** Structures that prefer this biome. */
  structures: [string, number][];
  music?: string;
}

export const BIOMES: Record<Biome, BiomeDef> = {
  fen: {
    id: 'fen', name: 'The Ashen Fen', tier: 0, tint: 0x8a9a8e, fog: 0.22,
    ground: [[T.MOSS, 5], [T.BOG, 3], [T.MUD, 2], [T.GRASS, 3], [T.FERN, 2]],
    scatter: [[O.TREE_DEAD, 0.055], [O.REED, 0.05], [O.FERN_BUSH, 0.03], [O.BUSH, 0.012], [O.ROCK, 0.012], [O.FUNGUS, 0.01], [O.ROOT, 0.02], [O.HERB, 0.008]],
    mobs: [['hollow', 5], ['hollow_axe', 2], ['fenhound', 3], ['deer', 4], ['boar', 1]],
    structures: [['hamlet', 3], ['watchtower', 2], ['menhir', 2], ['camp', 2], ['well_shrine', 2]],
  },
  moor: {
    id: 'moor', name: 'The Grave Moors', tier: 1, tint: 0x9a94a2, fog: 0.26,
    ground: [[T.GRASS_DRY, 6], [T.DIRT, 3], [T.GRAVE_DIRT, 2], [T.STONE, 1]],
    scatter: [[O.GRAVE_CROSS, 0.03], [O.ROCK, 0.025], [O.TREE_DEAD, 0.022], [O.BONES, 0.016], [O.GRAVE_SLAB, 0.01], [O.IRON_FENCE, 0.006], [O.HERB, 0.006]],
    mobs: [['hollow', 4], ['ghoul', 3], ['gravewarden', 1], ['wraith', 2], ['wolf', 3]],
    structures: [['catacomb', 4], ['menhir', 3], ['gibbet_road', 2], ['keep', 2], ['camp', 1]],
  },
  palewood: {
    id: 'palewood', name: 'The Pale Woods', tier: 1, tint: 0x9aa6b4, fog: 0.3,
    ground: [[T.MOSS, 4], [T.FERN, 4], [T.DIRT, 2], [T.GRASS, 3]],
    scatter: [[O.TREE_PALE, 0.11], [O.FERN_BUSH, 0.05], [O.BUSH, 0.02], [O.FUNGUS, 0.018], [O.ROOT, 0.02], [O.ROCK, 0.01], [O.HERB, 0.01]],
    mobs: [['fenhound', 4], ['ghoul', 2], ['redhand', 3], ['beastman', 1], ['deer', 4], ['stag', 2], ['wolf', 2]],
    structures: [['camp', 4], ['hamlet', 2], ['menhir', 2], ['well_shrine', 2], ['watchtower', 2]],
  },
  cinder: {
    id: 'cinder', name: 'The Cinder Barrens', tier: 3, tint: 0xb08a72, fog: 0.34,
    ground: [[T.ASH, 6], [T.CINDER, 3], [T.STONE, 2], [T.BLOODSTONE, 1]],
    scatter: [[O.STUMP, 0.04], [O.ASH_HEAP, 0.04], [O.BONES, 0.025], [O.CRAG, 0.02], [O.ROCK, 0.02], [O.PYRE, 0.006], [O.ORE, 0.008]],
    mobs: [['beastman', 4], ['inquisitor', 2], ['emberhound', 3], ['gravewarden', 2]],
    structures: [['forge', 3], ['keep', 3], ['gibbet_road', 2], ['menhir', 1], ['camp', 2]],
  },
  lowland: {
    id: 'lowland', name: 'The Sunken Lowlands', tier: 2, tint: 0x7e96a8, fog: 0.4,
    ground: [[T.BOG, 5], [T.MUD, 4], [T.WATER, 3], [T.MOSS, 2]],
    scatter: [[O.REED, 0.08], [O.TREE_ROT, 0.03], [O.RUBBLE, 0.02], [O.PILLAR_BROKEN, 0.012], [O.FUNGUS, 0.02], [O.BONES, 0.01]],
    mobs: [['drowned', 5], ['wraith', 3], ['ghoul', 2]],
    structures: [['sunken_chapel', 3], ['bridge', 3], ['aqueduct', 2], ['hamlet', 1]],
  },
  bonehill: {
    id: 'bonehill', name: 'The Bone Highlands', tier: 3, tint: 0xa8b0bc, fog: 0.28,
    ground: [[T.STONE, 6], [T.SNOW, 3], [T.DIRT, 2]],
    scatter: [[O.CRAG, 0.05], [O.BOULDER, 0.03], [O.BONES, 0.035], [O.SKULL_PILE, 0.012], [O.ROCK, 0.03], [O.CRYSTAL, 0.008], [O.ORE, 0.01]],
    mobs: [['gravewarden', 3], ['inquisitor', 3], ['wraith', 2], ['beastman', 2], ['stag', 1]],
    structures: [['keep', 4], ['menhir', 3], ['watchtower', 3], ['catacomb', 2]],
  },
  rotwood: {
    id: 'rotwood', name: 'The Rotwood', tier: 2, tint: 0x8aa06a, fog: 0.36,
    ground: [[T.ROT, 5], [T.MOSS, 3], [T.MUD, 2], [T.FERN, 2]],
    scatter: [[O.TREE_ROT, 0.09], [O.FUNGUS, 0.06], [O.VINE, 0.03], [O.FERN_BUSH, 0.03], [O.ROOT, 0.025], [O.BONES, 0.01], [O.HERB, 0.012]],
    mobs: [['ghoul', 4], ['beastman', 3], ['rotspawn', 4], ['fenhound', 2], ['boar', 2]],
    structures: [['camp', 3], ['sunken_chapel', 2], ['menhir', 2], ['hamlet', 1]],
  },
  reach: {
    id: 'reach', name: 'Chapel Reach', tier: 4, tint: 0xa0a4c0, fog: 0.24,
    ground: [[T.COBBLE, 5], [T.FLAG, 3], [T.MARBLE, 2], [T.STONE, 3], [T.GRAVE_DIRT, 1]],
    scatter: [[O.RUBBLE, 0.035], [O.PILLAR_BROKEN, 0.018], [O.STATUE_SAINT, 0.008], [O.GRAVE_SLAB, 0.012], [O.CANDLE_RACK, 0.008], [O.BONES, 0.012], [O.IRON_FENCE, 0.008]],
    mobs: [['choirman', 4], ['inquisitor', 3], ['gravewarden', 3], ['wraith', 2]],
    structures: [['cathedral', 5], ['catacomb', 3], ['aqueduct', 2], ['keep', 2]],
  },
};

export const BIOME_LIST = Object.values(BIOMES);
