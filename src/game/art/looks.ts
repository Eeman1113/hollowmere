// The cast. Each entry is everything the baker needs to draw one character.
import { P } from './palette';
import { shade, mix } from './raster';
import { HUMAN, HEROIC, STUNTED, GAUNT } from './rig';
import type { Look } from './look';

const base = (o: Partial<Look>): Look => ({
  build: HUMAN, skin: P.skinPale, hair: P.hairBrown, hairStyle: 'short',
  cloth: P.cloth, boots: P.leather, eye: P.ink, ...o,
});

export const LOOKS: Record<string, Look> = {
  // ---------------------------------------------------------- the player
  player: base({
    skin: P.skinTan, hair: P.hairDark, hairStyle: 'short',
    cloth: P.wool, boots: P.leatherLit,
    body: { kind: 'rag', main: P.wool, trim: P.linen, bulk: 0.3, pauldron: 0.2, skirt: 7 },
    weapon: { shape: 'dagger', len: 12, blade: P.steel, edge: P.steelLit, grip: P.woodDark, guard: 'cross' },
  }),

  // ---------------------------------------------------------- villagers
  elder: base({
    skin: P.skinPale, hair: P.hairWhite, hairStyle: 'long',
    cloth: P.wine, boots: P.woodDark,
    body: { kind: 'cloth', main: P.wine, trim: P.gold, bulk: 0.6, pauldron: 0, skirt: 13, fur: P.ash },
    helm: { kind: 'hood', main: shade(P.wine, 0.8), trim: P.gold },
    weapon: { shape: 'staff', len: 22, blade: P.bone, edge: P.pale, grip: P.woodDark, guard: 'none', glow: P.flame },
  }),
  warden: base({
    build: HEROIC, skin: P.skinPale, hair: P.hairGrey, hairStyle: 'short',
    cloth: P.ironDark, boots: P.ironDark,
    body: { kind: 'mail', main: P.iron, trim: P.tarnish, bulk: 1.6, pauldron: 1, skirt: 9 },
    helm: { kind: 'barbute', main: P.iron, trim: P.tarnish },
    cape: { main: P.wine, trim: P.gold, len: 17 },
    weapon: { shape: 'straight', len: 17, blade: P.steel, edge: P.steelLit, grip: P.leather, guard: 'cross' },
    shield: { shape: 'kite', main: P.slateLit, trim: P.gold, boss: P.steel },
  }),
  merchant: base({
    skin: P.skinDeep, hair: P.hairDark, hairStyle: 'bald',
    cloth: P.leatherLit, boots: P.woodDark,
    body: { kind: 'leather', main: P.leatherLit, trim: P.bronze, bulk: 0.8, pauldron: 0.3, skirt: 8, studs: true },
    helm: { kind: 'tricorn', main: P.woodDark, trim: P.bronze },
  }),
  hunter: base({
    skin: P.skinTan, hair: P.hairRed, hairStyle: 'braid',
    cloth: P.moss, boots: P.leather,
    body: { kind: 'leather', main: P.moss, trim: P.hide, bulk: 0.7, pauldron: 0.5, skirt: 4, fur: P.hide },
    weapon: { shape: 'bow', len: 20, blade: P.wood, edge: P.woodLit, grip: P.wood, guard: 'none' },
  }),
  herbalist: base({
    skin: P.skinPale, hair: P.hairBrown, hairStyle: 'bun',
    cloth: P.linen, boots: P.leather,
    body: { kind: 'cloth', main: P.linen, trim: P.moss, bulk: 0.4, pauldron: 0, skirt: 12 },
    weapon: { shape: 'none', len: 0, blade: P.bone, edge: P.pale, grip: P.wood, guard: 'none' },
  }),
  bellkeeper: base({
    skin: P.skinCorpse, hair: P.hairWhite, hairStyle: 'none',
    cloth: P.ink2, boots: P.ink2,
    body: { kind: 'cloth', main: P.ink2, trim: P.bronze, bulk: 0.9, pauldron: 0, skirt: 18 },
    helm: { kind: 'veil', main: shade(P.ink2, 1.6), trim: P.bronze },
    weapon: { shape: 'staff', len: 24, blade: P.bronzeLit, edge: P.goldLit, grip: P.ebony, guard: 'none', glow: P.flame },
  }),
  smith: base({
    build: HEROIC, skin: P.skinDeep, hair: P.hairDark, hairStyle: 'topknot',
    cloth: P.leather, boots: P.ironDark,
    body: { kind: 'leather', main: P.leather, trim: P.ember, bulk: 1.0, pauldron: 0.6, skirt: 10, studs: true },
    weapon: { shape: 'hammer', len: 15, blade: P.ironDark, edge: P.ironLit, grip: P.wood, guard: 'none' },
  }),
  villager: base({
    skin: P.skinPale, hair: P.hairBrown, hairStyle: 'short',
    cloth: P.wool, boots: P.woodDark,
    body: { kind: 'cloth', main: P.wool, trim: P.linen, bulk: 0.3, pauldron: 0, skirt: 9 },
  }),

  // ---------------------------------------------------------- enemies
  hollow: base({
    build: STUNTED, skin: P.skinCorpse, hair: P.hairGrey, hairStyle: 'wild',
    cloth: shade(P.cloth, 0.7), boots: P.woodDark, eye: P.ink,
    body: { kind: 'rag', main: shade(P.wool, 0.65), trim: P.oldBlood, bulk: 0.2, pauldron: 0, skirt: 7 },
    weapon: { shape: 'dagger', len: 10, blade: P.rust, edge: shade(P.rust, 1.4), grip: P.woodDark, guard: 'none' },
    gore: 0.5, aura: undefined,
  }),
  hollow_axe: base({
    build: STUNTED, skin: P.skinCorpse, hair: P.hairDark, hairStyle: 'short',
    cloth: shade(P.cloth, 0.7), boots: P.woodDark,
    body: { kind: 'leather', main: shade(P.leather, 0.7), trim: P.oldBlood, bulk: 0.6, pauldron: 0.4, skirt: 6 },
    helm: { kind: 'cap', main: P.rust, trim: P.ironDark },
    weapon: { shape: 'axe', len: 13, blade: P.rust, edge: P.ironLit, grip: P.woodDark, guard: 'none' },
    gore: 0.6,
  }),
  ghoul: base({
    build: GAUNT, skin: P.skinAsh, hair: P.hairGrey, hairStyle: 'wild', faceless: true,
    cloth: P.oldBlood, boots: P.ebony,
    body: { kind: 'rag', main: shade(P.oldBlood, 1.1), trim: P.blood, bulk: 0.1, pauldron: 0, skirt: 4 },
    weapon: { shape: 'claw', len: 10, blade: P.bone, edge: P.pale, grip: P.skinAsh, guard: 'claw' },
    gore: 1.1, ink: [8, 6, 10],
  }),
  beastman: base({
    build: HEROIC, skin: shade(P.hide, 0.8), hair: P.hairDark, hairStyle: 'wild', faceless: true,
    cloth: P.ebony, boots: P.ebony,
    body: { kind: 'bone', main: shade(P.hide, 0.75), trim: P.bone, bulk: 0.9, pauldron: 0.7, skirt: 5, fur: shade(P.hide, 0.6) },
    helm: { kind: 'skull', main: P.boneDark, trim: P.bone, glow: P.bloodMoon },
    weapon: { shape: 'cleaver', len: 16, blade: P.ironDark, edge: P.rust, grip: P.leather, guard: 'none' },
    gore: 1.4, aura: undefined,
  }),
  redhand: base({
    skin: P.skinTan, hair: P.hairDark, hairStyle: 'short',
    cloth: P.leather, boots: P.woodDark,
    body: { kind: 'leather', main: P.leather, trim: P.crimson, bulk: 0.8, pauldron: 0.6, skirt: 7, studs: true },
    helm: { kind: 'mask', main: P.crimson, trim: P.ink },
    weapon: { shape: 'curved', len: 14, blade: P.iron, edge: P.steelLit, grip: P.woodDark, guard: 'disc', curve: 0.4 },
  }),
  redhand_bow: base({
    skin: P.skinPale, hair: P.hairBrown, hairStyle: 'short',
    cloth: P.leather, boots: P.woodDark,
    body: { kind: 'leather', main: shade(P.leather, 1.15), trim: P.crimson, bulk: 0.5, pauldron: 0.3, skirt: 5 },
    helm: { kind: 'hood', main: P.crimson, trim: P.oldBlood },
    weapon: { shape: 'bow', len: 20, blade: P.wood, edge: P.woodLit, grip: P.wood, guard: 'none' },
  }),
  choirman: base({
    build: GAUNT, skin: P.skinCorpse, hair: P.hairWhite, hairStyle: 'none',
    cloth: P.slate, boots: P.ink2,
    body: { kind: 'cloth', main: P.slate, trim: P.moonPale, bulk: 0.7, pauldron: 0, skirt: 16 },
    helm: { kind: 'veil', main: P.slateLit, trim: P.moonPale, glow: P.moon },
    weapon: { shape: 'scythe', len: 20, blade: P.steel, edge: P.moonPale, grip: P.ebony, guard: 'none' },
    ghost: 0.15,
  }),
  wraith: base({
    build: GAUNT, skin: P.hollowDim, hair: P.hollow, hairStyle: 'none', faceless: true,
    cloth: P.hollowDim, boots: P.hollowDim,
    body: { kind: 'rag', main: shade(P.hollowDim, 0.9), trim: P.hollow, bulk: 0.4, pauldron: 0, skirt: 20 },
    helm: { kind: 'hood', main: shade(P.hollowDim, 0.7), trim: P.hollow, glow: P.hollow },
    weapon: { shape: 'claw', len: 11, blade: P.hollow, edge: P.moonPale, grip: P.hollowDim, guard: 'claw', glow: P.hollow },
    ghost: 0.55, aura: P.hollow, ink: [20, 60, 64],
  }),
  gravewarden: base({
    build: HEROIC, skin: P.skinCorpse, hair: P.hairGrey, hairStyle: 'none',
    cloth: P.ironDark, boots: P.ironDark,
    body: { kind: 'plate', main: shade(P.iron, 0.8), trim: P.rust, bulk: 2.0, pauldron: 1.2, skirt: 11 },
    helm: { kind: 'great', main: shade(P.iron, 0.85), trim: P.rust, glow: P.flame },
    cape: { main: P.oldBlood, trim: P.tarnish, len: 18, tatter: 1 },
    weapon: { shape: 'halberd', len: 24, blade: P.iron, edge: P.steelLit, grip: P.ebony, guard: 'none', twoHand: true },
  }),
  inquisitor: base({
    skin: P.skinPale, hair: P.hairDark, hairStyle: 'none',
    cloth: P.ink2, boots: P.ebony,
    body: { kind: 'plate', main: P.ink2, trim: P.gold, bulk: 1.5, pauldron: 1.0, skirt: 14 },
    helm: { kind: 'horned', main: P.ink2, trim: P.gold, horn: 2 },
    cape: { main: P.crimson, trim: P.gold, len: 20 },
    weapon: { shape: 'flail', len: 16, blade: P.ironDark, edge: P.ironLit, grip: P.ebony, guard: 'none' },
  }),

  // ---------------------------------------------------------- bosses
  boss_choir: base({
    build: { ...GAUNT, h: 1.5, shoulder: 6.4, thick: 1.0, head: 4.4, spine: 24, legLen: 26, armLen: 27 },
    skin: P.skinCorpse, hair: P.hairWhite, hairStyle: 'long', faceless: true,
    cloth: P.slate, boots: P.ink2,
    body: { kind: 'cloth', main: P.slate, trim: P.moonPale, bulk: 1.0, pauldron: 0.8, skirt: 26 },
    helm: { kind: 'veil', main: P.moonPale, trim: P.moon, glow: P.moon },
    cape: { main: shade(P.slate, 0.7), trim: P.moonPale, len: 30, tatter: 1 },
    weapon: { shape: 'scythe', len: 30, blade: P.steel, edge: P.moonPale, grip: P.ebony, guard: 'none', glow: P.moon, twoHand: true },
    ghost: 0.2, aura: P.moon,
  }),
  boss_bride: base({
    build: { ...GAUNT, h: 1.42, shoulder: 5.4, thick: 0.8, head: 4.2, spine: 23, legLen: 26, armLen: 29 },
    skin: P.pale, hair: P.hairWhite, hairStyle: 'long',
    cloth: P.pale, boots: P.pale,
    body: { kind: 'cloth', main: P.pale, trim: P.crimson, bulk: 0.6, pauldron: 0, skirt: 32 },
    helm: { kind: 'crown', main: P.gold, trim: P.crimson },
    cape: { main: P.linen, trim: P.crimson, len: 34, tatter: 1 },
    weapon: { shape: 'rapier', len: 26, blade: P.steelLit, edge: P.moonPale, grip: P.gold, guard: 'swept', glow: P.crimsonLit },
    gore: 0.5, aura: P.crimsonLit,
  }),
  boss_hollow: base({
    build: { ...HEROIC, h: 1.72, shoulder: 8.4, thick: 1.5, head: 5.0, spine: 26, legLen: 29, armLen: 28 },
    skin: P.skinAsh, hair: P.hairDark, hairStyle: 'none', faceless: true,
    cloth: P.ink, boots: P.ink,
    body: { kind: 'plate', main: shade(P.ironDark, 0.9), trim: P.hollow, bulk: 2.6, pauldron: 1.6, skirt: 20 },
    helm: { kind: 'horned', main: shade(P.ironDark, 0.95), trim: P.hollow, horn: 3, glow: P.hollow },
    cape: { main: P.ink2, trim: P.hollowDim, len: 32, tatter: 1 },
    weapon: { shape: 'great', len: 32, blade: shade(P.iron, 0.85), edge: P.hollow, grip: P.ebony, guard: 'cross', glow: P.hollow, twoHand: true, width: 1.3 },
    aura: P.hollow, ink: [10, 22, 26],
  }),
  boss_smith: base({
    build: { ...HEROIC, h: 1.46, shoulder: 8.0, thick: 1.5, head: 4.6, spine: 22, legLen: 22, armLen: 24 },
    skin: shade(P.skinDeep, 0.9), hair: P.hairDark, hairStyle: 'none', faceless: true,
    cloth: P.ember, boots: P.ironDark,
    body: { kind: 'plate', main: shade(P.ironDark, 1.05), trim: P.ember, bulk: 2.4, pauldron: 1.4, skirt: 14 },
    helm: { kind: 'mask', main: P.ironDark, trim: P.flame, glow: P.flame },
    weapon: { shape: 'greataxe', len: 24, blade: P.rust, edge: P.flame, grip: P.ebony, guard: 'none', glow: P.ember, twoHand: true },
    aura: P.ember,
  }),
};

export const LOOK_NAMES = Object.keys(LOOKS);
export { mix };

// ---------------------------------------------------------------- beasts
import { BOAR, DEER, HOUND, WOLF, type BeastLook } from './beast';

const beast = (o: Partial<BeastLook> & { build: BeastLook['build'] }): BeastLook => ({
  coat: P.hide, belly: shade(P.hide, 1.2), horn: P.bone, eye: P.ink, ...o,
});

export const BEASTS: Record<string, BeastLook> = {
  deer: beast({
    build: DEER, coat: [122, 90, 62], belly: [178, 156, 128], horn: [152, 138, 112],
    marks: [196, 182, 152], eye: [26, 18, 16],
  }),
  stag: beast({
    build: { ...DEER, h: 1.15, horn: 4 }, coat: [92, 68, 48], belly: [150, 130, 104],
    horn: [168, 152, 124], eye: [26, 18, 16],
  }),
  wolf: beast({
    build: { ...WOLF, legLen: 12 }, coat: [104, 104, 112], belly: [128, 128, 134], ruff: [62, 62, 70],
    horn: P.bone, eye: [214, 190, 90],
  }),
  boar: beast({
    build: BOAR, coat: [86, 70, 54], belly: [112, 94, 74], ruff: [48, 38, 30],
    horn: [214, 206, 180], eye: [168, 60, 48],
  }),
  fenhound: beast({
    build: { ...HOUND, legLen: 13, girth: 5.2 }, coat: [92, 100, 84], belly: [124, 132, 110], ruff: [62, 70, 56],
    horn: P.bone, eye: [226, 206, 120], gore: 0.4,
  }),
  emberhound: beast({
    build: { ...HOUND, h: 1.12, mane: 2.4 }, coat: [58, 40, 36], belly: [96, 56, 44],
    ruff: [138, 62, 32], horn: P.ember, eye: [255, 160, 60], aura: P.ember,
  }),
  rotbeast: beast({
    build: { ...BOAR, h: 1.1, mane: 2.8 }, coat: [74, 84, 48], belly: [104, 112, 66],
    ruff: [58, 70, 36], horn: P.rotGlow, eye: [184, 216, 74], gore: 0.5,
  }),
};
