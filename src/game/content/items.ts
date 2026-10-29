// Weapons, armour, shields, talismans and consumables. Every wearable carries
// the visual description the sprite baker uses, so equipping a piece changes
// what the character actually looks like.

import { P } from '../art/palette';
import { shade, mix, type Col } from '../art/raster';
import type { ArmorVis, HelmVis, ShieldVis, WeaponVis } from '../art/look';

export type Slot = 'weapon' | 'offhand' | 'helm' | 'chest' | 'arms' | 'legs' | 'talisman';
export type ItemKind = Slot | 'consumable' | 'material' | 'key' | 'ash';

export interface Scaling { str: number; dex: number; fth: number; arc: number }
export const SC = (str = 0, dex = 0, fth = 0, arc = 0): Scaling => ({ str, dex, fth, arc });

export type MovesetId = 'light' | 'quick' | 'heavyblade' | 'thrust' | 'reach' | 'sweep' | 'bash' | 'caster';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  tier: number;
  weight: number;
  value: number;
  /** Item description — this is where most of the lore lives. */
  desc: string;
  stack?: boolean;

  // --- weapon
  dmg?: number;
  scaling?: Scaling;
  /** Stamina cost of a light swing. */
  stam?: number;
  /** Attack reach in tiles. */
  reach?: number;
  /** Seconds between swings. */
  speed?: number;
  /** Poise damage dealt. */
  impact?: number;
  moveset?: MovesetId;
  bleed?: number;
  /** Bonus damage against Hollow-aligned enemies. */
  holy?: number;
  vis?: WeaponVis;
  twoHandOnly?: boolean;
  upgradeMax?: number;

  // --- armour
  phys?: number;
  arcaneDef?: number;
  fireDef?: number;
  poise?: number;
  armVis?: ArmorVis;
  helmVis?: HelmVis;
  shieldVis?: ShieldVis;
  /** Shield damage reduction while blocking, 0..1. */
  block?: number;
  /** Stamina drained when a blocked hit lands. */
  guard?: number;
  setId?: string;

  // --- consumable
  heal?: number;
  healPct?: number;
  cures?: boolean;
  staminaRegen?: number;
  buff?: { stat: 'dmg' | 'def' | 'speed'; mul: number; secs: number };
  throwDmg?: number;

  // --- talisman
  mods?: Partial<{ maxHp: number; maxStam: number; dmgMul: number; defMul: number; runeMul: number; rollIFrames: number; weightMax: number; discovery: number }>;
}

const W = (o: Partial<WeaponVis> & { shape: WeaponVis['shape'] }): WeaponVis => ({
  len: 16, blade: P.iron, edge: P.steelLit, grip: P.woodDark, guard: 'cross', ...o,
});
const A = (o: Partial<ArmorVis> & { main: Col }): ArmorVis => ({
  kind: 'leather', trim: shade(o.main, 1.3), bulk: 1, pauldron: 0.4, skirt: 7, ...o,
});
const H = (o: Partial<HelmVis> & { kind: HelmVis['kind'] }): HelmVis => ({ main: P.iron, trim: P.tarnish, ...o });

export const ITEMS: Record<string, ItemDef> = {
  // ================================================================ weapons
  rusted_dagger: {
    id: 'rusted_dagger', name: 'Rusted Dagger', kind: 'weapon', tier: 0, weight: 1, value: 20,
    desc: 'A field knife gone orange with neglect. Someone scratched a tally into the grip and stopped counting at nineteen.',
    dmg: 26, scaling: SC(0.1, 0.5), stam: 10, reach: 1.1, speed: 0.34, impact: 6, moveset: 'quick', bleed: 0.1, upgradeMax: 10,
    vis: W({ shape: 'dagger', len: 12, blade: P.rust, edge: shade(P.rust, 1.5), guard: 'cross' }),
  },
  lantern_sword: {
    id: 'lantern_sword', name: 'Lanternsworn Blade', kind: 'weapon', tier: 1, weight: 3, value: 160,
    desc: 'Issued to those who swore to keep the lamps burning. The fuller is filled with wax, so the blade smells faintly of a chapel.',
    dmg: 44, scaling: SC(0.35, 0.35), stam: 16, reach: 1.5, speed: 0.46, impact: 12, moveset: 'light', upgradeMax: 10,
    vis: W({ shape: 'straight', len: 17, blade: P.steel, edge: P.steelLit, grip: P.leather, guard: 'cross' }),
  },
  ashen_shortsword: {
    id: 'ashen_shortsword', name: 'Ashen Shortsword', kind: 'weapon', tier: 1, weight: 2.5, value: 120,
    desc: 'Forged from scrap pulled out of the Barrens. It has never been clean and never will be.',
    dmg: 38, scaling: SC(0.25, 0.45), stam: 13, reach: 1.3, speed: 0.38, impact: 9, moveset: 'quick', upgradeMax: 10,
    vis: W({ shape: 'straight', len: 14, blade: shade(P.iron, 0.9), edge: P.ironLit, grip: P.ebony, guard: 'disc' }),
  },
  bloodletter: {
    id: 'bloodletter', name: 'Bloodletter', kind: 'weapon', tier: 2, weight: 3, value: 320,
    desc: 'A curved blade the Redhand pass down by murder. Blood will not wash out of the channel; they stopped trying.',
    dmg: 48, scaling: SC(0.2, 0.6), stam: 15, reach: 1.45, speed: 0.4, impact: 10, moveset: 'sweep', bleed: 0.35, upgradeMax: 10,
    vis: W({ shape: 'curved', len: 16, blade: P.iron, edge: P.crimsonLit, grip: P.oldBlood, guard: 'disc', curve: 0.45 }),
  },
  hunters_spear: {
    id: 'hunters_spear', name: 'Fenhunter Spear', kind: 'weapon', tier: 1, weight: 3.5, value: 180,
    desc: 'Long enough to keep a drowned thing at arm\'s length. That is the whole of its design philosophy.',
    dmg: 40, scaling: SC(0.3, 0.45), stam: 15, reach: 2.3, speed: 0.48, impact: 11, moveset: 'thrust', upgradeMax: 10,
    vis: W({ shape: 'spear', len: 24, blade: P.steel, edge: P.steelLit, grip: P.wood, guard: 'none' }),
  },
  moonlit_katana: {
    id: 'moonlit_katana', name: 'Moonlit Tachi', kind: 'weapon', tier: 3, weight: 3, value: 620,
    desc: 'Carried out of a country no one in the valley can name. It cuts the mist before it cuts the man.',
    dmg: 58, scaling: SC(0.2, 0.75), stam: 16, reach: 1.6, speed: 0.4, impact: 10, moveset: 'sweep', bleed: 0.4, upgradeMax: 10,
    vis: W({ shape: 'katana', len: 19, blade: P.steelLit, edge: P.moonPale, grip: P.ink2, guard: 'disc', glow: P.moon, curve: 0.3 }),
  },
  pale_rapier: {
    id: 'pale_rapier', name: 'Pale Rapier', kind: 'weapon', tier: 2, weight: 2, value: 300,
    desc: 'A duelling blade from the Pale Hall, where disagreements were settled before breakfast and buried before noon.',
    dmg: 36, scaling: SC(0.1, 0.8), stam: 11, reach: 1.8, speed: 0.3, impact: 6, moveset: 'thrust', upgradeMax: 10,
    vis: W({ shape: 'rapier', len: 20, blade: P.steelLit, edge: P.moonPale, grip: P.gold, guard: 'swept' }),
  },
  beastcleaver: {
    id: 'beastcleaver', name: 'Beastcleaver', kind: 'weapon', tier: 2, weight: 7, value: 380,
    desc: 'Half axe, half slab. The hunters of the Rotwood learned that beasts respect mass more than edges.',
    dmg: 68, scaling: SC(0.75, 0.1), stam: 26, reach: 1.5, speed: 0.72, impact: 30, moveset: 'heavyblade', upgradeMax: 10,
    vis: W({ shape: 'cleaver', len: 17, blade: P.ironDark, edge: P.rust, grip: P.leather, guard: 'none', width: 1.1 }),
  },
  gravewarden_halberd: {
    id: 'gravewarden_halberd', name: 'Gravewarden Halberd', kind: 'weapon', tier: 3, weight: 8, value: 540,
    desc: 'The wardens were set to guard the dead. They are still at it, which is the trouble.',
    dmg: 64, scaling: SC(0.55, 0.3), stam: 24, reach: 2.6, speed: 0.68, impact: 26, moveset: 'reach', twoHandOnly: true, upgradeMax: 10,
    vis: W({ shape: 'halberd', len: 26, blade: P.iron, edge: P.steelLit, grip: P.ebony, guard: 'none', twoHand: true }),
  },
  choir_scythe: {
    id: 'choir_scythe', name: 'Choirman\'s Scythe', kind: 'weapon', tier: 3, weight: 6, value: 600,
    desc: 'The Drowned Choir did not farm. No one has ever satisfactorily explained the scythes.',
    dmg: 60, scaling: SC(0.3, 0.4, 0.3), stam: 22, reach: 2.2, speed: 0.62, impact: 20, moveset: 'sweep', holy: 12, upgradeMax: 10,
    vis: W({ shape: 'scythe', len: 24, blade: P.steel, edge: P.moonPale, grip: P.ebony, guard: 'none', glow: P.moon, twoHand: true }),
  },
  ossuary_hammer: {
    id: 'ossuary_hammer', name: 'Ossuary Maul', kind: 'weapon', tier: 2, weight: 10, value: 400,
    desc: 'Used to break the long bones so more of the dead would fit in the niches. It kept the shape of that work.',
    dmg: 80, scaling: SC(0.9, 0), stam: 32, reach: 1.4, speed: 0.9, impact: 48, moveset: 'bash', twoHandOnly: true, upgradeMax: 10,
    vis: W({ shape: 'hammer', len: 19, blade: shade(P.stone, 1.05), edge: P.bone, grip: P.ebony, guard: 'none' }),
  },
  executioners_flail: {
    id: 'executioners_flail', name: 'Executioner\'s Flail', kind: 'weapon', tier: 3, weight: 6, value: 520,
    desc: 'The Inquisition called it a question. It only ever asked one, and it asked it repeatedly.',
    dmg: 62, scaling: SC(0.6, 0.2), stam: 22, reach: 1.7, speed: 0.6, impact: 34, moveset: 'bash', bleed: 0.25, upgradeMax: 10,
    vis: W({ shape: 'flail', len: 18, blade: P.ironDark, edge: P.ironLit, grip: P.ebony, guard: 'none' }),
  },
  thornwhip: {
    id: 'thornwhip', name: 'Thornwhip', kind: 'weapon', tier: 2, weight: 2, value: 340,
    desc: 'Rotwood bramble cured in tallow until it would hold an edge. It remembers being a plant and still wants to grow.',
    dmg: 34, scaling: SC(0, 0.65, 0, 0.25), stam: 14, reach: 2.8, speed: 0.52, impact: 5, moveset: 'reach', bleed: 0.45, upgradeMax: 10,
    vis: W({ shape: 'whip', len: 26, blade: shade(P.moss, 1.1), edge: P.rotGlow, grip: P.leather, guard: 'none' }),
  },
  bellkeeper_staff: {
    id: 'bellkeeper_staff', name: 'Bellkeeper\'s Staff', kind: 'weapon', tier: 2, weight: 3, value: 420,
    desc: 'Topped with a bead of fused lamp-glass. The Bellkeeper insists it is not a weapon, then uses it as one.',
    dmg: 30, scaling: SC(0.1, 0.1, 0.7), stam: 14, reach: 1.7, speed: 0.5, impact: 14, moveset: 'caster', holy: 26, upgradeMax: 10,
    vis: W({ shape: 'staff', len: 24, blade: P.goldLit, edge: P.flameLit, grip: P.ebony, guard: 'none', glow: P.flame }),
  },
  // --- boss weapons
  choirs_requiem: {
    id: 'choirs_requiem', name: 'The Choir\'s Requiem', kind: 'weapon', tier: 4, weight: 7, value: 0,
    desc: 'Remembrance of the Warden of the Drowned Choir. It hums on the note the flood drowned, and will not be tuned.',
    dmg: 78, scaling: SC(0.3, 0.3, 0.55), stam: 24, reach: 2.4, speed: 0.6, impact: 28, moveset: 'sweep', holy: 34, twoHandOnly: true, upgradeMax: 5,
    vis: W({ shape: 'scythe', len: 28, blade: P.moonPale, edge: P.frost, grip: P.ink2, guard: 'none', glow: P.moon, twoHand: true }),
  },
  vaeliths_needle: {
    id: 'vaeliths_needle', name: 'Vaelith\'s Needle', kind: 'weapon', tier: 4, weight: 2, value: 0,
    desc: 'Remembrance of the Pale Bride. She took it to her own wedding. The groom did not survive the vows.',
    dmg: 56, scaling: SC(0, 0.9, 0, 0.3), stam: 12, reach: 2.0, speed: 0.28, impact: 8, moveset: 'thrust', bleed: 0.6, upgradeMax: 5,
    vis: W({ shape: 'rapier', len: 23, blade: P.pale, edge: P.crimsonLit, grip: P.gold, guard: 'swept', glow: P.crimsonLit }),
  },
  ember_greataxe: {
    id: 'ember_greataxe', name: 'Emberwright\'s Greataxe', kind: 'weapon', tier: 4, weight: 12, value: 0,
    desc: 'Remembrance of the thing that still works the Ember Forge. It was a smith once. It still only knows one motion.',
    dmg: 96, scaling: SC(0.95, 0), stam: 34, reach: 1.7, speed: 0.86, impact: 56, moveset: 'heavyblade', twoHandOnly: true, upgradeMax: 5,
    vis: W({ shape: 'greataxe', len: 22, blade: P.rust, edge: P.flame, grip: P.ebony, guard: 'none', glow: P.ember, twoHand: true }),
  },
  hollowbane: {
    id: 'hollowbane', name: 'Hollowbane', kind: 'weapon', tier: 5, weight: 10, value: 0,
    desc: 'Forged around a shard of the First Lantern. The only edge in the valley the Hollow cannot close over.',
    dmg: 92, scaling: SC(0.55, 0.3, 0.4), stam: 28, reach: 1.9, speed: 0.62, impact: 38, moveset: 'heavyblade', holy: 60, twoHandOnly: true, upgradeMax: 5,
    vis: W({ shape: 'great', len: 24, blade: shade(P.steel, 0.95), edge: P.hollow, grip: P.ebony, guard: 'cross', glow: P.hollow, twoHand: true, width: 1.2 }),
  },

  // ================================================================ shields
  plank_shield: {
    id: 'plank_shield', name: 'Lashed Plank', kind: 'offhand', tier: 0, weight: 3, value: 40,
    desc: 'A door, mostly. It has stopped one axe and will not stop a second.',
    phys: 3, block: 0.52, guard: 16, poise: 4,
    shieldVis: { shape: 'round', main: P.wood, trim: P.ironDark, boss: P.iron },
  },
  warden_kite: {
    id: 'warden_kite', name: 'Warden\'s Kite', kind: 'offhand', tier: 2, weight: 5, value: 220,
    desc: 'The lamp sigil is still legible under the dents, which is more than can be said for the Wardens.',
    phys: 8, block: 0.78, guard: 11, poise: 10,
    shieldVis: { shape: 'kite', main: P.slateLit, trim: P.gold, boss: P.steel, emblem: 1 },
  },
  ossuary_tower: {
    id: 'ossuary_tower', name: 'Ossuary Tower Shield', kind: 'offhand', tier: 3, weight: 11, value: 420,
    desc: 'A crypt door taken off its hinges. Something inside was knocking.',
    phys: 14, block: 0.92, guard: 8, poise: 22,
    shieldVis: { shape: 'tower', main: shade(P.stone, 1.05), trim: P.bone, boss: P.boneDark },
  },
  hunters_buckler: {
    id: 'hunters_buckler', name: 'Hunter\'s Buckler', kind: 'offhand', tier: 1, weight: 1.5, value: 160,
    desc: 'Too small to hide behind. Perfectly sized to knock a blade off line — which is the point.',
    phys: 4, block: 0.55, guard: 20, poise: 3,
    shieldVis: { shape: 'buckler', main: P.ironDark, trim: P.bronze, boss: P.bronzeLit },
  },

  // ================================================================= armour
  // --- Wanderer (starting set)
  wanderer_hood: { id: 'wanderer_hood', name: 'Wanderer\'s Hood', kind: 'helm', tier: 0, setId: 'wanderer', weight: 1, value: 20, desc: 'Oiled wool. It keeps the rain off and the recognition away.', phys: 2, arcaneDef: 1, poise: 1, helmVis: H({ kind: 'hood', main: P.wool, trim: P.linen }) },
  wanderer_coat: { id: 'wanderer_coat', name: 'Wanderer\'s Coat', kind: 'chest', tier: 0, setId: 'wanderer', weight: 3, value: 30, desc: 'Patched at both elbows by two different hands.', phys: 4, poise: 3, armVis: A({ kind: 'rag', main: P.wool, trim: P.linen, bulk: 0.4, pauldron: 0.2, skirt: 8 }) },
  wanderer_gloves: { id: 'wanderer_gloves', name: 'Wanderer\'s Wraps', kind: 'arms', tier: 0, setId: 'wanderer', weight: 0.5, value: 12, desc: 'Strips of a shirt that belonged to someone else.', phys: 1, poise: 1, armVis: A({ kind: 'rag', main: shade(P.wool, 0.9), trim: P.linen, bulk: 0.3, pauldron: 0, skirt: 0 }) },
  wanderer_boots: { id: 'wanderer_boots', name: 'Wanderer\'s Boots', kind: 'legs', tier: 0, setId: 'wanderer', weight: 1.5, value: 18, desc: 'Walked here from somewhere. The soles remember further than you do.', phys: 2, poise: 1, armVis: A({ kind: 'leather', main: shade(P.leather, 0.95), trim: P.woodDark, bulk: 0.4, pauldron: 0, skirt: 0 }) },

  // --- Lanternsworn
  lantern_helm: { id: 'lantern_helm', name: 'Lanternsworn Helm', kind: 'helm', tier: 2, setId: 'lantern', weight: 3, value: 180, desc: 'A barbute with the visor filed wide, so the wearer can always see a flame.', phys: 7, fireDef: 4, poise: 6, helmVis: H({ kind: 'barbute', main: P.iron, trim: P.gold }) },
  lantern_mail: { id: 'lantern_mail', name: 'Lanternsworn Mail', kind: 'chest', tier: 2, setId: 'lantern', weight: 9, value: 300, desc: 'Riveted mail over a waxed surcoat. The order is dissolved; the mail outlasted it.', phys: 14, fireDef: 6, poise: 16, armVis: A({ kind: 'mail', main: P.iron, trim: P.gold, bulk: 1.5, pauldron: 0.8, skirt: 10 }) },
  lantern_arms: { id: 'lantern_arms', name: 'Lanternsworn Bracers', kind: 'arms', tier: 2, setId: 'lantern', weight: 3, value: 140, desc: 'Scorched on the inside of the left forearm, where a lamp was carried too long.', phys: 6, fireDef: 3, poise: 5, armVis: A({ kind: 'mail', main: shade(P.iron, 0.95), trim: P.gold, bulk: 1.2, pauldron: 0, skirt: 0 }) },
  lantern_legs: { id: 'lantern_legs', name: 'Lanternsworn Greaves', kind: 'legs', tier: 2, setId: 'lantern', weight: 5, value: 180, desc: 'Plate over mail, cut short so the wearer could kneel at a lamp without unbuckling.', phys: 9, fireDef: 4, poise: 9, armVis: A({ kind: 'mail', main: P.iron, trim: P.tarnish, bulk: 1.5, pauldron: 0, skirt: 0 }) },

  // --- Gravewarden
  grave_helm: { id: 'grave_helm', name: 'Gravewarden Great Helm', kind: 'helm', tier: 3, setId: 'grave', weight: 6, value: 340, desc: 'Sealed at the collar. There is a reason the wardens were sealed into their armour.', phys: 12, arcaneDef: 7, poise: 14, helmVis: H({ kind: 'great', main: shade(P.iron, 0.85), trim: P.rust, glow: P.flame }) },
  grave_plate: { id: 'grave_plate', name: 'Gravewarden Plate', kind: 'chest', tier: 3, setId: 'grave', weight: 18, value: 560, desc: 'Each plate is stamped with a name. None of the names are the wearer\'s.', phys: 24, arcaneDef: 10, poise: 34, armVis: A({ kind: 'plate', main: shade(P.iron, 0.82), trim: P.rust, bulk: 2.2, pauldron: 1.3, skirt: 12 }) },
  grave_arms: { id: 'grave_arms', name: 'Gravewarden Gauntlets', kind: 'arms', tier: 3, setId: 'grave', weight: 6, value: 260, desc: 'Fingers fused shut around a haft that is no longer there.', phys: 10, arcaneDef: 4, poise: 12, armVis: A({ kind: 'plate', main: shade(P.iron, 0.8), trim: P.rust, bulk: 1.5, pauldron: 0, skirt: 0 }) },
  grave_legs: { id: 'grave_legs', name: 'Gravewarden Legs', kind: 'legs', tier: 3, setId: 'grave', weight: 10, value: 320, desc: 'Weighted at the heel so the wearer could not be moved. Or move.', phys: 15, arcaneDef: 6, poise: 20, armVis: A({ kind: 'plate', main: shade(P.iron, 0.84), trim: P.rust, bulk: 1.9, pauldron: 0, skirt: 0 }) },

  // --- Choir (light, spectral)
  choir_veil: { id: 'choir_veil', name: 'Choir Veil', kind: 'helm', tier: 3, setId: 'choir', weight: 1, value: 300, desc: 'Worn so the singer could not see who had stopped singing.', phys: 4, arcaneDef: 14, poise: 2, helmVis: H({ kind: 'veil', main: P.slateLit, trim: P.moonPale, glow: P.moon }) },
  choir_robe: { id: 'choir_robe', name: 'Choir Robe', kind: 'chest', tier: 3, setId: 'choir', weight: 4, value: 420, desc: 'Still damp. It has been still damp for a very long time.', phys: 9, arcaneDef: 24, poise: 7, armVis: A({ kind: 'cloth', main: P.slate, trim: P.moonPale, bulk: 0.7, pauldron: 0.2, skirt: 20 }) },
  choir_sleeves: { id: 'choir_sleeves', name: 'Choir Sleeves', kind: 'arms', tier: 3, setId: 'choir', weight: 1.5, value: 200, desc: 'Cut long to hide the hands. The Choir were ashamed of their hands.', phys: 3, arcaneDef: 10, poise: 2, armVis: A({ kind: 'cloth', main: shade(P.slate, 1.1), trim: P.moonPale, bulk: 0.5, pauldron: 0, skirt: 0 }) },
  choir_skirts: { id: 'choir_skirts', name: 'Choir Skirts', kind: 'legs', tier: 3, setId: 'choir', weight: 2, value: 240, desc: 'Weighted hems, so the water would not lift them when the flood came. It came anyway.', phys: 5, arcaneDef: 13, poise: 3, armVis: A({ kind: 'cloth', main: shade(P.slate, 0.95), trim: P.moonPale, bulk: 0.6, pauldron: 0, skirt: 0 }) },

  // --- Beast Hunter (Bloodborne register)
  hunter_tricorn: { id: 'hunter_tricorn', name: 'Hunter\'s Tricorn', kind: 'helm', tier: 2, setId: 'hunter', weight: 1.5, value: 220, desc: 'Wide enough to keep blood out of the eyes. That was the design brief.', phys: 6, arcaneDef: 5, poise: 4, helmVis: H({ kind: 'tricorn', main: P.ebony, trim: P.oldBlood }) },
  hunter_garb: { id: 'hunter_garb', name: 'Hunter\'s Garb', kind: 'chest', tier: 2, setId: 'hunter', weight: 6, value: 360, desc: 'Boiled leather under waxed canvas. Beasts bite; they do not often cut.', phys: 13, arcaneDef: 8, poise: 13, armVis: A({ kind: 'leather', main: P.ebony, trim: P.oldBlood, bulk: 1.1, pauldron: 0.6, skirt: 16, studs: true }) },
  hunter_gloves: { id: 'hunter_gloves', name: 'Hunter\'s Gloves', kind: 'arms', tier: 2, setId: 'hunter', weight: 2, value: 160, desc: 'Reinforced across the knuckles, which tells you how the fights tended to end.', phys: 5, arcaneDef: 3, poise: 4, armVis: A({ kind: 'leather', main: shade(P.ebony, 1.3), trim: P.oldBlood, bulk: 0.9, pauldron: 0, skirt: 0 }) },
  hunter_trousers: { id: 'hunter_trousers', name: 'Hunter\'s Trousers', kind: 'legs', tier: 2, setId: 'hunter', weight: 3, value: 200, desc: 'Tucked into boots that were resoled with something that was not leather.', phys: 8, arcaneDef: 4, poise: 6, armVis: A({ kind: 'leather', main: shade(P.ebony, 1.15), trim: P.oldBlood, bulk: 1.0, pauldron: 0, skirt: 0 }) },

  // --- Hollow Crown (endgame)
  crown_helm: { id: 'crown_helm', name: 'Horned Crown', kind: 'helm', tier: 5, setId: 'crown', weight: 5, value: 900, desc: 'The First Hollow wore this when it was still a king. The horns came later, and not from a smith.', phys: 15, arcaneDef: 16, fireDef: 10, poise: 18, helmVis: H({ kind: 'horned', main: shade(P.ironDark, 0.95), trim: P.hollow, horn: 3, glow: P.hollow }) },
  crown_plate: { id: 'crown_plate', name: 'Hollow Crown Plate', kind: 'chest', tier: 5, setId: 'crown', weight: 20, value: 1400, desc: 'It is colder on the inside than the outside. Everyone who has worn it has noticed. None have taken it off.', phys: 30, arcaneDef: 22, fireDef: 14, poise: 44, armVis: A({ kind: 'plate', main: shade(P.ironDark, 1.0), trim: P.hollow, bulk: 2.5, pauldron: 1.5, skirt: 18 }) },
  crown_arms: { id: 'crown_arms', name: 'Hollow Crown Gauntlets', kind: 'arms', tier: 5, setId: 'crown', weight: 7, value: 700, desc: 'The fingers are a half-joint too long. You will get used to it.', phys: 12, arcaneDef: 9, poise: 15, armVis: A({ kind: 'plate', main: shade(P.ironDark, 1.05), trim: P.hollow, bulk: 1.6, pauldron: 0, skirt: 0 }) },
  crown_legs: { id: 'crown_legs', name: 'Hollow Crown Greaves', kind: 'legs', tier: 5, setId: 'crown', weight: 12, value: 850, desc: 'They leave no prints in ash. This has been tested.', phys: 19, arcaneDef: 13, poise: 24, armVis: A({ kind: 'plate', main: shade(P.ironDark, 0.98), trim: P.hollow, bulk: 2.0, pauldron: 0, skirt: 0 }) },

  // =============================================================== talismans
  tal_lamp: { id: 'tal_lamp', name: 'Guttering Lamp-Bead', kind: 'talisman', tier: 1, weight: 0.2, value: 180, desc: 'A bead of lamp glass on a cord. Warm even in the fen.', mods: { maxHp: 30 } },
  tal_breath: { id: 'tal_breath', name: 'Drowned Man\'s Breath', kind: 'talisman', tier: 2, weight: 0.2, value: 260, desc: 'A stoppered vial of air from the day the Lowlands went under. Do not open it.', mods: { maxStam: 28 } },
  tal_ember: { id: 'tal_ember', name: 'Emberwright\'s Coal', kind: 'talisman', tier: 3, weight: 0.4, value: 420, desc: 'Still hot. It has been still hot for nine hundred years.', mods: { dmgMul: 1.12 } },
  tal_shroud: { id: 'tal_shroud', name: 'Shroud Pin', kind: 'talisman', tier: 3, weight: 0.2, value: 420, desc: 'Pinned the sheets closed over the faces. The wardens kept them as charms.', mods: { defMul: 0.88 } },
  tal_feather: { id: 'tal_feather', name: 'Carrion Feather', kind: 'talisman', tier: 2, weight: 0.1, value: 300, desc: 'The crows of the Moors are fat and extremely patient.', mods: { rollIFrames: 0.08 } },
  tal_coin: { id: 'tal_coin', name: 'Toll-Keeper\'s Coin', kind: 'talisman', tier: 2, weight: 0.1, value: 280, desc: 'Placed under the tongue. Somebody went back for it.', mods: { runeMul: 1.2 } },
  tal_yoke: { id: 'tal_yoke', name: 'Pilgrim\'s Yoke', kind: 'talisman', tier: 1, weight: 0.5, value: 200, desc: 'Pilgrims carried their own burdens to the Reach, and then a little of someone else\'s.', mods: { weightMax: 18 } },

  // ============================================================ consumables
  lantern_oil: { id: 'lantern_oil', name: 'Flask of Lantern Oil', kind: 'consumable', tier: 0, weight: 0, value: 0, stack: true, desc: 'Drink it. Nobody can explain why this works, only that it does, and only near a lit lamp.', healPct: 0.5 },
  bandage: { id: 'bandage', name: 'Bandage', kind: 'consumable', tier: 0, weight: 0.1, value: 30, stack: true, desc: 'Linen torn from something that is not being used any more.', heal: 60, cures: true },
  bloodwort_tonic: { id: 'bloodwort_tonic', name: 'Bloodwort Tonic', kind: 'consumable', tier: 1, weight: 0.3, value: 90, stack: true, desc: 'Bitter as a grudge. Wren brews it for the hunters and pretends not to know what they do.', heal: 140, cures: true },
  whetstone: { id: 'whetstone', name: 'Oiled Whetstone', kind: 'consumable', tier: 1, weight: 0.2, value: 120, stack: true, desc: 'Sixty seconds of a better edge.', buff: { stat: 'dmg', mul: 1.25, secs: 60 } },
  ash_resin: { id: 'ash_resin', name: 'Ash Resin', kind: 'consumable', tier: 2, weight: 0.2, value: 150, stack: true, desc: 'Tarry stuff scraped from the Barrens. Hardens on the skin and on nothing else.', buff: { stat: 'def', mul: 0.78, secs: 60 } },
  throwing_knife: { id: 'throwing_knife', name: 'Throwing Knife', kind: 'consumable', tier: 0, weight: 0.2, value: 25, stack: true, desc: 'For the archer on the tower, or the thing across the bog.', throwDmg: 40 },
  firebomb: { id: 'firebomb', name: 'Pitch Firebomb', kind: 'consumable', tier: 1, weight: 0.5, value: 70, stack: true, desc: 'Beasts hate it. So does everyone standing nearby.', throwDmg: 95 },

  // ============================================================== materials
  emberglass: { id: 'emberglass', name: 'Emberglass', kind: 'material', tier: 1, weight: 0.1, value: 60, stack: true, desc: 'Glass that cooled around a flame and kept it. The Forge takes these in trade for an edge.' },
  rune_shard: { id: 'rune_shard', name: 'Rune Shard', kind: 'material', tier: 1, weight: 0, value: 0, stack: true, desc: 'A sliver of someone\'s remaining self. Spend it before something else does.' },
  beast_bone: { id: 'beast_bone', name: 'Beast Bone', kind: 'material', tier: 1, weight: 0.3, value: 40, stack: true, desc: 'Too long for the limb it came out of.' },
  pale_ash: { id: 'pale_ash', name: 'Pale Ash', kind: 'material', tier: 2, weight: 0.1, value: 90, stack: true, desc: 'What the Choir leave behind. It does not blow away in wind.' },
  hollow_marrow: { id: 'hollow_marrow', name: 'Hollow Marrow', kind: 'material', tier: 3, weight: 0.2, value: 180, stack: true, desc: 'Cold, and faintly lit from inside. The Forge will not handle it without tongs.' },

  // ==================================================================== keys
  bell_key: { id: 'bell_key', name: 'Bellkeeper\'s Key', kind: 'key', tier: 0, weight: 0, value: 0, desc: 'Opens the stair under the Cathedral. The Bellkeeper gave it up too easily.' },
  rem_choir: { id: 'rem_choir', name: 'Remembrance of the Choir', kind: 'key', tier: 0, weight: 0, value: 0, desc: 'A wet, singing weight. Take it to a lamp and it will become something you can hold.' },
  rem_bride: { id: 'rem_bride', name: 'Remembrance of the Pale Bride', kind: 'key', tier: 0, weight: 0, value: 0, desc: 'Still warm. Still, somehow, expectant.' },
  rem_first: { id: 'rem_first', name: 'Remembrance of the First Hollow', kind: 'key', tier: 0, weight: 0, value: 0, desc: 'The last thing a king was. There is no weight to it at all.' },
};

export const ARMOR_SETS: Record<string, { name: string; bonus: string; pieces: string[] }> = {
  wanderer: { name: 'Wanderer', bonus: '', pieces: ['wanderer_hood', 'wanderer_coat', 'wanderer_gloves', 'wanderer_boots'] },
  lantern: { name: 'Lanternsworn', bonus: 'Lantern Oil restores 10% more.', pieces: ['lantern_helm', 'lantern_mail', 'lantern_arms', 'lantern_legs'] },
  grave: { name: 'Gravewarden', bonus: 'Poise damage taken reduced by 20%.', pieces: ['grave_helm', 'grave_plate', 'grave_arms', 'grave_legs'] },
  choir: { name: 'Drowned Choir', bonus: 'Arcane damage taken reduced by a further 15%.', pieces: ['choir_veil', 'choir_robe', 'choir_sleeves', 'choir_skirts'] },
  hunter: { name: 'Beast Hunter', bonus: 'Rolling costs 15% less stamina.', pieces: ['hunter_tricorn', 'hunter_garb', 'hunter_gloves', 'hunter_trousers'] },
  crown: { name: 'Hollow Crown', bonus: 'Runes lost on death are halved.', pieces: ['crown_helm', 'crown_plate', 'crown_arms', 'crown_legs'] },
};

export const MOVESETS: Record<MovesetId, { light: ('attack1' | 'attack2')[]; heavy: 'heavy'; arc: number; lunge: number }> = {
  quick:      { light: ['attack1', 'attack2', 'attack1'], heavy: 'heavy', arc: 1.5, lunge: 0.3 },
  light:      { light: ['attack1', 'attack2'], heavy: 'heavy', arc: 1.8, lunge: 0.45 },
  heavyblade: { light: ['attack1', 'attack1'], heavy: 'heavy', arc: 2.3, lunge: 0.6 },
  thrust:     { light: ['attack2', 'attack2'], heavy: 'heavy', arc: 0.8, lunge: 1.0 },
  reach:      { light: ['attack2', 'attack1'], heavy: 'heavy', arc: 1.3, lunge: 0.8 },
  sweep:      { light: ['attack1', 'attack1', 'attack2'], heavy: 'heavy', arc: 2.6, lunge: 0.4 },
  bash:       { light: ['heavy', 'attack1'] as unknown as ('attack1' | 'attack2')[], heavy: 'heavy', arc: 1.6, lunge: 0.5 },
  caster:     { light: ['attack1', 'attack2'], heavy: 'heavy', arc: 1.6, lunge: 0.3 },
};

export const UPGRADE_COST = (lvl: number) => Math.round(2 + lvl * 1.6);
export const upgradeMul = (lvl: number) => 1 + lvl * 0.11;

export const itemsOfKind = (k: ItemKind) => Object.values(ITEMS).filter(i => i.kind === k);
export const byTier = (k: ItemKind, tier: number) => itemsOfKind(k).filter(i => i.tier <= tier);
export { mix };
