// A sprite stored as code: palette-indexed pixel strings, one string per frame.
// Each char is an index into ALPHABET → palette; '.' is transparent.
export interface CodedSprite {
  name: string;
  w: number;
  h: number;
  palette: string[];
  frames: Record<string, string[]>;
}

export const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+/';
