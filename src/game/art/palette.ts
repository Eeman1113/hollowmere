// One palette for the whole game. Desaturated cold stone and ash, with gold and
// old blood as the only saturated accents — Elden Ring / Bloodborne register.

import { col, type Col } from './raster';

export const PAL = {
  ink: col(0x0b0910),
  ink2: col(0x14121c),
  shadow: col(0x1b1a26),

  stone: col(0x4a4b58),
  stoneLit: col(0x6d6e7c),
  stoneDark: col(0x2e2f3a),
  stoneWet: col(0x3a4250),
  granite: col(0x575463),
  marble: col(0x8e8c96),

  slate: col(0x353d4c),
  slateLit: col(0x4d586b),

  wood: col(0x4a3a2c),
  woodLit: col(0x6a5340),
  woodDark: col(0x2c211a),
  ebony: col(0x241c1f),

  iron: col(0x5a5f69),
  ironLit: col(0x878d98),
  ironDark: col(0x32353d),
  steel: col(0x9aa2ae),
  steelLit: col(0xc8cfd8),
  rust: col(0x6b4433),
  bronze: col(0x8a6a3a),
  bronzeLit: col(0xbf9550),
  gold: col(0xb79149),
  goldLit: col(0xe8c878),
  tarnish: col(0x6f6240),

  cloth: col(0x3d3a46),
  clothLit: col(0x565266),
  linen: col(0x9e9480),
  wool: col(0x6b6354),
  leather: col(0x4e3a2a),
  leatherLit: col(0x6d523a),
  hide: col(0x6a5745),

  crimson: col(0x7a1f26),
  crimsonLit: col(0xa8333a),
  blood: col(0x58151b),
  oldBlood: col(0x3e1317),
  wine: col(0x4a1f33),

  bone: col(0xb9b298),
  boneDark: col(0x8b836c),
  ash: col(0x6e6a66),
  ashLit: col(0x95918c),
  pale: col(0xc8c0ae),

  moss: col(0x3c4a32),
  mossLit: col(0x55663f),
  fen: col(0x2e3a2c),
  rot: col(0x4a4a2c),
  sickGreen: col(0x5c6b38),

  skinPale: col(0xc9a184),
  skinPaleDark: col(0xa6816a),
  skinTan: col(0xa87a56),
  skinDeep: col(0x6d4a36),
  skinGrey: col(0x8e9096),
  skinCorpse: col(0x9aa09a),
  skinAsh: col(0x7d7a74),

  hairDark: col(0x241c18),
  hairBrown: col(0x4a3524),
  hairGrey: col(0xa09a90),
  hairWhite: col(0xd8d4c8),
  hairRed: col(0x6e3a22),

  // emissive accents
  flame: col(0xff9a3c),
  flameLit: col(0xffd98a),
  ember: col(0xc9552a),
  hollow: col(0x58d8c8),
  hollowDim: col(0x2a7a74),
  moon: col(0xaec4e8),
  moonPale: col(0xd8e4f8),
  arcane: col(0x9a6ad8),
  arcaneLit: col(0xc8a8f0),
  bloodMoon: col(0xd84a3a),
  frost: col(0x8ecad8),
  rotGlow: col(0xb8d84a),
} satisfies Record<string, Col>;

export type PalKey = keyof typeof PAL;
export const P = PAL;
