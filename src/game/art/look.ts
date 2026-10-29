// Declarative description of how a character and its gear look. Items in
// content/items.ts carry one of these, so equipping a piece changes what the
// baked sprite actually draws.

import type { Col } from './raster';
import type { Build } from './rig';

export type ArmorKind = 'cloth' | 'leather' | 'mail' | 'plate' | 'bone' | 'bronze' | 'rag';
export interface ArmorVis {
  kind: ArmorKind;
  main: Col;
  trim: Col;
  /** Extra radius added to torso and limbs. 0 = skin tight, 3 = full plate. */
  bulk: number;
  /** Shoulder plate size, 0 = none. */
  pauldron: number;
  /** Tasset / skirt length in px, 0 = none. */
  skirt: number;
  studs?: boolean;
  /** Fur collar colour. */
  fur?: Col;
}

export type HelmKind = 'none' | 'hood' | 'cap' | 'barbute' | 'great' | 'horned' | 'crown' | 'mask' | 'tricorn' | 'skull' | 'veil' | 'antler';
export interface HelmVis { kind: HelmKind; main: Col; trim: Col; horn?: number; plume?: Col; glow?: Col }

export type WeaponShape =
  | 'none' | 'straight' | 'great' | 'curved' | 'katana' | 'dagger' | 'rapier'
  | 'spear' | 'halberd' | 'axe' | 'greataxe' | 'hammer' | 'mace' | 'staff'
  | 'scythe' | 'claw' | 'whip' | 'torch' | 'bow' | 'flail' | 'cleaver';
export interface WeaponVis {
  shape: WeaponShape;
  /** Blade/shaft length in sprite px. */
  len: number;
  blade: Col;
  edge: Col;
  grip: Col;
  guard: 'cross' | 'ring' | 'swept' | 'none' | 'disc' | 'spike' | 'claw';
  glow?: Col;
  twoHand?: boolean;
  /** Blade curvature in radians across its length. */
  curve?: number;
  width?: number;
}

export type ShieldShape = 'none' | 'round' | 'kite' | 'tower' | 'buckler';
export interface ShieldVis { shape: ShieldShape; main: Col; trim: Col; boss?: Col; emblem?: number }

export type HairStyle = 'none' | 'bald' | 'short' | 'long' | 'bun' | 'wild' | 'braid' | 'topknot';

export interface Look {
  build: Build;
  skin: Col;
  hair: Col;
  hairStyle: HairStyle;
  /** Base garment worn under armour. */
  cloth: Col;
  boots: Col;
  eye: Col;
  helm?: HelmVis;
  /** Chest piece: drives torso colour, bulk and pauldrons. */
  body?: ArmorVis;
  /** Leg piece: greaves and trousers. */
  legs?: ArmorVis;
  /** Arm piece: sleeves and bracers. */
  arms?: ArmorVis;
  weapon?: WeaponVis;
  shield?: ShieldVis;
  cape?: { main: Col; trim: Col; len: number; tatter?: number };
  /** Semi-transparent spectral rendering, 0..1. */
  ghost?: number;
  /** Body-wide emissive rim (hollow things, flame beasts). */
  aura?: Col;
  /** Outline colour override. */
  ink?: Col;
  /** Drawn with no face — eyeless horrors. */
  faceless?: boolean;
  /** Blood splatter amount for Bloodborne-flavoured beasts. */
  gore?: number;
}
