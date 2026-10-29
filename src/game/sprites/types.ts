// A sprite sheet converted to code: a palette plus one indexed pixel string per
// frame. Written by scripts/sprite2code.mjs — do not hand-edit generated files.

export const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+/';

export interface CodedSprite {
  name: string;
  /** Frame width in pixels. */
  w: number;
  /** Frame height in pixels. */
  h: number;
  /** Hex colours indexed by ALPHABET position. */
  palette: string[];
  /** anim name -> one indexed string per frame, row-major, '.' = transparent. */
  frames: Record<string, string[]>;
}
